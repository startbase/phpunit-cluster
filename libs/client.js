var Config = new (require('../config'));
var settings = Config.getParams();

var params = {
	user: 'startbase_' + Date.now(),
	domain: 'localhost',
	port: settings['ports']['server'],
	commit_hash: 'none',
	version: settings['version']
};

var os = require('os');
var path = require('path');
var argv = require('minimist')(process.argv.slice(2));

var migration_manager = new (require('./migration-manager'))(settings['repository']);
var repository = new (require('./repository'))(settings['repository']);
var phpunitRunner = new (require('./phpunit-runner'))(settings['phpunit_runner']);

var is_task_aborted = false;
var connect_status = false;
var is_busy = false;

/** Обработка аргументов */

if (argv['u'] && typeof argv['u'] == "string") { params.user = argv['u'] }
if (argv['d'] && typeof argv['d'] == "string") { params.domain = argv['d'] }
if (argv['p'] && typeof argv['p'] == "number") { params.port = argv['p'] }

/** Запускаемся */
var socket = require('socket.io-client')('http://' + params.domain + ':' + params.port);

socket.emit('serverMessage', { message: params.user + ' ; ' + params.domain + ' ; ' + params.port + ' ; ' + params.commit_hash + ' ; ' + params.version });
console.log(params.user + ' ; ' + params.domain + ' ; ' + params.port + ' ; ' + params.commit_hash + ' ; ' + params.version);

console.log('[' + getDate() + '] Выбранный сервер: http://' + params.domain + ':' + params.port);
console.log('[' + getDate() + '] Запрашиваю статус сервера...');

socket.on('connect', function() {
	connect_status = true;
	console.log('[' + getDate() + '] Сервер доступен. Присоединяюсь...');
});

socket.on('disconnect', function() {
	connect_status = false;
	console.log('[' + getDate() + '] Сервер недоступен');
});

/**
 * Регистрация в системе
 *
 * Сервер присылает текущую версию системы:
 * - совпадает с клиентом -> пользователь регистрируется
 * - не совпадает -> выводится сообщение и client.js останавливается
 */
socket.on('needUserReg', function(server_version) {
	console.log('[' + getDate() + '] Проверяю версию клиента...');

	console.log('Client version ' + params.version);
	console.log('Server version ' + server_version);
	if (server_version == params.version) {
		console.log('[' + getDate() + '] Версия клиента корректна! Регистрируюсь в системе...');
		var cpus = os.cpus();
		socket.emit('registerUser', { username: params.user, userinfo: os.type() + ' ' + os.arch() + ', ' + cpus[0].model + ' ' + cpus[0].speed + ' MHz'});
	} else {
		console.log('[' + getDate() + '] Версия клиента ' + params.version + 'не подходит для работы с сервером. Обновись!');
		socket.emit('serverMessage', { message: params.user + ' отключился, т.к. версия клиента не корректна' });
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
	readyForJob(socket);
});

/**
 * Выполнение задачи
 *
 * data: { task: 'path теста', commit_hash: 'текущий коммит хэш сервера' }
 *
 * Сервер присылает тест и текущий коммит хеш:
 * - коммит хеши совпадают -> клиент выполняет тест
 * - не совпадают -> клиент обновляет репозиторий, переключается в нужный коммит и выполняет тест
 */
socket.on('processTask', function(data) {
	var task = data.task;
	console.log('[' + getDate() + '] Получил задачу ID: ' + task.taskName);
	socket.emit('serverMessage', { message: params.user + ' получил задачу ID: ' + task.taskName });

	if (params.commit_hash != data.commit_hash) {
		socket.emit('serverMessage', { message: params.user + ' нужно синхронизировать commit hash' });
		console.log('[' + getDate() + '] Для её выполнения нужно синхронизировать commit hash');
		syncRepository(data, socket, function() {
			socket.emit('serverMessage', { message: params.user + ' успешно синхронизировался' });
			processTask(task, socket);
		});
	} else {
		processTask(task, socket);
	}
});

/**
 * Вывод уведомлений от сервера
 *
 * data: { message: 'сообщение' }
 */
socket.on('userMessage', function(data) {
	console.log('[' + getDate() + '] ' + data.message);
});

/**
 * Отменяем отправку результатов выполнения задачи
 *
 * Наступает, когда принудительно очищаем очередь на сервере
 */
socket.on('abortTask', function() {
	is_task_aborted = true;
	console.log('[' + getDate() + '] Выполнение теста было отменено сервером');
});

socket.on('unbusyClient', function() {
	is_busy = false;
});

socket.on('changeClientName', function(username) {
	params.user = username;
});

/**
 * Выполнение теста клиентом
 *
 * @param task
 * @param socket
 */
function processTask(task, socket) {
	var test_path = path.resolve(settings['repository']['repository_path'], task.taskName);
	socket.emit('serverMessage', { message: params.user + ' запускает PHPUnit' });

	phpunitRunner.run(test_path, function (response) {
		if (!is_task_aborted) {
			if (connect_status) {
				is_busy = false;
				task.response = response;

				console.log('[' + getDate() + '] Выполнил задачу ID: \n' + task.taskName);
				socket.emit('readyTask', task);
			} else {
				console.log('[' + getDate() + '] Сервер offline и отправить результаты теста не получится');
			}
		} else {
			socket.emit('serverMessage', { message: params.user + ' не вернёт результат, т.к. is_task_aborted = true' });
		}
	});
}

/**
 * Выполняет синхронизацию репозитория клиента с требуемым commit hash
 *
 * @param data
 * @param socket
 * @param callback
 */
function syncRepository(data, socket, callback) {
	var commit_hash = data.commit_hash;
	console.log('[' + getDate() + '] Синхронизация с ' + commit_hash + ' ...');
	socket.emit('serverMessage', { message: params.user + ' синхронизируется с commit hash сервера' });

	var updateTimeout = setTimeout(function() {
		updateTimeout = null;
		console.log('[' + getDate() + '] Ошибка синхронизации. Задача возвращена на сервер');
		socket.emit('serverMessage', { message: params.user + ' не смог синхронизироваться и возвращает задачу' });
		is_busy = false;
		socket.emit('rejectTask', data.task);
	}, settings['repository']['client_connection_timeout']);
	repository.checkout(commit_hash, function () {
		socket.emit('serverMessage', { message: params.user + ' выполнил checkout' });
		if (updateTimeout) {
			clearTimeout(updateTimeout);
			socket.emit('serverMessage', { message: params.user + ' запускает миграцию' });
			migration_manager.migrateUp(callback);
			params.commit_hash = commit_hash;
		}
	});
}

function readyForJob(socket) {
	is_task_aborted = false;

	if (!is_busy) {
		is_busy = true;
		console.log('[' + getDate() + '] Запрашиваю свободную задачу...');
		socket.emit('getTask');
	} else {
		socket.emit('serverMessage', { message: params.user + ' получил запрос readyForJob, хотя is_busy = true' });
	}
}

/**
 * Человеко понятное время
 *
 * @returns {string}
 */
function getDate() {
	var date = new Date();
	return date.toLocaleString();
}
