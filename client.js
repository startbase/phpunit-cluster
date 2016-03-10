var path = require('path');

var config = require('./config.js');
var configParams = config.getParams();
var params = {
    user: 'startbase_' + Date.now(),
    domain: 'localhost',
    port: configParams.server_socket.port,
    commit_hash: 'none'
};

var repository = require('./libs/repository.js');
var repository_updated = 0;

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
socket.on('needUserReg', function() {
	console.log('[' + getDate() + '] Прохожу регистрацию...');

    repository.getLastCommitHash(function(commit_hash) {
        params.commit_hash = commit_hash;
        socket.emit('registerUser', {
            username: params.user,
            commit_hash: params.commit_hash
        });
    });
});

/**
 * Готовность к работе
 *
 * Наступает после регистрации или выполнения задачи.
 * Участник запрашивает у сервера свободную задачу.
 */
socket.on('readyForJob', function() {
    /**
     * @todo-r в данный момент если клиент отключается и снова подключается не работает. Нужен рефакторинг регистрации.
     */
    if (repository_updated == 1) {
        console.log('[' + getDate() + '] Беру задачу из пула...');
        socket.emit('getTask');
    }
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
        task.params.response = response;
        console.log('[' + getDate() + '] Посылаю результаты выполнения на сервер...');
        socket.emit('readyTask', task);
    });
});

/**
 * Показать информацию о свободных задачах
 */
socket.on('updateTasksInfo', function(tasks_count) {
	console.log('[' + getDate() + '] Свободных задач: ' + tasks_count);
});

/**
 * Показываем сообщение, что сервер ещё не готов для работы
 */
socket.on('serverNotReady', function() {
    console.log('[' + getDate() + '] Жду готовности сервера...');
});

/**
 * Человеко понятное время
 * @returns {string}
 */
function getDate() {
    var date = new Date();
    return date.toLocaleString();
}
