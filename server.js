/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
var argv = require('minimist')(process.argv.slice(2));
var config = require('./config.js');
var configParams = config.getParams();
var params = {
    port: configParams.server_socket.port
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

var tasks_diff = 0;

var start_t = 0;
var end_t = 0;

queueTasks.on('fill.complete', function () {
    tasks_diff = 0;
    stats.resetStats();
    var tasks_total = queueTasks.tasks.length;
    console.log('[' + getDate() + '] Всего задач: ' + tasks_total);
    console.log('[' + getDate() + '] Раздаём задачи...');
    start_t = new Date().getTime();

    io.sockets.emit('readyForJob');
});

rl.on('line', function (line) {
    switch (line.trim()) {
        case 'h':
            show_help();
            break;
        case 'g':
            console.log('[' + getDate() + '] Начинаем загрузку задач...');
            queueTasks.emit('generateTasks', task);
            break;
        case 'o':
            show_online_clients();
            break;
        case 'd':
            console.log(stats.getStats());
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
    console.log('g - generate new tasks');
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
     * Оповещение других участников
     * Оповещение других участников о кол-ве доступных задач
     */
    socket.on('registerUser', function (username) {
        socket.username = username;
        users.push(username);

        console.log('[' + getDate() + '] ' + username + ' подключился к системе');
        socket.emit('readyForJob');
    });

    /**
     * Задача выполнена участником и он готов к новой работе.
     */
    socket.on('readyTask', function (task) {
        /**
         * Передача данных в статистику.
         *
         * Формат приходящих данных:
         * { taskName: task.taskName, params: { process_time: ***, status: 200 } }
         *
         * process_time - время выполнения теста, в милисекундах
         * status - статус выполнения теста. Пока значения не определены
         */

        tasks_diff += task.params.process_time;
        console.log('[' + getDate() + '] ' + socket.username + ' выполнил задачу ID: ' + task.taskName + ' за ' + (task.params.process_time / 1000) + ' сек.');
        stats.addStat(task.params.response);
        socket.emit('readyForJob');
    });

    /**
     * Получаем первую свободную задачу из списка
     * Отправляем участнику и удаляем из очереди
     * Оповещение других участников о кол-ве доступных задач
     */
    socket.on('getTask', function () {
        var task = queueTasks.getTask();

        if (task !== false) {
            console.log('[' + getDate() + '] ' + socket.username + ' взял задачу ID: ' + task.taskName);
            socket.emit('processTask', task);
        } else {
            // Если задач нет
            end_t = new Date().getTime();
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
