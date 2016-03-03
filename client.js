/** ТОЛЬКО ДЛЯ ТЕСТА */
var Fibonacci = require('./libs/fibonacci.js');
var repository = require('./libs/repository.js');

var repository_updated = 0;

/** Настройки по умолчанию */
var params = {
    user: 'startbase_' + Date.now(),
    domen: 'localhost',
    port: 8099
};

/** Обработка аргументов */
var argv = require('minimist')(process.argv.slice(2));

if (argv.u && typeof argv.u == "string") { params.user = argv.u }
if (argv.d && typeof argv.d == "string") { params.domen = argv.d }
if (argv.p && typeof argv.p == "number") { params.port = argv.p }

/** Запускаемся */
var user = params.user;
var socket = require('socket.io-client')('http://' + params.domen + ':' + params.port);

console.log('[' + getDate() + '] Выбранный сервер: http://' + params.domen + ':' + params.port);
console.log('[' + getDate() + '] Запрашиваем статус сервера...');

socket.on('connect', function() {
    socket.join('system-clients');
    console.log('[' + getDate() + '] Сервер доступен. Присоединяемся...');
});

socket.on('disconnect', function() {
	console.log('[' + getDate() + '] Сервер недоступен');
});

socket.on('updateRepository', function() {
    console.log('Обновляем репозиторий');
    repository_updated = 0;

    repository.update(function () {
        repository_updated = 1;
    });

});

/**
 * Регистрация в системе
 *
 * Если участника нет в списках - сервер отправит запрос на регистрацию.
 * После прохождения регистрации вернётся событие "readyForJob".
 */
socket.on('needUserReg', function() {
	console.log('[' + getDate() + '] Проходим регистрацию...');
	socket.emit('registerUser', user);
});

/**
 * Готовность к работе
 *
 * Наступает после регистрации или выполнения задачи.
 * Участник запрашивает у сервера свободную задачу.
 */
socket.on('readyForJob', function() {
	socket.emit('getTask');
});

/**
 * Выполнение задачи
 *
 * Участник выполняет задачу и отправляет результаты серверу.
 */
socket.on('processTask', function(task) {
    console.log('[' + getDate() + '] Выполняю задачу ID: ' + task.id);

    /** ТОЛЬКО ДЛЯ ТЕСТА */
    var start = new Date().getTime();
    Fibonacci.calc(task.sleep);
    var end = new Date().getTime();
    task.diff = end - start;
    /** */

    socket.emit('readyTask', task);
});

/**
 * Показать информацию о свободных задачах
 */
socket.on('updateTasksInfo', function(tasks_count) {
	console.log('[' + getDate() + '] Свободных задач: ' + tasks_count);
});

/**
 * Человеко понятное время
 * @returns {string}
 */
function getDate() {
    var date = new Date();
    return date.toLocaleString();
}