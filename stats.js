const EventEmitter = require('events');
const util = require('util');
const fs = require('fs');

var config = require('./config.js');
var configParams = config.getParams();

function cut(str, substr) {
    var cutStart = str.indexOf(substr);
    var cutEnd = cutStart + substr.length - 1;

    if (cutStart == -1) {
        return str;
    }
    
    return str.substr(0, cutStart) + str.substr(cutEnd+1);
}

var Stats = function () {
    /** @type {number} Время старта раздач тестов клиентам, миллисекунды */
    this.start_time = 0;
    /** @type {number} Время выполнения последнего теста, миллисекунды */
    this.finish_time = 0;

    this.count_tasks = 0;

    this.tests = [];

    this.phpunit_repeat = 0;

	this.commitLog = [];
	this.lastPoolFile = configParams.statistic.last_pool;

    this.processDirArr = function(dir_arr) {
        var base_dirs_raw = configParams.parser.baseDirs;
        var base_dirs = [];
        var new_dir_arr = [];

        base_dirs_raw.forEach(function(base_dir_raw) {
            base_arr = base_dir_raw.split('/');

            if (base_arr.indexOf('.') != - 1) {
                sl = -2;
            }
            else {
                sl = -1;
            }

            base_arr = base_arr.slice(0, sl);

            base_dir = base_arr.join('/');

            base_dirs.push(base_dir);
        });

        dir_arr.forEach(function(dir) {
            base_dirs.forEach(function(base_dir) {
                new_dir_arr.push(cut(dir, base_dir));
            });
        });

        return new_dir_arr;
    };

    this.getWebStats = function() {
        return this.getStatsData();
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

        var succeded_tests_names = [];

        var all_tests_data = [];
        
        var failed_test_suites_names = {};
        
        raw_stats.tests_completed.forEach(function(test) {
            succeded_tests_names.push(test.file);
            all_tests_data.push({path: test.file, status: 1});
        });

        raw_stats.tests_failed.forEach(function(test) {
            var file_path = test.file;
            failed_tests_names.push(file_path);

            var test_suites = [];

            test.suites.forEach(function(suite) {
                if (suite.status == 'fail') {
                    var stat_msg = suite.test + " [" + suite.message + "]\n";
                    test_suites.push(stat_msg);
                }
            });

            failed_test_suites.push(test_suites);

            failed_test_suites_names[file_path] = test_suites;
            
            all_tests_data.push({path: test.file, status: 0});
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
            'failed_tests_suites': failed_test_suites,
            'count_tasks': this.count_tasks,
            'succeded_tests_names': this.processDirArr(succeded_tests_names),
            'phpunit_repeat_time': this.phpunit_repeat,
            'all_tests_data': all_tests_data,
			'commit_history': this.commitLog
        };
    };

    this.getConsoleStats = function () {
        var stat_msg = '';
        var stats_data = this.getStatsData();

        if (this.tests.length > 0) {
            stat_msg = "\nУспешно пройдено " + stats_data.tests_success_count + "/" + stats_data.tests_overall_count + " тестов\n"
                + "Время выполнения последнего пула тестов: " + stats_data.time_pool + "\n"
                + "Общее время выполнения тестов в PHPUnit: " + stats_data.time_overall + " сек.\n"
				+ "Общее время первых прохождений заваленых тестов в PHPUnit: " + stats_data.phpunit_repeat_time + " сек.\n"
                + "Среднее время выполнения тестов в PHPUnit: " + stats_data.time_average + " сек.\n";

            if (stats_data.tests_failed_count > 0) {
                stat_msg += "\nЗавалены тесты: \n";

				if (stats_data.failed_tests_suites.length > 0) {
					stats_data.failed_tests_suites.forEach(function(item, i) {
						stat_msg += '\t' + stats_data.failed_tests_names[i] + "\n";
						stat_msg += '\t\t' + stats_data.failed_tests_suites[i] + "\n";
					});
				}
            }

        }
        else {
            stat_msg = "\nТесты не пройдены";
        }

        return stat_msg;
    };

	this.saveLastPool = function (commit_hash, callback) {
		var stats = this.getStatsData();

		var data = {
			branch: "integration",
			commit_hash: commit_hash,
			testsTotal: stats.tests_overall_count,
			testsSuccess: stats.tests_success_count,
			testsFailed: (stats.tests_overall_count - stats.tests_success_count),
			poolTime: stats.time_pool,
			phpunitTime: stats.time_overall,
			testsFailedList: []
		};

		if (stats.failed_tests_suites.length > 0) {
			stats.failed_tests_suites.forEach(function(item, i) {
				var test = {
					name: stats.failed_tests_names[i],
					suites: stats.failed_tests_suites[i]
				};

				data.testsFailedList.push(test);
			});
		}

		data = JSON.stringify(data);

		fs.writeFile(this.lastPoolFile, data, function(err) {
			if (err) throw err;

			callback();
		});
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
		this.commitLog = [];
    };

    EventEmitter.call(this);
};

util.inherits(Stats, EventEmitter);

module.exports = new Stats();
