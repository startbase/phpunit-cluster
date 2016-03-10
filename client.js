var path = require('path');

var config = require('./config.js');
var configParams = config.getParams();
var params = {
    user: 'startbase_' + Date.now(),
    domain: 'localhost',
    port: configParams.server_socket.port,
    commit_hash: 'none',
    version: configParams.version
};

var repository = require('./libs/repository.js');
var repository_updated = 0;

var is_task_aborted = false;

var phpunitRunner = require('./libs/phpunit_runner.js');
phpunitRunner.phpunit_cmd = configParams.phpunit_runner.cmd;
phpunitRunner.phpunit_cmd_suffix = configParams.phpunit_runner.cmd_suffix;
phpunitRunner.result_json_file = configParams.phpunit_runner.result_json_file;

/** Обработка аргументов */
var argv = require('minimist')(process.argv.slice(2));

if (argv.u && typeof argv.u == "string") { params.user = argv.u }
if (argv.d && typeof argv.d == "string") { params.domain = argv.d }
if (argv.p && typeof argv.p == "number") { params.port = argv.p }

/** Запускаемся */
var socket = require('socket.io-client')('http://' + params.domain + ':' + params.port);

console.log('[' + getDate() + '] Выбранный сервер: http://' + params.domain + ':' + params.port);
console.log('[' + getDate() + '] Запрашиваю статус сервера...');

socket.on('connect', function() {
    console.log('[' + getDate() + '] Сервер доступен. Присоединяюсь...');
});

socket.on('disconnect', function() {
	console.log('[' + getDate() + '] Сервер недоступен');
});

/**
 * Регистрация в системе
 *
 * Если участника нет в списках - сервер отправит запрос на регистрацию.
 * После прохождения регистрации вернётся событие "readyForJob" если репозитории совпадают.
 * Если не совпадают - сервер попросит обновить
 */
socket.on('needUserReg', function(server_version) {
	console.log('[' + getDate() + '] Проверяю версию клиента...');

	if (server_version != params.version) {
		console.log('[' + getDate() + '] Версия клиента корректна! Регистрируюсь в системе');
		socket.emit('registerUser', { username: params.user });
	} else {
		console.log('[' + getDate() + '] Версия клиента не подходит для работы с сервером. Обновись!');
		process.exit(0);
	}
});

/**
 * Готовность к работе
 *
 * Наступает после регистрации или выполнения задачи.
 * Участник запрашивает у сервера свободную задачу.
 */
socket.on('readyForJob', function() {
	console.log('[' + getDate() + '] Готов для работы!');
	socket.emit('getTask');
});

/**
 * Обновляем репозитарий и просим дать задачу
 */
socket.on('updateRepository', function() {
    console.log('[' + getDate() + '] Обновляю репозиторий...');

    repository_updated = 0;
    repository.update(function () {
        repository_updated = 1;
        console.log('[' + getDate() + '] Беру задачу из пула...');
        socket.emit('getTask');
    });
});

/**
 * Выполнение задачи
 *
 * Участник выполняет задачу и отправляет результаты серверу.
 */
socket.on('processTask', function(task) {
    console.log('[' + getDate() + '] Выполняю задачу ID: ' + task.taskName);

    var test_path = path.resolve(configParams.repository.repository_path, task.taskName);
    phpunitRunner.run(test_path, function (response) {
        if (is_task_aborted) {
            is_task_aborted = false;
            console.log('[' + getDate() + '] Произошла очистка очереди, задание было отменено сервером.');
        }
        else {
            task.params.response = response;
            console.log('[' + getDate() + '] Посылаю результаты выполнения на сервер...');
            socket.emit('readyTask', task);
        }

    });
});

/**
 * Показать информацию о свободных задачах
 */
socket.on('updateTasksInfo', function(tasks_count) {
	console.log('[' + getDate() + '] Свободных задач: ' + tasks_count);
});

/**
 * Отменяем отправку результатов выполнения задачи
 *
 * Наступает, когда принудительно очищаем очередь на сервере
 */
socket.on('abortTask', function() {
    is_task_aborted = true;
});

/**
 * Человеко понятное время
 * @returns {string}
 */
function getDate() {
    var date = new Date();
    return date.toLocaleString();
}
