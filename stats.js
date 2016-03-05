const EventEmitter = require('events');
const util = require('util');

var Stats = function () {
    /** @type {number} Время старта раздач тестов клиентам, миллисекунды */
    this.start_time = 0;
    /** @type {number} Время выполнения последнего теста, миллисекунды */
    this.finish_time = 0;

    this.tests = [];

    this.getWebStats = function() {
        var stats_data = this.getStatsData();
        return JSON.stringify(stats_data);
    };

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

        raw_stats.tests_failed.forEach(function(test) {
            failed_tests_names.push(test.file);

            var test_suite = [];

            test.suites.forEach(function(suite) {
                if (suite.status == 'fail') {
                    var stat_msg = "\t\t" + suite.test + " [" + suite.message + "]\n";
                    test_suite.push(stat_msg);
                }
            });

            failed_test_suites.push(test_suite);
        });

        if (this.finish_time > 0) {
            time_pool = ((this.finish_time - this.start_time) / 1000).toFixed(4) + " сек.";
        }

        return {
            'tests_overall_count': this.tests.length,
            'tests_success_count': raw_stats.tests_completed.length,
            'tests_failed_count': raw_stats.tests_failed.length,
            'time_average': raw_stats.time_overall / this.tests.length,
            'time_overall': raw_stats.time_overall,
            'time_pool' : time_pool,
            'failed_tests_names': failed_tests_names,
            'failed_tests_suites': failed_test_suites
        };
    };

    this.getConsoleStats = function () {
        var stat_msg = '';
        var stats_data = this.getStatsData();

        if (this.tests.length > 0) {
            stat_msg = "\nУспешно пройдено " + stats_data.tests_success_count + "/" + stats_data.tests_overall_count + " тестов\n"
                + "Время выполнения последнего пула тестов: " + stats_data.time_pool + "\n"
                + "Общее время выполнения тестов в PHPUnit: " + stats_data.time_overall + " сек.\n"
                + "Среднее время выполнения тестов в PHPUnit: " + stats_data.time_average + " сек.\n";

            if (stats_data.tests_failed_count > 0) {
                stat_msg += "\nЗавалены тесты: \n";

                stats_data.failed_tests_suites.forEach(function(item, i) {
                    stat_msg += "\t" + stats_data.failed_tests_names[i] + "\n";
                    stat_msg += stats_data.failed_tests_suites[i];
                });
            }

        }
        else {
            stat_msg = "\nТесты не пройдены";
        }

        return stat_msg;
    };

    this.addStat = function (data) {
        this.tests.push(data);
    };

    this.resetStats = function () {
        this.start_time = 0;
        this.finish_time = 0;
        this.tests = [];
    };

    EventEmitter.call(this);
};

util.inherits(Stats, EventEmitter);

module.exports = new Stats();
