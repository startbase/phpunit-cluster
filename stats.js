const EventEmitter = require('events');
const util = require('util');

var Stats = function () {
    this.tests = [];

    this.getStats = function () {
        var time_overall = 0;
        var tests_failed = [];
        var tests_completed = [];

        for (var key in this.tests) {
            var test = this.tests[key];
            time_overall += test.time;

            console.log(test.status);

            if (test.status=='fail') {
                tests_failed.push(test);
            }
            else {
                tests_completed.push(test);
            }
        }

        var stat_msg = "\nПройдено " + tests_completed.length + " тестов из " + this.tests.length + "\n";

        if (tests_failed.length > 0) {
            stat_msg += "Завалены тесты: \n";

            for (test in tests_failed) {
                stat_msg += "\t\t" + test.file + "\n";
            }
        }

        return stat_msg;
    };

    this.addStat = function (data) {
        console.log("DATA", data);
        console.log('\n\n');
        this.tests.push(data);
    };

    this.resetStats = function () {
        this.tests = [];
    };

    EventEmitter.call(this);
};

util.inherits(Stats, EventEmitter);

module.exports = new Stats();
