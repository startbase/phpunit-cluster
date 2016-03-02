/** Настройки по умолчанию */
var params = {
    port: 8080
};

/** Обработка аргументов */
var argv = require('minimist')(process.argv.slice(2));

if (argv.p && typeof argv.p == "number") { params.port = argv.p }

var queue = require('./queue');
/** Запускаемся */
var io = require('socket.io').listen(params.port);
/** Для работы с клавиатурой */
var stdin = process.stdin;
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
var tasks = [];
/** Суммарное последовательное время выполнения задач (сумма всех sleep) */
var tasks_runtime = 0;
var tasks_diff = 0;

var start_t = 0;
var end_t = 0;

/** Готовимся читать ввод с клавиатуры */
stdin.setRawMode(true);
stdin.resume();
stdin.setEncoding('utf8');

/**
 * Если нажата клавиша 's', то генерируем новые задачи и оповещаем участников.
 * Цикл нужен для того, чтобы они не брали одновременно одну и туже задачу.
 */
stdin.on('data', function(key) {
    /** [Ctrl - C]: выход */
    if (key === '\u0003') {
        process.exit();
    }

    /** [g]: запустить генерацию задач */
    if (key === '\u0067') {
        start_t = new Date().getTime();
        console.log('[' + getDate() + '] Начинаем загрузку задач...');
        loadTasks();
        //console.log('[' + getDate() + '] Суммарный runtime задач: ' + (tasks_runtime / 1000) + ' сек.');

        io.sockets.emit('updateTasksInfo', getCountFreeTasks());

        console.log('[' + getDate() + '] Раздаём задачи...');
        var clients = io.sockets.sockets;
        for (var index in clients) {
            var socketId = clients[index].id;
            io.sockets.sockets[socketId].emit('readyForJob');
        }
    }

    /** [o]: показать список пользователей в сети */
    if (key === '\u006F') {
        var user_index = 1;

        console.log('Список пользователей в системе:');
        for (var i = 0; i < users.length; i++) {
            console.log(user_index + '. ' + users[i]);
            user_index++;
        }
        console.log('');
    }

    /** [d]: показать список пользователей в сети */
    if (key === '\u0064') {
        console.log('Total diff: ' + (tasks_diff / 1000) + ' сек.');
        console.log('Avg: ' + (tasks_diff / tasks.length / 1000) + ' сек.');
        console.log('Total time: ' + ((end_t - start_t) / 1000) + ' сек.');
        console.log('');
    }
});

io.sockets.on('connection', function(socket) {
	
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
	socket.on('registerUser', function(username) {
		socket.username = username;
		users.push(username);

        console.log('[' + getDate() + '] ' + username + ' подключился к системе');
		socket.emit('readyForJob');
	});

    /**
     * Задача выполнена участником и он готов к новой работе.
     */
	socket.on('readyTask', function(task) {
        tasks_diff += task.diff;
		console.log('[' + getDate() + '] ' + socket.username + ' выполнил задачу ID: ' + task.id + ' за ' + (task.diff / 1000) + ' сек.');
        socket.emit('readyForJob');
	});

    /**
     * Получаем первую свободную задачу из списка
     * Отправляем участнику и удаляем из очереди
     * Оповещение других участников о кол-ве доступных задач
     */
	socket.on('getTask', function() {
		var index = undefined;
		for (var i = 0; i < tasks.length; i++) {
			if (tasks[i].status == 0) {
				index = i;
				tasks[i].status = 1;
				break;
			}
		}
		
		if (index !== undefined) {
            console.log('[' + getDate() + '] ' + socket.username + ' взял задачу ID: ' + tasks[index].id);
            socket.emit('processTask', tasks[index]);
		} else {
            // Если задач нет
            end_t = new Date().getTime();
		}
		
		socket.emit('updateTasksInfo', getCountFreeTasks());
	});

    /** Участник отключается от системы */
	socket.on('disconnect', function() {
        // todo-r: освободить задачу, которую делал отключённый участник

        /** Удаляем участника из обешго списка **/
		var index = users.indexOf(socket.username);
		if (index != -1) {
			users.splice(index, 1);
		}
		
		console.log('[' + getDate() + '] ' + socket.username + ' отключился от системы');
	});

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
        task = { id: id, sleep: sleep, status: 0 };
        tasks.push(task);
        i++;
    }
}