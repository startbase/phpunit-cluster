var mysql = require('mysql2');

var colors = require('colors/safe');
colors.setTheme({
	info: 'green',
	data: 'grey',
	debug: 'blue',
	error: 'red'
});

/**
 * Вырезает из suite теста подробное описание ошибки
 * До: GKPZ\GKPZRowTest::testGetApprovalDepartmentCheckRequired with data set #1 (2, true) [Failed asserting that false matches expected true.]
 * После: GKPZRowTest::testGetApprovalDepartmentCheckRequired with data set #1 (2, true)
 *
 * @param {string} suite
 * @returns {string}
 */
function getTestSuite(suite) {
	console.log(colors.data('Парсим название теста'));
	console.log(colors.data('До: ' + suite));

	/** Вырезаем описание ошибки (справа) */
	var position = suite.indexOf(" [Failed ");
	suite = suite.substring(0, position);

	/** Вырезаем путь теста (слева) */
	position = suite.lastIndexOf("\\");
	suite = suite.substring(position + 1);

	/** Заменяем одинарные ковычки на двойные */
	suite = suite.replace(/'/g, '"');

	console.log(colors.data('После: ' + suite));

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

	/** Название таблицы в БД */
	this.tablename = config.logAgregator.tables.broken_tests;

	/** Установка соединения с БД */
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
			'`broke_commit` VARCHAR(255) NOT NULL "",' +
			'`broke_authors` VARCHAR(255) NOT NULL DEFAULT "",' +
			'`broke_date` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,' +
			'`repair_commit` VARCHAR(255) NOT NULL "",' +
			'`repair_authors` VARCHAR(255) NOT NULL DEFAULT "",' +
			'`repair_date` TIMESTAMP NOT NULL DEFAULT "0000-00-00 00:00:00",' +
			'PRIMARY KEY (`id`)' +
			') COLLATE="utf8_general_ci" ENGINE=InnoDB';

		connection.query(query, function (err, result) {

			if (err) {
				console.log(colors.error('[MYSQL] BROKEN TESTS ERROR (init):'));
				console.log(colors.error(err));
			}

			connection.close();
		});
	};

	/**
	 * Обновление сломаных тестов. Вызывается после выполнения пула
	 * в callback-е функции получения тестов
	 *
	 * @param data данные из статистики
	 * @param broken_tests сломаные тесты
	 */
	this.update = function (data, broken_tests) {
		console.log(colors.info('Запускаем обновление сломаных тестов'));
		console.log(colors.data('Список имеющихся сломаных тестов:'));
		console.log(colors.data(broken_tests));

		var self = this;

		/** Если у нас нет сломаных тестов и последний пул ничего не сломал - ничего не делаем */
		if (broken_tests.length == 0 && data.tests_failed_count == 0) {
			console.log(colors.info('Сломаных тестов нет и последний пул ничего не сломал'));
			return;
		}

		/** Если у нас нет сломаных тестов, но последний пул какие-то сломал - добавляем их в базу */
		if (broken_tests.length == 0 && data.tests_failed_count > 0) {
			console.log(colors.info('Сломаных тестов нет, но последний пул что-то сломал'));
			data.failed_tests_suites.forEach(function (test) {
				test.forEach(function (suite) {
					var broken_suite = {
						suitename: getTestSuite(suite),
						broke_commit: data.commit_hash,
						broke_authors: getCommitAuthors(data.commit_history)
					};

					self.addBrokenTest(broken_suite);
				});
			});

			return;
		}

		/** Если у нас есть сломаные тесты и последний пул всё починил - обновляем дату починки */
		if (broken_tests.length > 0 && data.tests_failed_count == 0) {
			console.log(colors.info('Есть сломаные тесты, но последний пул всё починил'));
			var ids = [];

			broken_tests.forEach(function (item) {
				ids.push(item[0]);
			});

			console.log(colors.debug('Список ID тестов, которые поправлены:'));
			console.log(colors.debug(ids));

			if (ids.length > 0) {
				this.repairTests(ids, data);
			}

			return;
		}

		/** Если у нас есть сломаные тесты и последний пул тоже имеет сломаные тесты - сравнить и обновить/добавить */
		if (broken_tests.length > 0 && data.tests_failed_count > 0) {
			console.log(colors.info('Есть сломаные тесты и последний пул что-то сломал'));

			var suites = [];
			data.failed_tests_suites.forEach(function (test) {
				test.forEach(function (suite) {
					suites.push(getTestSuite(suite));
				});
			});

			console.log(colors.debug('Список поломанных тестов из пула:'));
			console.log(colors.debug(suites));

			var repair_ids = [];

			console.log(colors.debug('Сравним с уже сломаными тестами...'));

			broken_tests.forEach(function (test) {
				console.log(colors.debug('Ищем ' + test[1]));
				var position = suites.indexOf(test[1]);
				/**
				 * Если сломаного теста нет в результатах пула - его починили
				 * Иначе, он там есть и его сохранять снова не нужно - удаляем из suites
				 */
				if (position == -1) {
					console.log(colors.debug('Позиция: ' + position + ' ; Теста нет в пуле => его исправили!'));
					repair_ids.push(test[0]);
				} else {
					console.log(colors.debug('Позиция: ' + position + ' ; Тест есть в пуле => его не нужно сохранять'));
					suites.splice(position, 1);
				}
			});

			console.log(colors.debug('Список исправленных тестов:'));
			console.log(colors.debug(repair_ids));
			console.log(colors.debug('Список новых сломаных тестов:'));
			console.log(colors.debug(suites));

			/**
			 * Сейчас у нас есть два массива:
			 * repair_ids - ID тестов, которые починили
			 * suites - новые сломаные тесты
			 */
			if (repair_ids.length > 0) {
				this.repairTests(repair_ids, data);
			}

			if (suites.length > 0) {
				suites.forEach(function (suite) {
					self.addBrokenTest({
						suitename: suite,
						broke_commit: data.commit_hash,
						broke_authors: getCommitAuthors(data.commit_history)
					});
				});
			}
		}
	};

	/**
	 * Получаем список сломаных тестов
	 * @param callback
	 */
	this.getBrokenTests = function (callback) {
		var connection = this.getNewConnection();
		var options = { sql: 'SELECT `id`, `suitename` FROM `' + this.tablename + '` WHERE `repair_date` = "0000-00-00 00:00:00"', rowsAsArray: true };

		connection.query(options, function(err, results) {
			if (err) {
				console.log(colors.error('[MYSQL] BROKEN TESTS ERROR (getBrokenTests):'));
				console.log(colors.error(err));
			} else {
				console.log(colors.debug(options.sql));
			}

			callback(results);

			connection.close();
		});
	};

	/**
	 * Добавляем новый сломаный тест в БД
	 * @param data Формат { suitename, broke_commit, broke_authors }
	 */
	this.addBrokenTest = function (data) {
		var connection = this.getNewConnection();
		var query = "INSERT INTO `" + this.tablename + "` (`suitename`, `broke_commit`, `broke_authors`) VALUES ('" + data.suitename + "', '" + data.broke_commit + "', '" + data.broke_authors + "')";

		connection.query(query, function(err, result) {
			if (err) {
				console.log(colors.error('[MYSQL] BROKEN TESTS ERROR (addBrokenTest):'));
				console.log(colors.error(err));
			} else {
				console.log(colors.debug(query));
			}

			connection.close();
		});
	};

	/**
	 * Обновляем статус тестов на исправленные
	 * @param {Array} ids Массив ID тестов, которые починили
	 * @param data Данные, получаемые из статистики
	 */
	this.repairTests = function (ids, data) {
		var connection = this.getNewConnection();
		var commit = data.commit_hash;
		var commit_authors = getCommitAuthors(data.commit_history);

		var query = "UPDATE `" + this.tablename + "` SET `repair_commit` = '" + commit + "', `repair_authors` = '" + commit_authors + "', `repair_date` = FROM_UNIXTIME('" + new Date().getTime() + "') WHERE `id` IN (" + ids.join() + ")";

		connection.query(query, function(err, result) {
			if (err) {
				console.log(colors.error('[MYSQL] BROKEN TESTS ERROR (repairTests):'));
				console.log(colors.error(err));
			} else {
				console.log(colors.debug(query));
			}

			connection.close();
		});
	};

	this.init();
};

module.exports = BrokenTests;
