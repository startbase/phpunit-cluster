var phpunit_runner = require('./libs/phpunit_runner.js');

var config = require('./config.js');
var config_params = config.getParams();

phpunit_runner.phpunit_cmd = config_params.phpunit_runner.cmd;
phpunit_runner.result_json_file_path = config_params.phpunit_runner.result_json_file_path;
phpunit_runner.result_json_suffix = config_params.phpunit_runner.result_json_suffix;
phpunit_runner.show_log = false;

phpunit_runner.run('../phpunit-cluster-tests/examples/a1/a1Test.php', function(data) {
    console.log(data.file, data.status, data.time);
});

phpunit_runner.run('../phpunit-cluster-tests/examples/a1/a2Test.php', function(data) {
    console.log(data.file, data.status, data.time);
});