var Config = new (require('../config'));
var settings = Config.getParams();
var DB = new (require('../libs/db'))(settings['mysql']);

/**
* Вырезает из suite теста подробное описание ошибки
* До: GKPZ\GKPZRowTest::testGetApprovalDepartmentCheckRequired with data set #1 (2, true) [Failed asserting that false matches expected true.]
* После: GKPZRowTest::testGetApprovalDepartmentCheckRequired with data set #1 (2, true)
*
* @param {string} suite
* @returns {string}
*/
function getTestSuite(suite) {
	console.log('Парсим название теста');
	console.log('До: ' + suite);

	/** Вырезаем описание ошибки (справа) */
	var position = suite.indexOf(" [Failed ");
	if (position > 0) {
		suite = suite.substring(0, position);
	}

	/** Вырезаем SQL ошибку (справа) */
	position = suite.indexOf(" [SQL ERROR: ");
	if (position > 0) {
		suite = suite.substring(0, position);
	}

	/** Вырезаем путь теста (слева) */
	position = suite.lastIndexOf("\\");
	if (position > 0) {
		suite = suite.substring(position + 1);
	}

	/** Заменяем одинарные ковычки на двойные */
	suite = suite.replace(/'/g, '"');

	console.log('После: ' + suite);

	return suite;
}

/**
* Вырезает из истории коммитов автора(-ов) и возвращает в виде массива
*
* @param {Array} commits_merge
* @returns {Array}
*/
function getCommitAuthors(commits_merge) {
	if (commits_merge.length == 0) {
		return [];
	}

	var authors = [];
	commits_merge.forEach(function (commit) {
		var author = commit.author_email;

		if (authors.indexOf(author) == -1) {
			authors.push(author);
		}
	});

	return authors;
}

/**
* Функция для поиска имеющегося сломаного теста в результатах пула
*
* @param {Array} suites массив сломаных тестов из пула в формате [ [path_1, suite_1], [path_N, suite_N] ]
* @param {string} path путь файла с тестом
* @param {string} suite
* @returns {number}
*/
function getSuiteIndex(suites, path, suite) {
	for (var i = 0; i < suites.length; i++) {
		if (suites[i]['path'] === path && suites[i]['suitename'] === suite) {
			return i;
		}
	}

	return -1;
}

var BrokenTests = function () {

	/** Название таблицы из конфига */
	this.tablename = settings['mysql']['tables']['broken_tests'];

	/** Путь репозитория */
	this.repository = settings['repository']['repository_path'];

	/** Создание таблицы */
	this.createTable = function () {
		var sql = "CREATE TABLE IF NOT EXISTS `" + this.getTableName() + "` (" +
			"`id` INT(11) NOT NULL AUTO_INCREMENT," +
			"`path` VARCHAR(255) NOT NULL DEFAULT ''," +
			"`suitename` TEXT NOT NULL," +
			"`broke_commit` VARCHAR(255) NOT NULL DEFAULT ''," +
			"`broke_authors` VARCHAR(255) NOT NULL DEFAULT ''," +
			"`broke_date` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
			"`repair_commit` VARCHAR(255) NOT NULL DEFAULT ''," +
			"`repair_authors` VARCHAR(255) NOT NULL DEFAULT ''," +
			"`repair_date` TIMESTAMP NOT NULL DEFAULT '0000-00-00 00:00:00'," +
			"PRIMARY KEY (`id`)" +
			") COLLATE='utf8_general_ci' ENGINE=InnoDB";

		this.query(sql);
	};

	/**
	 * Получаем список сломаных тестов, в формате:
	 * { id, path, suitename, broke_authors }
	 *
	 * @param callback
	 */
	this.getBrokenTests = function (callback) {
		var condition = ['repair_date = "0000-00-00 00:00:00"'];
		var params = [];

		params['select'] = ['id', 'path', 'suitename', 'broke_authors'];
		this.findAll(condition, params, function (rows) {
			callback(rows);
		});
	};

	/**
	 * Добавляем новый сломаный тест в БД
	 * @param test Формат { path, suitename, broke_commit, broke_authors }
	 */
	this.addBrokenTest = function (test) {
		var sql = "INSERT INTO `" + this.getTableName() + "` (`path`, `suitename`, `broke_commit`, `broke_authors`) VALUES ('" + test.testpath + "', '" + test.suitename + "', '" + test.broke_commit + "', '" + test.broke_authors + "')";

		this.query(sql);
	};

	/**
	 * Обновляем статус тестов на исправленные
	 * @param {Array} ids Массив ID тестов, которые починили
	 * @param stats_data Данные, получаемые из статистики
	 */
	this.repairTests = function (ids, stats_data) {
		var commit = stats_data.commit_hash;
		var commit_authors = getCommitAuthors(stats_data.commits_merge).join(', ');
		var sql = "UPDATE `" + this.getTableName() + "` SET `repair_commit` = '" + commit + "', `repair_authors` = '" + commit_authors + "', `repair_date` = FROM_UNIXTIME(" + new Date().getTime() + ") WHERE `id` IN (" + ids.join(', ') + ")";

		this.query(sql);
	};

	/**
	* Обновление сломаных тестов. Вызывается после выполнения пула
	* в callback-е функции получения тестов
	*
	* @param data данные из статистики
	* @param old_failed_tests сломаные тесты из базы
	* @param callback
	*/
	this.update = function (data, old_failed_tests, callback) {
		var self = this;

		console.log('Запускаем обновление сломаных тестов');
		console.log('Список имеющихся сломаных тестов:');
		console.log(old_failed_tests);

		var new_failed_tests = data.failed_tests;

		/** Если у нас нет сломаных тестов и последний пул ничего не сломал - ничего не делаем */
		if (old_failed_tests.length == 0 && new_failed_tests.length == 0) {
			console.log('Сломаных тестов нет и последний пул ничего не сломал');
			callback(null);
			return;
		}

		/** @type {Array} Список коммитеров последнего пула */
		var commit_authors = getCommitAuthors(data.commits_merge);
		/** @type {Array} Новые сломанные тесты из пула в формате { id (-1), path, suitename } */
		var broken_tests = [];
		/** @type {Array} Исправленные тесты из пула в формате { id, path, suitename, broke_authors } */
		var repair_tests = [];
		/** @type {Array} Список ID исправленных тестов */
		var repair_tests_ids = [];

		/** Сформируем удобный список новых сломанных тестов */
		for (var pathname in new_failed_tests) {
			if (new_failed_tests.hasOwnProperty(pathname)) {
				new_failed_tests[pathname].forEach(function (suite) {
					broken_tests.push({
						id: -1,
						path: pathname.replace(self.repository + '/', ''),
						suitename: getTestSuite(suite)
					});
				});
			}
		}

		console.log('Список поломанных тестов из пула:');
		console.log(broken_tests);
		console.log('Сравним с уже сломаными тестами...');

		if (old_failed_tests.length > 0) {
			old_failed_tests.forEach(function (test) {
				console.log('Ищем ' + test['path'] + ' -> ' + test['suitename']);

				var suite_index = getSuiteIndex(broken_tests, test['path'], test['suitename']);

				/**
				 * Если сломаного теста нет в результатах пула - его починили
				 * Иначе, он там есть и его сохранять снова не нужно - удаляем из suites
				 */
				if (suite_index == -1) {
					console.log('Позиция: ' + suite_index + ' ; Теста нет в пуле => его исправили!');
					repair_tests_ids.push(test['id']);
					repair_tests.push({
						id: test['id'],
						path: test['path'],
						suitename: test['suitename'],
						broke_authors: test['broke_authors']
					});
				} else {
					console.log('Позиция: ' + suite_index + ' ; Тест есть в пуле => его не нужно сохранять');
					broken_tests.splice(suite_index, 1);
				}
			});
		}

		console.log('Список исправленных тестов:');
		console.log(repair_tests_ids);
		console.log('Список новых сломаных тестов:');
		console.log(broken_tests);

		/**
		* Сейчас у нас есть два массива:
		* repair_tests_ids - ID тестов, которые починили
		* broken_tests - новые сломаные тесты
		*/
		if (repair_tests_ids.length > 0) {
			this.repairTests(repair_tests_ids, data);
		}

		if (broken_tests.length > 0) {
			broken_tests.forEach(function (suite) {
				self.addBrokenTest({
					testpath: suite['path'],
					suitename: suite['suitename'],
					broke_commit: data.commit_hash,
					broke_authors: commit_authors.join(', ')
				});
			});
		}

		var dataForNotification = {
			broken_tests: broken_tests,
			repair_tests: repair_tests,
			commit_authors: commit_authors,
			commit_hash: data.commit_hash
		};

		callback(dataForNotification);
	};

	this.createTable();
};

BrokenTests.prototype = DB;
module.exports = BrokenTests;
