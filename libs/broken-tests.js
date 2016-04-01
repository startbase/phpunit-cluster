var mysql = require('mysql2');

/**
 * ¬ырезает из suite теста подробное описание ошибки
 * ƒо: GKPZRowTest::testGetApprovalDepartmentCheckRequired with data set #1 (2, true) [Failed asserting that false matches expected true.]
 * ѕосле: GKPZRowTest::testGetApprovalDepartmentCheckRequired with data set #1 (2, true)
 *
 * @param {string} suite
 * @returns {string}
 */
function getTestSuite(suite) {
	var position = suite.indexOf(" [Failed ");
	return suite.substring(0, position);
}

/**
 * ¬ырезает из истории коммитов автора(-ов) и возвращает в виде строки
 *
 * @param {Array} commit_history
 * @returns {string}
 */
function getCommitAuthors(commit_history) {
	if (commit_history.length == 0) {
		return '';
	}

	var authors = [];
	commit_history.forEach(function (item) {
		var position = item.indexOf("] Merge branch ");
		if (position > 0) {
			var author = item.substring(1, position);

			if (authors.indexOf(author) == -1) {
				authors.push(item.substring(1, position));
			}
		}
	});

	return authors.join(", ");
}

var BrokenTests = function (config) {

	this.getNewConnection = function () {
		return mysql.createConnection({
			user: config.logAgregator.user,
			password: config.logAgregator.password,
			database: config.logAgregator.database
		});
	};

	this.init = function () {
		var connection = this.getNewConnection();

		connection.query('CREATE TABLE IF NOT EXISTS `' + config.logAgregator.tables.broken_tests + '` (' +
			'`id` INT(11) NOT NULL AUTO_INCREMENT,' +
			'`suitename` TEXT NOT NULL,' +
			'`first_commit` VARCHAR(32) NOT NULL,' +
			'`commit_authors` TEXT NOT NULL,' +
			'`broketime` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,' +
			'`repairtime` TIMESTAMP NOT NULL DEFAULT 0,' +
			'PRIMARY KEY (`id`)' +
			') COLLATE="utf8_general_ci" ENGINE=InnoDB', function (err, result) {

			if (err) {
				console.log("[MYSQL] BROKEN TESTS ERROR:\n".red);
				console.log(err);
			}

			connection.close();
		});
	};

	this.update = function (data) {
		var self = this;
		var broken_tests = this.getBrokenTests();

		/** ≈сли у нас нет сломаных тестов и последний пул ничего не сломал - ничего не делаем */
		if (broken_tests.length() == 0 && data.tests_failed_count == 0) {
			return;
		}

		/** ≈сли у нас нет сломаных тестов, но последний пул какие-то сломал - добавл€ем их в базу */
		if (broken_tests.length() == 0 && data.tests_failed_count > 0) {
			data.failed_tests_suites[0].forEach(function (test) {
				test.forEach(function (suite) {
					var broken_suite = {
						suitename: getTestSuite(suite),
						first_commit: data.commit_hash,
						commit_authors: getCommitAuthors(data.commit_history)
					};

					console.log('SAVE SUITE:\n');
					console.log(broken_suite);

					self.addBrokenTest(broken_suite);
				});
			});

			return;
		}

		/** ≈сли у нас есть сломаные тесты и последний пул всЄ починил - обновл€ем дату починки */
		if (broken_tests.length() > 0 && data.tests_failed_count == 0) {
			var ids = [];

			broken_tests.forEach(function (item) {
				console.log('Item:\n');
				console.log(item);
				ids.push(item.id);
			});

			console.log('REPAIR IDS:\n');
			console.log(ids);

			if (ids.length > 0) {
				this.repairTests(ids);
			}

			return;
		}

		/** ≈сли у нас есть сломаные тесты и последний пул тоже имеет сломаные тесты - сравнить и обновить/добавить */
		if (broken_tests.length() > 0 && data.tests_failed_count > 0) {
			var suites = [];
			data.failed_tests_suites[0].forEach(function (test) {
				test.forEach(function (suite) {
					suites.push(getTestSuite(suite));
				});
			});

			var repair_ids = [];

			broken_tests.forEach(function (test) {
				var position = suites.indexOf(test.suitename);

				/**
				 * ≈сли сломаного теста нет в результатах пула - его починили
				 * »наче, он там есть и его сохран€ть снова не нужно - удал€ем из suites
				 */
				if (position == -1) {
					repair_ids.push(test.id);
				} else {
					suites.splice(position, 1);
				}
			});

			console.log('REPAIR IDS:\n');
			console.log(repair_ids);
			console.log('NEW SUITES:\n');
			console.log(suites);

			/**
			 * —ейчас у нас есть два массива:
			 * repair_ids - ID тестов, которые починили
			 * suites - новые сломаные тесты
			 */
			if (repair_ids.length > 0) {
				this.repairTests(repair_ids);
			}

			if (suites.length > 0) {
				suites.forEach(function (suite) {
					self.addBrokenTest({
						suitename: suite,
						first_commit: data.commit_hash,
						commit_authors: getCommitAuthors(data.commit_history)
					});
				});
			}
		}
	};

	this.getBrokenTests = function () {
		var connection = this.getNewConnection();
		var options = { sql: 'SELECT `id`, `suitename` FROM `' + config.logAgregator.tables.broken_tests + '` WHERE `repairtime` = "0"', rowsAsArray: true };

		connection.query(options, function(err, results) {
			if (err) {
				console.log("[MYSQL] BROKEN TESTS ERROR:\n".red);
				console.log(err.red);
			}

			console.log('List broken tests:\n');
			console.log(results);

			connection.close();

			return results;
		});
	};

	this.addBrokenTest = function (data) {
		var connection = this.getNewConnection();

		connection.prepare("INSERT INTO `" + config.logAgregator.tables.broken_tests + "` (`suitename`, `first_commit`, `commit_authors`) VALUES (?, ?, ?)", function (err, statement) {
			statement.execute([data.suitename, data.first_commit, data.commit_authors], function (err, rows, columns) {
				if (err) {
					console.log("[MYSQL] BROKEN TESTS ERROR:\n".red);
					console.log(err.red);
				}

				connection.close();
			});
		});
	};

	this.repairTests = function (ids) {
		var connection = this.getNewConnection();

		connection.prepare("UPDATE `" + config.logAgregator.tables.broken_tests + "` SET `repairtime` = '?' WHERE `id` IN (?)", function (err, statement) {
			statement.execute([new Date().getTime(), ids.join()], function (err, rows, columns) {
				if (err) {
					console.log("[MYSQL] BROKEN TESTS ERROR:\n".red);
					console.log(err.red);
				}

				connection.close();
			});
		});
	};

	this.init();
};

module.exports = new BrokenTests();