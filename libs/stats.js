var Stats = function () {
	/**
	 * @type {number} Время старта раздачи тестов, миллисекунды
	 */
	this.start_time = 0;

	/**
	 * @type {number} Время завершения выполнения билда, миллисекунды
	 */
	this.finish_time = 0;

	/**
	 * @type {Array} Данные по всем выполненным тестам от клиента
	 */
	this.tests = [];

	/**
	 * @type {number} Изначальное количество тестов в билде
	 */
	this.build_tasks_count = 0;

	/**
	 * @type {number} Суммарное время повторных выполнений заваленных тестов, секунды
	 */
	this.phpunit_repeat_time = 0;

	/**
	 * @type {string} Текущий коммит хеш билда
	 */
	this.commit_hash = '';

	/**
	 * @type {Array} История коммитов. попавших в билд
	 */
	this.commits_merge = [];

	/**
	 * Метод обрабатывает данные билда и готовит их для записи в БД или использования в ВЕБе
	 *
	 * @returns {Object}
	 */
	this.processData = function () {
		var self = this;

		var build_time = 0;
		if (this.finish_time > 0) {
			build_time = (this.finish_time - this.start_time) / 1000;
		}

		var phpunit_time = 0;
		var failed_tests = {};
		this.tests.forEach(function(test) {
			phpunit_time += test.time;

			if (test.status === false) {
				var file_path = test.file;
				if (!(file_path in failed_tests)) {
					failed_tests[file_path] = [];
				}

				var test_suites = [];
				test.suites.forEach(function(suite) {
					/**
					 * Если статус теста отличается от PASS
					 * и тест не Skipped или Incomplete, тогда тест завален
					 */
					if (suite.status != 'pass' && !self.isSuiteSkipOrIncomplete(suite.message)) {
						var stat_msg = suite.test + " [" + suite.message + "]";
						test_suites.push(stat_msg);
					}
				});

				failed_tests[file_path] = test_suites;
			}
		});

		return {
			'build_time': build_time.toFixed(4),
			'phpunit_time': phpunit_time.toFixed(4),
			'phpunit_repeat_time': this.phpunit_repeat_time,
			'test_avg_time': (phpunit_time / this.tests.length).toFixed(4),
			'tests_total_count': this.build_tasks_count,
			'commit_hash': this.commit_hash,
			'commits_merge': this.commits_merge,
			'failed_tests': failed_tests
		};
	};

	/**
	 * Метод выводит краткую статистику билда в консоль сервера
	 *
	 * @returns {string}
	 */
	this.getDataForConsole = function () {
		if (this.finish_time == 0) {
			console.log('\nНе все тесты выполнены');
		}

		var data = this.processData();
		var message = '\n';
		message += 'Успешно пройдено ' + (data.tests_total_count - Object.keys(data.failed_tests).length) + '/' + data.tests_total_count + ' тестов\n';
		message += 'Время выполнения билда: ' + data.build_time + ' сек.\n';
		message += 'Время выполнения в PHPUnit: ' + data.phpunit_time + ' сек.\n';
		message += 'Время повтроного прохождения заваленых тестов в PHPUnit: ' + data.phpunit_repeat_time + ' сек.\n';
		message += 'Среднее время выполнения теста: ' + data.test_avg_time + ' сек.\n';

		if (Object.keys(data.failed_tests).length > 0) {
			message += 'Заваленные тесты:\n';

			for (var pathname in data.failed_tests) {
				if (data.failed_tests.hasOwnProperty(pathname)) {
					message += '\t' + pathname + '\n';

					data.failed_tests[pathname].forEach(function (suite) {
						message += '\t\t' + suite + '\n';
					});
				}
			}
		}

		return message;
	};

	/**
	 * Метод проверяет завален билд или нет.
	 * Если data не пустое, то проверит статистику текущего билда
	 *
	 * @param data
	 * @returns {boolean}
	 */
	this.isPoolFailed = function (data) {
		if (data.length > 0) {
			return Boolean(data.failed_tests);
		}

		return Boolean(this.processData().failed_tests.length);
	};

	/**
	 * Метод проверяет Skipped или Incomplete статус теста
	 *
	 * @param message сообщение из suite.message
	 * @returns {boolean}
	 */
	this.isSuiteSkipOrIncomplete = function (message) {
		var isSkip = message.indexOf('Skipped Test: ');
		var isIncomplete = message.indexOf('Incomplete Test: ');

		return (isSkip == 0 || isIncomplete == 0);
	};

	/**
	 * Метод возвращает процент завершения билда
	 *
	 * @returns {*}
	 */
	this.getPercentOfComplete = function () {
		var tests_total = this.build_tasks_count;
		var tests_complete = this.tests.length;

		if (tests_complete == 0) {
			return 0;
		}

		return (tests_complete * 100 / tests_total).toFixed(2);
	};

	/**
	 * Метод добавляет данные теста в статистику
	 *
	 * @param data
	 */
	this.add = function (data) {
		this.tests.push(data);
	};

	/**
	 * Метод сбрасывает все данные билда (обычно перед запуском нового билда)
	 */
	this.reset = function () {
		this.start_time = Date.now();
		this.finish_time = 0;
		this.tests = [];
		this.phpunit_repeat_time = 0;
		this.commits_merge = [];
	};
};

module.exports = Stats;
