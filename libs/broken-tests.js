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
	/** Вырезаем описание ошибки (справа) */
	var position = suite.indexOf(" [Failed ");
	suite = suite.substring(0, position);

	/** Вырезаем путь теста (слева) */
	position = suite.lastIndexOf("\\");
	suite = suite.substring(position + 1);

	/** Заменяем одинарные ковычки на двойные */
	suite = suite.replace(/'/g, '"');

	return suite;
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
			'`first_commit` VARCHAR(255) NOT NULL,' +
			'`commit_authors` VARCHAR(255) NOT NULL DEFAULT "",' +
			'`broketime` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,' +
			'`repairtime` TIMESTAMP NOT NULL DEFAULT "0000-00-00 00:00:00",' +
			'PRIMARY KEY (`id`)' +
			') COLLATE="utf8_general_ci" ENGINE=InnoDB';

		connection.query(query, function (err, result) {

			if (err) {
				console.log("[MYSQL] BROKEN TESTS ERROR:");
				console.log(err);
			}

			connection.close();
		});
	};

	this.update = function (data, broken_tests) {
		console.log('Broken tests:');
		console.log(broken_tests);

		var self = this;

		/** Если у нас нет сломаных тестов и последний пул ничего не сломал - ничего не делаем */
		if (broken_tests.length == 0 && data.tests_failed_count == 0) {
			console.log('Broken tests: у нас нет сломаных тестов и последний пул ничего не сломал - ничего не делаем');
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

			console.log('New broken tests (before)');
			console.log(suites);

			var repair_ids = [];

			broken_tests.forEach(function (test) {
				console.log('Compare: ' + test[1]);
				var position = suites.indexOf(test[1]);
				/**
				 * Если сломаного теста нет в результатах пула - его починили
				 * Иначе, он там есть и его сохранять снова не нужно - удаляем из suites
				 */
				if (position == -1) {
					console.log('Result: "' + position + '" -> NOT in array (тест починили)');
					repair_ids.push(test[0]);
				} else {
					console.log('Result: "' + position + '" -> EXIST in array (тест уже сломан, сохранять не нужно и удалим из suite)');
					suites.splice(position, 1);
				}
			});

			console.log('New broken tests (after)');
			console.log(suites);
			console.log('\n');
			console.log('Repair tests:');
			console.log(repair_ids);

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
				console.log("[MYSQL] BROKEN TESTS ERROR:");
				console.log(err);
				console.log(options.sql);
			} else {
				console.log('GOOD: ' + options.sql);
			}

			callback(results);

			connection.close();
		});
	};

	this.addBrokenTest = function (data) {
		var connection = this.getNewConnection();
		var query = "INSERT INTO `" + this.tablename + "` (`suitename`, `first_commit`, `commit_authors`) VALUES ('" + data.suitename + "', '" + data.first_commit + "', '" + data.commit_authors + "')";

		connection.query(query, function(err, result) {
			if (err) {
				console.log("[MYSQL] BROKEN TESTS ERROR:");
				console.log(err);
				console.log(query);
			} else {
				console.log('GOOD: ' + query);
			}

			connection.close();
		});
	};

	this.repairTests = function (ids) {
		var connection = this.getNewConnection();
		var query = "UPDATE `" + this.tablename + "` SET `repairtime` = FROM_UNIXTIME('" + new Date().getTime() + "') WHERE `id` IN (" + ids.join() + ")";

		connection.query(query, function(err, result) {
			if (err) {
				console.log("[MYSQL] BROKEN TESTS ERROR:");
				console.log(err);
				console.log(query);
			} else {
				console.log('GOOD: ' + query);
			}

			connection.close();
		});
	};

	this.init();
};

module.exports = BrokenTests;