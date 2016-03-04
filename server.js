/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
var argv = require('minimist')(process.argv.slice(2));
var config = require('./config.js');
var configParams = config.getParams();
var params = {
    port: configParams.server_socket.port,
    stats_port: configParams.stats_socket.port,
};
if (argv.p && typeof argv.p == "number") {
    params.port = argv.p
}
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

rl.setPrompt('>>> ');
rl.prompt();

show_help();

/** Запускаемся */
var io = require('socket.io').listen(params.port);

var users = [];

/**
 * Когда очередь готова для раздачи обнуляем статистику
 * и говорим участникам, что они могут разбирать тесты
 */
queueTasks.on('fill.complete', function () {
    stats.resetStats();

    var tasks_total = queueTasks.tasks.length;
    console.log('[' + getDate() + '] Всего задач: ' + tasks_total);
    console.log('[' + getDate() + '] Раздаём задачи...');
    io.sockets.emit('readyForJob');
});

rl.on('line', function (line) {
    switch (line.trim()) {
        case 'h':
            show_help();
            break;
        case 'o':
            show_online_clients();
            break;
        case 'd':
            console.log(stats.getStats());
            break;
        case 'u':
			io.sockets.emit('updateRepository');
            queueEvents.addTask('update.repo');
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
    console.log('u - update tests repository');
    console.log('d - show stats');
    console.log('o - show online clients');
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

    console.log('[' + getDate() + '] Новое подключение...');

    /**
     * Запрашиваем регистрацию пользователя
     */
    if (socket.username === undefined) {
        socket.emit('needUserReg');
    }

    /**
     * Регистрация нового участника в системе
     * Новый участник готов к работе
     */
    socket.on('registerUser', function (username) {
        socket.username = username;
        users.push(username);

        console.log('[' + getDate() + '] ' + username + ' подключился к системе');
        socket.emit('readyForJob');
    });

    /**
     * Задача выполнена участником и он готов к новой работе
     */
    socket.on('readyTask', function (task) {
		stats.addStat(task.params.response);

		console.log('[' + getDate() + '] ' + socket.username + ' выполнил задачу ID: ' + task.taskName + ' за ' + (task.params.response.time).toFixed(4) + ' сек.');
		socket.emit('readyForJob');
    });

    /**
     * Получаем первую свободную задачу из списка
     * Отправляем участнику и говорим сколько ещё задач осталось
     */
    socket.on('getTask', function () {
        var task = queueTasks.getTask();

        if (task !== false) {
            console.log('[' + getDate() + '] ' + socket.username + ' взял задачу ID: ' + task.taskName);
            socket.emit('processTask', task);
        } else {
            // Если задач нет
        }

        socket.emit('updateTasksInfo', queueTasks.tasks.length);
    });

    /** Участник отключается от системы */
    socket.on('disconnect', function () {
        // todo-r: освободить задачу, которую делал отключённый участник

        /** Удаляем участника из обешго списка **/
        var index = users.indexOf(socket.username);
        if (index != -1) {
            users.splice(index, 1);
        }

        console.log('[' + getDate() + '] ' + socket.username + ' отключился от системы');
    });

});

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

queueEvents.on('add', function (taskName) {
    switch (taskName) {
        case 'update.repo':
            repository.update(function () {
                queueEvents.rmTask('update.repo');
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
            task.generateQueue(taskEventObj.params['data']);
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