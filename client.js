var Lib = require('./lib');
//var start = new Date().getTime();
//
//console.log(Lib.fibonacci(47));
//var end = new Date().getTime();
//console.log("\n\n Complete: "+(end - start) / 1000 + 's');

var user = 'startbase_' + Date.now();
var socket = require('socket.io-client')('http://dashboard.b2b-center.ru:8099');

function getDate() {
    var date = new Date();
    return date.toLocaleString();
}

socket.on('connect', function() {
	console.log('[' + getDate() + '] Сервер доступен. Присоединяемся...');
});

// Регистрируемся в системе по запросу
// Обратно вернётся event: readyForJob
socket.on('needUserReg', function() {
	console.log('[' + getDate() + '] Проходим регистрацию...');
	socket.emit('registerUser', user);
});

// Готовы к работе и должны получить задачу
// Обратно вернётся event: processTask
socket.on('readyForJob', function() {
	socket.emit('getTask');
});

socket.on('updateTasksInfo', function(tasks_count) {
	console.log('[' + getDate() + '] Свободных задач: ' + tasks_count);
});

// Получили задачу, выполнили и вернули результат
// Обратно вернётся event: readyForJob
socket.on('processTask', function(task) {
	console.log('[' + getDate() + '] Выполняю задачу ID: ' + task.id);
    var start = new Date().getTime();
    Lib.fibonacci(task.sleep);
    var end = new Date().getTime();
    task.diff = end - start;
    socket.emit('readyTask', task);
});

socket.on('disconnect', function() {
	console.log('[' + getDate() + '] Сервер недоступен');
});