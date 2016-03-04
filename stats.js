const EventEmitter = require('events');
const util = require('util');

var Stats = function () {
    this.tests = [];

    this.getWebStats = function() {
        var stats_data = this.getStatsData();
        return JSON.stringify(stats_data);
    };

    this.getRawStats = function () {
        var time_overall = 0;
        var tests_failed = [];
        var tests_completed = [];

        for (var key in this.tests) {
            var test = this.tests[key];
            time_overall += test.time;

            if (test.status === false) {
                tests_failed.push(test);
            }
            else {
                tests_completed.push(test);
            }
        }

        return {
            'time_overall': time_overall,
            'tests_failed': tests_failed,
            'tests_completed': tests_completed,
        };
    };

    this.getStatsData = function () {
        var raw_stats = this.getRawStats();

        var failed_tests_names = [];
        var failed_test_suites = [];

        for (var key in raw_stats.tests_failed) {
            var test = raw_stats.tests_failed[key];
            failed_tests_names.push(test.file);

            test_suite = [];

            for (var index in test.suites) {
                var suite = test.suites[index];
                if (suite.status == 'fail') {
                    stat_msg = "\t\t" + suite.test + " [" + suite.message + "]\n";
                    test_suite.push(stat_msg);
                }
            }

            failed_test_suites.push(test_suite);
        }

        return {
            'tests_overall_count': this.tests.length,
            'tests_success_count': raw_stats.tests_completed.length,
            'tests_failed_count': raw_stats.tests_failed.length,
            'time_average': raw_stats.time_overall / this.tests.length,
            'time_overall': raw_stats.time_overall,
            'failed_tests_names': failed_tests_names,
            'failed_tests_suites': failed_test_suites,
        };
    };

    this.getConsoleStats = function () {
        var stat_msg = '';
        var stats_data = this.getStatsData();

        if (this.tests.length > 0) {
            stat_msg = "\nПройдено " + stats_data.tests_success_count + "/" + stats_data.tests_overall_count + " тестов\n" +
                    "Общее время выполнения: " + stats_data.time_overall + "ms" + "\n" +
                    "Среднее время выполнения: " + stats_data.time_average + "ms";

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
        this.tests = [];
    };

    EventEmitter.call(this);
};

util.inherits(Stats, EventEmitter);

module.exports = new Stats();
