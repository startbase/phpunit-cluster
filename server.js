/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
var argv = require('minimist')(process.argv.slice(2));
var config = require('./config.js');
var configParams = config.getParams();
var params = {
    port: configParams.server_socket.port,
    stats_port: configParams.stats_socket.port,
    commit_hash: 'none',
    version: configParams.version
};
if (argv.p && typeof argv.p == "number") {
    params.port = argv.p
}
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
var dgram = require('dgram');
var udp_receiver = dgram.createSocket('udp4');

udp_receiver.on('error', function (err) {
	console.log('[' + getDate() + '] UDP: ' + err);
	//udp_receiver.close();
});

udp_receiver.on('message', function (message, info) {
	console.log('[' + getDate() + '] UDP пакет:');
	console.log(message, info);
	/*
	if (нужное нам событие) {
		if (!queueEvents.hasTask('need.update.repo')) {
			console.log('[' + getDate() + '] Задача по обновлению репозитория добавлена в очередь');
			queueEvents.addTask('need.update.repo');
		} else {
			console.log('[' + getDate() + '] Задача по обновлению репозитория уже есть в очереди');
		}
	}
	*/
});

udp_receiver.bind(configParams.udp_socket.port);
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
const readline = require('readline');
const rl = readline.createInterface(process.stdin, process.stdout);
var Task = require('./task');
var testParser = require('./libs/test-parser');
var repository = require('./libs/repository.js');
var queueEvents = new (require('./queue'));
var queueTasks = new (require('./queue'));
var task = new Task(queueTasks);
var stats = require('./stats');
var weightBase = require('./libs/weight-base');
var users = [];
var tasks_pool_count = 0;

/** Запускаемся */
var io = require('socket.io').listen(params.port);
console.log('[' + getDate() + '] Сервер запущен. Порт: ' + params.port);
show_help();

/**
 * Когда очередь готова для раздачи обнуляем статистику
 * и говорим участникам, что они могут разбирать тесты
 */
queueTasks.on('fill.complete', function () {
	stats.resetStats();
	weightBase.resetPool();
    stats.start_time = Date.now();

    tasks_pool_count = queueTasks.tasks.length;
    console.log('\n[' + getDate() + '] Всего задач: ' + tasks_pool_count);
    console.log('[' + getDate() + '] Раздаём задачи...');
    io.sockets.emit('readyForJob');
});

rl.setPrompt('>>> ');
rl.prompt();
rl.on('line', function (line) {
    switch (line.trim()) {
        case 'h':
            show_help();
            break;
        case 'o':
            show_online_clients();
            break;
        case 'c':
            console.log('Текущий commit hash сервера: ' + params.commit_hash);
            break;
        case 't':
            console.log('Всего невыполненных задач: ' + queueTasks.tasks.length);
            queueTasks.tasks.forEach(function (task, i) {
                console.log((i + 1) + ': ' + task.taskName);
            });
            break;
        case 'e':
            console.log('Очищение очереди задач');
            queueTasks.tasks = [];
            io.sockets.emit('abortTask');
            break;
        case 'd':
            console.log(stats.getConsoleStats());
            break;
        case 'u':
			if (!queueEvents.hasTask('need.update.repo')) {
				console.log('[' + getDate() + '] Задача по обновлению репозитория добавлена в очередь');
				queueEvents.addTask('need.update.repo');
			} else {
				console.log('[' + getDate() + '] Задача по обновлению репозитория уже есть в очереди');
			}
            return;
        default:
            console.log('bad command `' + line.trim() + '`');
            show_help();
            break;
    }
    rl.prompt();
}).on('close', function () {
    console.log('Bye!');
    process.exit(0);
});

/**
 * Человеко понятное время
 * @returns {string}
 */
function getDate() {
    var date = new Date();
    return date.toLocaleString();
}

function show_help() {
    console.log('help:');
    console.log('u - update repository');
    console.log('e - erase queue with tasks');
    console.log('d - show stats');
    console.log('t - show tasks');
    console.log('o - show online clients');
    console.log('c - show current commit hash');
    console.log('h - help');
}

function show_online_clients() {
    var user_index = 1;

    console.log('Список пользователей в системе:');
    for (var i = 0; i < users.length; i++) {
        console.log(user_index + '. ' + users[i]);
        user_index++;
    }
    console.log('\n');
}

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */


