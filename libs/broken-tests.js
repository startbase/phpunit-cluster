var mysql = require('mysql2');

/**
 * �������� �� suite ����� ��������� �������� ������
 * ��: GKPZRowTest::testGetApprovalDepartmentCheckRequired with data set #1 (2, true) [Failed asserting that false matches expected true.]
 * �����: GKPZRowTest::testGetApprovalDepartmentCheckRequired with data set #1 (2, true)
 *
 * @param {string} suite
 * @returns {string}
 */
function getTestSuite(suite) {
	var position = suite.indexOf(" [Failed ");
	return suite.substring(0, position);
}

/**
 * �������� �� ������� �������� ������(-��) � ���������� � ���� ������
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

	console.log('CONFIG:\n');
	console.log(config);
	console.log('TABLE NAME:\n');
	console.log(this.tablename);

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

		console.log('QUERY:\n');
		console.log(query);

		connection.query(query, function (err, result) {

			if (err) {
				console.log("[MYSQL] BROKEN TESTS ERROR:\n".red);
				console.log(err);
			}

			console.log('INIT RESULT:\n');
			console.log(result);

			connection.close();
		});
	};

	this.update = function (data) {
		var self = this;
		var broken_tests = this.getBrokenTests();

		/** ���� � ��� ��� �������� ������ � ��������� ��� ������ �� ������ - ������ �� ������ */
		if (broken_tests.length() == 0 && data.tests_failed_count == 0) {
			return;
		}

		/** ���� � ��� ��� �������� ������, �� ��������� ��� �����-�� ������ - ��������� �� � ���� */
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

		/** ���� � ��� ���� �������� ����� � ��������� ��� �� ������� - ��������� ���� ������� */
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

		/** ���� � ��� ���� �������� ����� � ��������� ��� ���� ����� �������� ����� - �������� � ��������/�������� */
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
				 * ���� ��������� ����� ��� � ����������� ���� - ��� ��������
				 * �����, �� ��� ���� � ��� ��������� ����� �� ����� - ������� �� suites
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
			 * ������ � ��� ���� ��� �������:
			 * repair_ids - ID ������, ������� ��������
			 * suites - ����� �������� �����
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
		var options = { sql: 'SELECT `id`, `suitename` FROM `' + this.tablename + '` WHERE `repairtime` = "0"', rowsAsArray: true };

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