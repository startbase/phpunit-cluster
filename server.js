const readline = require('readline');
const rl = readline.createInterface(process.stdin, process.stdout);
var Task = require('./task');
var TestParser = require('./test-parser');

rl.setPrompt('>>> ');
rl.prompt();

var config = require('./config.js');
var repository = require('./libs/repository.js');


config_params = config.getParams();

/** Настройки по умолчанию */
var params = {
    port: config_params.server_socket.port
};

/** Обработка аргументов */
var argv = require('minimist')(process.argv.slice(2));

if (argv.p && typeof argv.p == "number") {
    params.port = argv.p
}

var queueEvents = new (require('./queue'));
var queueTasks = new (require('./queue'));

var task = new Task(queueTasks, new TestParser());


/** Запускаемся */
var io = require('socket.io').listen(params.port);

/** Массив пользователей в системе */
var users = [];
/**
 * Текущий список задач
 * Формат: { id: id, sleep: sleep, status: 0|1 }
 * id - идентификатор
 * sleep - длительность выполнения задача
 * status:
 *  0 - свободна
 *  1 - занята
 */
//var tasks = [];
/** Суммарное последовательное время выполнения задач (сумма всех sleep) */
var tasks_runtime = 0;
var tasks_diff = 0;

var start_t = 0;
var end_t = 0;

queueTasks.on('fill.complete', function() {
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

            console.log('[' + getDate() + '] Раздаём задачи...');
            start_t = new Date().getTime();
            break;
        case 'o':
            show_online_clients();
            break;
        case 'd':
            show_stats();
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

/**
 * Подсчёт свободных задач
 * @returns {number}
 */
function getCountFreeTasks() {
    var free_tasks_count = 0;

    for (var i = 0; i < tasks.length; i++) {
        if (tasks[i].status == 0) {
            free_tasks_count++;
        }
    }

    return free_tasks_count;
}

/** Генерация задач */
function loadTasks() {
    /**
     * Максимальное кол-во задач (только для теста)
     * @type {number}
     */
    var limit = 20;
    var i = 1;
    tasks_runtime = 0;
    tasks_diff = 0;
    tasks = [];

    while (i <= limit) {
        var id = Date.now() + '_' + i;
        var sleep = Math.floor(Math.random() * (40 - 40 + 1) + 40);
        tasks_runtime = tasks_runtime + sleep;
        task = {id: id, sleep: sleep, status: 0};
        tasks.push(task);
        i++;
    }
}

function show_help() {
    console.log('help:');
    console.log('g - generate new tasks');
    console.log('u - update tests repository');
    console.log('o - show stats');
    console.log('d - show online clients');
    console.log('h - help');
}

function show_online_clients() {
    var user_index = 1;

    console.log('Список пользователей в системе:');
    for (var i = 0; i < users.length; i++) {
        console.log(user_index + '. ' + users[i]);
        user_index++;
    }
    console.log('');
}

function show_stats() {
    console.log('Total diff: ' + (tasks_diff / 1000) + ' сек.');
    // 20 - кол-во задач
    console.log('Avg: ' + (tasks_diff / 20 / 1000) + ' сек.');
    console.log('Total time: ' + ((end_t - start_t) / 1000) + ' сек.');
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
        tasks_diff += task.params.process_time;
        console.log('[' + getDate() + '] ' + socket.username + ' выполнил задачу ID: ' + task.taskName + ' за ' + (task.params.process_time / 1000) + ' сек.');
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
queueEvents.on('add', function (taskName) {
    switch (taskName) {
        case 'update.repo':
            repository.update(function () {
                queueEvents.rmTask('update.repo');
                queueEvents.addTask('parser.start');
            });
            break;
        case 'parser.start':
            console.log('Витя дай парсер');
            break;
    }
});