io.sockets.on('connection', function (socket) {

    /**
     * Запрашиваем регистрацию пользователя
     */
    if (socket.username === undefined) {
        socket.emit('needUserReg', params.version);
    }

    /**
     * Регистрация нового участника в системе
     * Новый участник готов к работе
     */
    socket.on('registerUser', function (data) {
		console.log('[' + getDate() + '] Новое подключение!');

        socket.username = data.username;
        users.push(data.username);

        console.log('[' + getDate() + '] ' + socket.username + ' подключился к системе');
		socket.emit('userMessage', { message: 'Регистрация прошла успешно!' });
        socket.emit('readyForJob');
    });

    /**
     * Задача выполнена участником и он готов к новой работе
     */
    socket.on('readyTask', function (task) {
		stats.addStat(task.response);
		weightBase.addWeight({ taskName: task.taskName, weight: task.response.time });

        socket.current_task = false;
		console.log('[' + getDate() + '] ' + socket.username + ' выполнил задачу ID: \n' + task.taskName + ' за ' + (task.response.time).toFixed(4) + ' сек.');

        if (queueTasks.tasks.length > 0) {
            socket.emit('readyForJob');
        } else {
			socket.emit('userMessage', { message: 'Свободных задач в пуле нет' });
		}

		if (tasks_pool_count == stats.tests.length) {
			console.log('[' + getDate() + '] Все задачи из текущего пула выполнены');
			weightBase.saveWeights(function() {
				console.log('[' + getDate() + '] Данные по времени выполнения тестов последнего пула сохранены');
			});
			stats.finish_time = Date.now();

			/** Освобождаем сервер */
			queueEvents.rmTask('in.process');
			console.log('[' + getDate() + '] Сервер свободен для создания нового пула задач');
			/** Если в очереди есть задача на обновление репозитария - just do it! */
			if (queueEvents.hasTask('need.update.repo')) {
				queueEvents.rmTask('need.update.repo');
				queueEvents.addTask('update.repo');
			}
		}
    });

    /**
     * Получаем первую свободную задачу из списка
     * Отправляем участнику и говорим сколько ещё задач осталось
     */
    socket.on('getTask', function () {
        var task = queueTasks.getTask();

        if (task !== false) {
            console.log('[' + getDate() + '] ' + socket.username + ' взял задачу ID: \n' + task.taskName);
            socket.current_task = task;
            socket.emit('processTask', { task: task, commit_hash: params.commit_hash });
			socket.emit('userMessage', { message: 'Свободных задач в пуле: ' + queueTasks.tasks.length });
        } else {
			socket.emit('userMessage', { message: 'Свободных задач в пуле нет' });
        }
    });

    /** Участник отключается от системы */
    socket.on('disconnect', function () {
        /** @todo Выпилить логи от Веб-сервера, либо перевесить его**/
        
        /** Удаляем участника из обешго списка **/
        var index = users.indexOf(socket.username);
        if (index != -1) {
            users.splice(index, 1);
        }

        console.log('[' + getDate() + '] ' + socket.username + ' отключился от системы');

        /** Если клиент выполнял задачу - возвращаем её в очередь */
        if (socket.current_task) {
            console.log('[' + getDate() + '] Задача ID: ' + socket.current_task.taskName + ' возвращена в очередь');
            queueTasks.addTask(socket.current_task.taskName);
        }

        socket.username = undefined;
        socket.current_task = false;
    });

});

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

queueEvents.on('add', function (taskName) {
    switch (taskName) {
		case 'need.update.repo':
			if (!queueEvents.hasTask('in.process')) {
				queueEvents.rmTask('need.update.repo');
				queueEvents.addTask('update.repo');
			}
			break;
        case 'update.repo':
			queueEvents.addTask('in.process');
			queueTasks.tasks = [];
			repository.update(function () {
				queueEvents.rmTask('update.repo');
				queueEvents.addTask('set.commit.hash');
			});
            break;
        case 'set.commit.hash':
            repository.getLastCommitHash(function(commit_hash) {
                params.commit_hash = commit_hash;
                queueEvents.rmTask('set.commit.hash');
                queueEvents.addTask('parser.start');
            });
            break;
        case 'parser.start':
            testParser.base_dirs = configParams.parser.baseDirs;
            testParser.processParse(function (err, result) {
                queueEvents.rmTask('parser.start');
                queueEvents.addTask('task.generate', {data: testParser.getCleanResults(result, configParams.repository.repository_path)});
            });
            break;
        case 'task.generate':
            var taskEventObj = queueEvents.find('task.generate');
            queueEvents.rmTask('task.generate');
            io.sockets.emit('stats.update', stats.getWebStats());
            task.generateQueue(taskEventObj.params['data']);
            break;
        case 'in.process':
			console.log('[' + getDate() + '] Сервер перешёл в режим создания и раздачи задач');
            break;
    }
});

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
var stats_socket = require('socket.io').listen(params.stats_port);

stats_socket.on('connection', function (socket) {

    socket.on('getWebStats', function () {
        socket.emit('statsReceived', stats.getWebStats());
    });

});