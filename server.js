/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
var colors = require('colors');

// Выставляем окружению параметр для отсылки писем через транспорт
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var argv = require('minimist')(process.argv.slice(2));
var config = require('./config.js');
var configParams = config.getParams();
var params = {
    port: configParams.server_socket.port,
    stats_port: configParams.stats_socket.port,
    commit_hash: 'none',
	last_commit_hash: 'none',
    version: configParams.version
};
if (argv.p && typeof argv.p == "number") {
    params.port = argv.p
}
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
var fs = require('fs');
const readline = require('readline');
const rl = readline.createInterface(process.stdin, process.stdout);
var taskBalancer = new (require('./task-balancer.js'));
taskBalancer.repeat_attempts_number = configParams.task_balancer.failed_attempts;
var testParser = require('./libs/test-parser');
var repository = require('./libs/repository.js');
var queueEvents = new (require('./queue'));
var stats = require('./stats');
var weightBase = require('./libs/weight-base');
var users = [];
var tasks_pool_count = 0;
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
var logAgregator = new (require('./log-agregator'))(configParams);
var BrokenTests = new (require('./libs/broken-tests'))(configParams);
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
/** Запускаемся */
var io = require('socket.io').listen(params.port);
console.log('[' + getDate() + '] Сервер запущен. Порт: ' + params.port);
setLastCommitHash();
show_help();

/**
 * Когда очередь готова для раздачи обнуляем статистику
 * и говорим участникам, что они могут разбирать тесты
 */
taskBalancer.queueTasks.on('fill.complete', function () {
	weightBase.resetPool();
	stats.resetStats();
	tasks_pool_count = taskBalancer.tasksCount();

	// Сохраняем данные в статистику
	stats.start_time = Date.now();
	stats.commit_hash = params.commit_hash;
	stats.count_tasks = tasks_pool_count;

	if (params.last_commit_hash != 'none' && params.last_commit_hash != params.commit_hash) {
		repository.getMergeCommitHistory(params.last_commit_hash, params.commit_hash, function(commits_merge) {
			stats.commits_merge = commits_merge;
		});
	}

    console.log('\n[' + getDate() + '] Всего задач: ' + tasks_pool_count);
    console.log('[' + getDate() + '] Раздаём задачи...');

	io.sockets.emit('web.start', stats.getWebStats());
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
			console.log('Прошлый commit hash сервера: ' + params.last_commit_hash);
            console.log('Текущий commit hash сервера: ' + params.commit_hash);
            break;
        case 't':
            console.log('Всего невыполненных задач: ' + taskBalancer.tasksCount());
            taskBalancer.queueTasks.tasks.forEach(function (task, i) {
                console.log((i + 1) + ': ' + task.taskName);
            });
			console.log('\n');
			console.log('Task Balancer Stats:');
			console.log(taskBalancer.prohStates.showState());
			console.log('\n');
            break;
        case 'e':
            console.log('Очищение очереди задач');
            taskBalancer.clearTaskQueue();
			queueEvents.rmTask('in.process');
            io.sockets.emit('abortTask');
			io.sockets.emit('unbusyClient');
            stats.count_tasks = 0;
            io.sockets.emit('web.reset');
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
	io.sockets.emit('web.users.update', []);
	io.sockets.emit('web.reset');
	io.sockets.emit('abortTask');
	io.sockets.emit('unbusyClient');
    process.exit(0);
});

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
var dgram = require('dgram');
var udp_receiver = dgram.createSocket('udp4');

udp_receiver.on('error', function (err) {
	console.log('[' + getDate() + '] UDP: ' + err);
	udp_receiver.close();
});

udp_receiver.on('message', function (message, info) {
	console.log('[' + getDate() + '] Пришёл UDP пакет на обновление');

    console.log('MESSAGE to string:');
    console.log(message.toString('utf8'));

    if (message.toString('utf8') === 'beta' || message.toString('utf8') === 'integration') {
		rl.emit('line', 'u');
	}
});

udp_receiver.bind(configParams.udp_socket.port);
/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

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
        console.log(user_index + '. ' + users[i][0] + ' (' + users[i][1] + ')');
        user_index++;
    }
    console.log('\n');
}

