var fs = require('fs');

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

var PhpUnitRunner = function (settings) {

	this.show_log = false;
	this.phpunit_cmd = settings['cmd'];
    this.phpunit_cmd_suffix = settings['cmd_suffix'];
    this.result_json_file = settings['result_json_file'];

    this.run = function (file, callback) {
		var self = this;
        var exec = require('child_process').exec;

		/**
		 * Перед запуском теста удалим result.json, т.к. при ошибке в phpunit (например: Class ... could not be found in ...)
		 * в нём будут храниться старые данные - а по факту тест не запускался
		 */

		fs.unlink(self.result_json_file, function () {
			var sh = self.phpunit_cmd + ' ' + self.phpunit_cmd_suffix + ' --tap --log-json ' + self.result_json_file + ' ' + file;
			var child = exec(sh);

			child.stdout.on('data', function(data) {
				self.log(data);
			});

			child.stderr.on('data', function(data) {
				self.log(data);
			});

			child.on('close', function(code) {
				/** PHPUnit закончил выполнение, попытаемся прочитать лог файл */
				fs.readFile(self.result_json_file, 'utf8', function (err, data) {
					if (!err) {
						data = data.replace(/\}\{/ig, '},{'); // @see https://github.com/sebastianbergmann/phpunit/issues/1156

						try {
							var obj = JSON.parse('[' + data + ']');
							/** @type {boolean} Статус теста */
							var test_status = true;
							/** @type {number} Время выполнения теста */
							var test_time = 0;
							/** @type {Array} Массив сьютов */
							var test_suites = [];

							for (var i in obj) {
								var suite = obj[i];

								if (suite.event == 'test') {
									test_suites.push(suite);
									test_time += suite.time;

									/**
									 * Если статус теста отличается от PASS
									 * и тест не Skipped или Incomplete, тогда тест завален
									 */
									if (suite.status != 'pass' && !isSuiteSkipOrIncomplete(suite.message)) {
										test_status = false;
									}
								}
							}

							if (callback != undefined) {
								callback({ file: file, time: test_time, status: test_status, suites: test_suites });
							}

							self.log('Test execution is completed - ' + file);
						} catch (e) {
							if (callback != undefined) {
								callback({ file: file, status: false, time: 0, suites: [] });
							}
							self.log(e.message);
						}

					} else {
						if (callback != undefined) {
							callback({ file: file, status: false, time: 0, suites: [] });
						}
						self.log('PHPUnit не создал файл result.json для теста ' + file + '. Или его не удалось прочитать');
					}
				});
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

module.exports = PhpUnitRunner;
