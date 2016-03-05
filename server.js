/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
var argv = require('minimist')(process.argv.slice(2));
var config = require('./config.js');
var configParams = config.getParams();
var params = {
    port: configParams.server_socket.port,
    stats_port: configParams.stats_socket.port,
    commit_hash: 'none'
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
var users = [];

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
    stats.start_time = Date.now();

    var tasks_total = queueTasks.tasks.length;
    console.log('[' + getDate() + '] Всего задач: ' + tasks_total);
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
            console.log('');
            break;
        case 'd':
            console.log(stats.getConsoleStats());
            break;
        case 'u':
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
    socket.on('registerUser', function (data) {
        socket.username = data.username;
        users.push(data.username);

        console.log('[' + getDate() + '] ' + socket.username + ' подключился к системе');

        /** Сервер ещё не готов для работы */
        if (params.commit_hash == 'none') {
            socket.emit('serverNotReady');
            return;
        }

        /** Если у сервера и клиента совпадают хеши - разрешаем работать */
        if (params.commit_hash == data.commit_hash) {
            console.log('[' + getDate() + '] ' + socket.username + ' готов для работы');
            socket.emit('readyForJob');
        } else {
            console.log('[' + getDate() + '] ' + socket.username + ' обновляет репозитарий...');
            socket.emit('updateRepository');
        }

    });

    /**
     * Задача выполнена участником и он готов к новой работе
     */
    socket.on('readyTask', function (task) {
		stats.addStat(task.params.response);

		console.log('[' + getDate() + '] ' + socket.username + ' выполнил задачу ID: ' + task.taskName + ' за ' + (task.params.response.time).toFixed(4) + ' сек.');

        if (queueTasks.tasks.length > 0) {
            socket.emit('readyForJob');
        } else {
            stats.finish_time = Date.now();
        }
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
                io.sockets.emit('updateRepository');
                queueEvents.rmTask('update.repo');
                queueEvents.addTask('set.commit.hash');
                queueEvents.addTask('parser.start');
            });
            break;
        case 'set.commit.hash':
            repository.getLastCommitHash(function(commit_hash) {
                params.commit_hash = commit_hash;
                queueEvents.rmTask('set.commit.hash');
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
    }
});

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
var stats_socket = require('socket.io').listen(params.stats_port);

stats_socket.on('connection', function (socket) {

    socket.on('getWebStats', function () {
        socket.emit('statsReceived', stats.getWebStats());
    });

});