function isExistUser(username) {
	for (var i = 0; i < users.length; i++) {
		if (users[i][0] == username) {
			return true;
		}
	}

	return false;
}

function setLastCommitHash() {
	if (fs.existsSync(configParams.statistic.last_pool)) {
		fs.readFile(configParams.statistic.last_pool, function(err, data) {
			if (err) throw err;

			var last_pool = JSON.parse(data);
			params.last_commit_hash = last_pool.commit_hash;
		});
	} else {
		console.log('[' + getDate() + '] Данных по последнему выполненому пулу не обнаружено');
	}
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

		if (isExistUser(data.username)) {
			data.username = data.username + '_' +  + Date.now();
			socket.emit('changeClientName', data.username);
			socket.emit('userMessage', { message: 'Пользователь с таким именем уже есть в системе. Вас переименовали в ' + data.username });
		}

        socket.username = data.username;
        users.push([data.username, data.userinfo]);
        taskBalancer.clients_number++;

        console.log('[' + getDate() + '] ' + socket.username + ' подключился к системе');
        io.sockets.emit('web.users.update', users);

		socket.emit('userMessage', { message: 'Регистрация прошла успешно!' });
        socket.emit('unbusyClient');
        socket.emit('readyForJob');
    });

    socket.on('manual.run', function () {
        rl.emit('line', 'u');
    });

    /**
     * Задача выполнена участником и он готов к новой работе
     */
    socket.on('readyTask', function (task) {
		socket.current_task = false;
		console.log('[' + getDate() + '] ' + socket.username + ' прислал данные по задаче ID: \n' + task.taskName);

		if (!task.response.status) {
			// Тест был завален
			console.log('[' + getDate() + '] ' + socket.username + ' завалил задачу ID: \n' + task.taskName);
			taskBalancer.registerFailed(socket.username, task);
			// Нужно отправить на повторную проверку?
			if (taskBalancer.canReturnTask(task)) {
				// Сохраним время выполнения phpunit
				stats.phpunit_repeat += task.response.time;
				returnTaskToQueue(socket, task);
				return;
			}
		}

		console.log('[' + getDate() + '] ' + socket.username + ' выполнил задачу ID: \n' + task.taskName + ' за ' + (task.response.time).toFixed(4) + ' сек.');

		// Записываем статистику
		stats.addStat(task.response);
		// Сохраняем данные по тяжести теста
		weightBase.addWeight({ taskName: task.taskName, weight: task.response.time });

        if (taskBalancer.tasksCount() > 0) {
            socket.emit('readyForJob');
        } else {
			socket.emit('userMessage', { message: 'Свободных задач в пуле нет' });
		}

		// если в статистике столько же тестов, сколько было изначально, то пул выполнен
		if (tasks_pool_count == stats.tests.length) {
			console.log('[' + getDate() + '] Все задачи из текущего пула выполнены');
			stats.finish_time = Date.now();
			stats.count_tasks = 0;

			weightBase.saveWeights(function() {
				console.log('[' + getDate() + '] Данные по времени выполнения тестов последнего пула сохранены');
			});

			/** Освобождаем сервер */
			params.last_commit_hash = params.commit_hash;
			queueEvents.rmTask('in.process');
			console.log('[' + getDate() + '] Сервер свободен для создания нового пула задач');

			/** Сразу покажем статистику */
			rl.emit('line', 'd');

			stats.saveLastPool(function () {
				console.log('[' + getDate() + '] Результаты выполнения последнего пула сохранены');
			});

			/** Если в очереди есть задача на обновление репозитария - just do it! */
			if (queueEvents.hasTask('need.update.repo')) {
				queueEvents.rmTask('need.update.repo');
				queueEvents.addTask('update.repo');
			}

			var web_stats = stats.getWebStats();
			var save_stats = stats.prepareForSave();
			io.sockets.emit('stats.update', web_stats);
            io.sockets.emit('web.update', web_stats);
            io.sockets.emit('web.complete', web_stats);
            logAgregator.push(save_stats);
			BrokenTests.getBrokenTests(function(failed_tests_old) {
				BrokenTests.update(save_stats, failed_tests_old);
			});
        }
    });

    /**
     * Получаем первую свободную задачу из списка
     * Отправляем участнику и говорим сколько ещё задач осталось
     */
    socket.on('getTask', function () {
        var task = taskBalancer.getTask(socket.username);

        if (task !== false) {
            console.log('[' + getDate() + '] ' + socket.username + ' взял задачу ID: \n' + task.taskName);
            socket.current_task = task;
            socket.emit('processTask', { task: task, commit_hash: params.commit_hash });
			socket.emit('userMessage', { message: 'Свободных задач в пуле: ' + taskBalancer.tasksCount() });
        } else {
            socket.emit('userMessage', { message: 'Свободных задач в пуле нет для клиента' });
			socket.emit('unbusyClient');
        }
        io.sockets.emit('web.update', stats.getWebStats());
    });

    /** Участник отключается от системы */
    socket.on('disconnect', function () {
		if (socket.username === undefined) {
			return;
		}

        /** Удаляем участника из обешго списка **/
		var index = -1;
		users.forEach(function(user, i) {
			if (user[0] == socket.username) {
				index = i;
			}
		});
        if (index != -1) {
            users.splice(index, 1);
        }
        taskBalancer.clients_number--;

        console.log('[' + getDate() + '] ' + socket.username + ' отключился от системы');
		io.sockets.emit('web.users.update', users);

        /** Если клиент выполнял задачу - возвращаем её в очередь */
        if (socket.current_task) {
            returnTaskToQueue(socket, socket.current_task);
        }

        socket.username = undefined;
    });

    socket.on('rejectTask', function(data) {
        returnTaskToQueue(socket, data);
    });

    socket.on('serverMessage', function(data) {
        console.log('[' + getDate() + '] ' + data.message);
    });

    socket.on('stats.init_request', function () {
        stats.getLastStatsData(function (data) {
            io.sockets.emit('stats.init_result', data);
            io.sockets.emit('stats.update', data);
        });
    });

    socket.emit('web.update', stats.getWebStats());
	socket.emit('web.users.update', users);
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
            taskBalancer.clearTaskQueue();
            var updateTimeout = setTimeout(function() {
                updateTimeout = null;
                queueEvents.tasks = [];
                queueEvents.rmTask('update.repo');
                console.log('[' + getDate() + '] Git update timeout. Waiting for a new update event...');
            }, configParams.repository.server_connection_timeout);
			repository.update(function () {
                if (updateTimeout) {
                    clearTimeout(updateTimeout);
                    queueEvents.rmTask('update.repo');
                    queueEvents.addTask('set.commit.hash');
                }
			});
            break;
        case 'set.commit.hash':
            repository.getLastCommitHash(function(commit_hash) {
				params.commit_hash = commit_hash;
				queueEvents.rmTask('set.commit.hash');

				/**
				 * На данный момент UDP пакет присылается если кто-то освобождает ветку,
				 * при этом push может не сделан. Если новый комит соотв. комиту прошлого пула,
				 * то освобождаем сервер
				 */
				if (params.commit_hash == params.last_commit_hash) {
					console.log('[' + getDate() + '] Последний commit hash совпал с текущим. Запуск пула отменён. Сервер свободен');
					queueEvents.rmTask('in.process');
				} else {
					queueEvents.addTask('parser.start');
				}
            });
            break;
        case 'parser.start':
            testParser.base_dirs = configParams.parser.base_dirs;
            testParser.excluded_dirs = configParams.parser.excluded_dirs;
            testParser.processParse(function (err, result) {
                queueEvents.rmTask('parser.start');
                queueEvents.addTask('task.generate', {data: testParser.getCleanResults(result, configParams.repository.repository_path)});
            });
            break;
        case 'task.generate':
            var taskEventObj = queueEvents.find('task.generate');
            queueEvents.rmTask('task.generate');
            taskBalancer.generateQueue(taskEventObj.params['data']);
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

function returnTaskToQueue(socket, current_task) {
    console.log('[' + getDate() + '] Задача ID: ' + current_task.taskName + ' возвращена в очередь');
    taskBalancer.queueTasks.addTask(current_task.taskName, current_task.params);
	socket.current_task = false;
	io.sockets.emit('readyForJob');
}