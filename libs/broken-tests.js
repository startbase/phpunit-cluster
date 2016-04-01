var mysql = require('mysql2');

/**
 * Вырезает из suite теста подробное описание ошибки
 * До: GKPZRowTest::testGetApprovalDepartmentCheckRequired with data set #1 (2, true) [Failed asserting that false matches expected true.]
 * После: GKPZRowTest::testGetApprovalDepartmentCheckRequired with data set #1 (2, true)
 *
 * @param {string} suite
 * @returns {string}
 */
function getTestSuite(suite) {
	var position = suite.indexOf(" [Failed ");
	return suite.substring(0, position);
}

/**
 * Вырезает из истории коммитов автора(-ов) и возвращает в виде строки
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

	this.tablename = config.logAgregator.tables.broken_tests;

	this.getNewConnection = function () {
		return mysql.createConnection({
			user: config.logAgregator.user,
			password: config.logAgregator.password,
			database: config.logAgregator.database
		});
	};

	this.init = function () {
		var connection = this.getNewConnection();
		var query = 'CREATE TABLE IF NOT EXISTS `' + this.tablename + '` (' +
			'`id` INT(11) NOT NULL AUTO_INCREMENT,' +
			'`suitename` TEXT NOT NULL,' +
			'`first_commit` VARCHAR(32) NOT NULL,' +
			'`commit_authors` TEXT NOT NULL,' +
			'`broketime` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,' +
			'`repairtime` TIMESTAMP NOT NULL DEFAULT 0,' +
			'PRIMARY KEY (`id`)' +
			') COLLATE="utf8_general_ci" ENGINE=InnoDB';

		connection.query(query, function (err, result) {

			if (err) {
				console.log("[MYSQL] BROKEN TESTS ERROR:\n".red);
				console.log(err);
			}

			connection.close();
		});
	};

	this.update = function (data, broken_tests) {
		var self = this;

		/** Если у нас нет сломаных тестов и последний пул ничего не сломал - ничего не делаем */
		if (broken_tests.length == 0 && data.tests_failed_count == 0) {
			return;
		}

		/** Если у нас нет сломаных тестов, но последний пул какие-то сломал - добавляем их в базу */
		if (broken_tests.length == 0 && data.tests_failed_count > 0) {
			data.failed_tests_suites.forEach(function (test) {
				test.forEach(function (suite) {
					var broken_suite = {
						suitename: getTestSuite(suite),
						first_commit: data.commit_hash,
						commit_authors: getCommitAuthors(data.commit_history)
					};

					self.addBrokenTest(broken_suite);
				});
			});

			return;
		}

		/** Если у нас есть сломаные тесты и последний пул всё починил - обновляем дату починки */
		if (broken_tests.length > 0 && data.tests_failed_count == 0) {
			var ids = [];

			broken_tests.forEach(function (item) {
				ids.push(item[0]);
			});

			if (ids.length > 0) {
				this.repairTests(ids);
			}

			return;
		}

		/** Если у нас есть сломаные тесты и последний пул тоже имеет сломаные тесты - сравнить и обновить/добавить */
		if (broken_tests.length > 0 && data.tests_failed_count > 0) {
			var suites = [];
			data.failed_tests_suites.forEach(function (test) {
				test.forEach(function (suite) {
					suites.push(getTestSuite(suite));
				});
			});

			var repair_ids = [];

			console.log('BROKEN SUITES FROM POOL:\n');
			console.log(suites);

			broken_tests.forEach(function (test) {
				var position = suites.indexOf(test[1]);

				/**
				 * Если сломаного теста нет в результатах пула - его починили
				 * Иначе, он там есть и его сохранять снова не нужно - удаляем из suites
				 */
				if (position == -1) {
					repair_ids.push(test[0]);
				} else {
					suites.splice(position, 1);
				}
			});

			console.log('BROKEN SUITES FROM POOL (AFTER CLEAR):\n');
			console.log(suites);

			/**
			 * Сейчас у нас есть два массива:
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

	this.getBrokenTests = function (callback) {
		var connection = this.getNewConnection();
		var options = { sql: 'SELECT `id`, `suitename` FROM `' + this.tablename + '` WHERE `repairtime` = "0000-00-00 00:00:00"', rowsAsArray: true };

		connection.query(options, function(err, results) {
			if (err) {
				console.log("[MYSQL] BROKEN TESTS ERROR:\n".red);
				console.log(err.red);
			}

			callback(results);

			connection.close();
		});
	};

	this.addBrokenTest = function (data) {
		var connection = this.getNewConnection();

		connection.prepare("INSERT INTO `" + this.tablename + "` (`suitename`, `first_commit`, `commit_authors`) VALUES (?, ?, ?)", function (err, statement) {
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

		connection.prepare("UPDATE `" + this.tablename + "` SET `repairtime` = '?' WHERE `id` IN (?)", function (err, statement) {
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

module.exports = BrokenTests;