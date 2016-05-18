const EventEmitter = require('events');
const util = require('util');
const fs = require('fs');

/**
 * Функция проверяет Skipped или Incomplete статус теста
 *
 * @param {string} message сообщение из suite.message
 * @returns {boolean}
 */
function isSuiteSkipOrIncomplete(message) {
    var isSkip = message.indexOf('Skipped Test: ');
    var isIncomplete = message.indexOf('Incomplete Test: ');

    return (isSkip == 0 || isIncomplete == 0);
}

var Stats = function () {
    /** @type {number} Время старта раздач тестов клиентам, миллисекунды */
    this.start_time = 0;
    /** @type {number} Время выполнения последнего теста, миллисекунды */
    this.finish_time = 0;

    this.count_tasks = 0;

    this.tests = [];

    this.phpunit_repeat = 0;

	this.commits_merge = [];
	this.commit_hash = '';

    this.getRawStats = function () {
        var time_overall = 0;
        var tests_failed = [];
        var tests_completed = [];

        this.tests.forEach(function(test) {
            time_overall += test.time;

            if (test.status === false) {
                tests_failed.push(test);
            } else {
                tests_completed.push(test);
            }
        });

        return {
            'time_overall': time_overall,
            'tests_failed': tests_failed,
            'tests_completed': tests_completed
        };
    };

    this.getStatsData = function () {
        var time_pool = 'нужно выполнить все тесты';
        var raw_stats = this.getRawStats();

        var failed_tests_names = [];
        var failed_test_suites = [];

        var all_tests_data = [];
        
        var failed_test_suites_names = {};
        
        raw_stats.tests_completed.forEach(function(test) {
            all_tests_data.push({path: test.file, status: 1});
        });

        raw_stats.tests_failed.forEach(function(test) {
            var file_path = test.file;
            failed_tests_names.push(file_path);

            var test_suites = [];

            test.suites.forEach(function(suite) {
				/**
				 * Если статус теста отличается от PASS
				 * и тест не Skipped или Incomplete, тогда тест завален
				 */
				if (suite.status != 'pass' && !isSuiteSkipOrIncomplete(suite.message)) {
                    var stat_msg = suite.test + " [" + suite.message + "]";
                    test_suites.push(stat_msg);
                }
            });

            failed_test_suites.push(test_suites);

            failed_test_suites_names[file_path] = test_suites;
            
            all_tests_data.push({path: test.file, status: 0});
        });

        if (this.finish_time > 0) {
            time_pool = (this.finish_time - this.start_time) / 1000;
        }

        return {
            'time_pool' : time_pool,
            'time_overall': raw_stats.time_overall,
			'phpunit_repeat_time': this.phpunit_repeat,
			'time_average': raw_stats.time_overall / this.tests.length,
			'tests_overall_count': this.tests.length,
            'tests_success_count': raw_stats.tests_completed.length,
            'tests_failed_count': raw_stats.tests_failed.length,
            'date_start': this.start_time,
            'date_finish': this.finish_time,
            'commit_hash': this.commit_hash,
			'commits_merge': this.commits_merge,
            'failed_tests_names': failed_tests_names,
            'failed_tests_suites': failed_test_suites,
			'failed_test_suites_names': failed_test_suites_names,
            'all_tests_data': all_tests_data
        };
    };

    this.getConsoleStats = function () {
        var stat_msg = '';
        var stats_data = this.getStatsData();

        if (this.tests.length > 0) {
            stat_msg = "\nУспешно пройдено " + stats_data.tests_success_count + "/" + stats_data.tests_overall_count + " тестов\n"
                + "Время выполнения последнего пула тестов: " + stats_data.time_pool + " сек.\n"
                + "Общее время выполнения тестов в PHPUnit: " + stats_data.time_overall + " сек.\n"
				+ "Общее время первых прохождений заваленых тестов в PHPUnit: " + stats_data.phpunit_repeat_time + " сек.\n"
                + "Среднее время выполнения тестов в PHPUnit: " + stats_data.time_average + " сек.\n";

            if (stats_data.tests_failed_count > 0) {
                stat_msg += "\nЗавалены тесты:\n";

				if (stats_data.failed_tests_names.length > 0) {
					stats_data.failed_tests_names.forEach(function (failed_test, i) {
						stat_msg += '\t' + failed_test + "\n";

						stats_data.failed_tests_suites[i].forEach(function (failed_suite) {
							stat_msg += '\t\t' + failed_suite + "\n";
						});
					});
				}
            }

        }
        else {
            stat_msg = "\nТесты не пройдены";
        }

        return stat_msg;
    };

	this.prepareForSave = function () {
		var data = this.getStatsData();

		delete data.failed_test_suites_names;
		delete data.all_tests_data;

		return data;
	};

	/**
	* Узнаём завален пул или нет
	* @param data данные могут быть переданы из БД или не переданы совсем
	* @returns {boolean}
	*/
	this.isPoolFailed = function (data) {
		if (data.tests_failed_count) {
			return Boolean(data.tests_failed_count);
		}

		return Boolean(this.getRawStats().tests_failed.length);
	};

	/**
	* Функция возвращает процент выполнения пула
	* @returns {*}
	*/
	this.getPercentOfComplete = function () {
		var tests_total = this.count_tasks;
		var tests_complete = this.tests.length;

		if (tests_complete == 0) {
			return 0;
		}

		return (tests_complete * 100 / tests_total).toFixed(2);
	};

    this.addStat = function (data) {
        this.tests.push(data);
    };

    this.resetStats = function () {
        this.start_time = 0;
        this.finish_time = 0;
        this.tests = [];
        this.count_tasks = 0;
        this.phpunit_repeat = 0;
		this.commit_hash = '';
		this.commits_merge = [];
    };

    EventEmitter.call(this);
};

util.inherits(Stats, EventEmitter);

module.exports = new Stats();