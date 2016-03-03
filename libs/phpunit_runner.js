var fs = require('fs');

var PhpUnitRunner = function () {
    this.show_log = false;
    this.phpunit_cmd = '';
    this.result_json_file = '';
    this.run = function (file, callback) {
        var self = this;
        var sh = self.phpunit_cmd+' --tap --log-json '+self.result_json_file+' '+file+' ';

        var exec = require('child_process').exec;
        var child = exec(sh);
        child.stdout.on('data', function(data) {
            self.log(data);
        });
        child.stderr.on('data', function(data) {
            self.log(data);
        });
        child.on('close', function(code) {
            fs.readFile(self.result_json_file, 'utf8', function (err, data) {
                if (err) throw err;

                data = data.replace(/\}\{/ig, '},{'); // @see https://github.com/sebastianbergmann/phpunit/issues/1156
                data = '['+data+']';

                try {
                    var obj = JSON.parse(data);

                    var test_status = true;
                    var test_time = 0;
                    var test_suites = [];

                    for (var i in obj) {
                        var test = obj[i];
                        if (test.event == 'test') {
                            test_suites.push(test);
                            test_time += test.time;
                            if (test.status == 'fail') {
                                test_status = false;
                            }
                        }
                    }

                    if (callback != undefined) {
                        callback({'file':file, 'time':test_time, 'status':test_status, 'suites':test_suites});
                    }
                    self.log('Test execution is completed - '+file);
                } catch (e) {
                    if (callback != undefined) {
                        callback({'file':file, 'status':false, 'time':0, 'suites':[]});
                    }
                    self.log(e.message);
                }
            });
        });
        this.log = function (data) {
            if (!this.show_log) {
                return;
            }

            console.log(data);
        }
    };
};

module.exports = new PhpUnitRunner();