const EventEmitter = require('events');
const util = require('util');

var Task = function (taskName, params) {
    this.taskName = taskName;
    this.params = params;
};

var Queue = function () {
    /**
     * @type {Task[]}
     */
    this.tasks = [];
    /**
     * @type {Task|null}
     */
    this.lastTask = null;

    /**
     * Добавить задачу в очередь
     * @param {String} taskName
     * @param {Object} [params]
     * @returns Queue
     */
    this.addTask = function (taskName, params) {
        this.tasks.push(new Task(taskName, params));
        this.emit('add', taskName);
        return this;
    };

    /**
     * Получить первый из очереди
     * @returns {Task|Boolean}
     */
    this.getTask = function () {
        if (this.tasks.length == 0) {
            this.emit('empty');
            return false;
        }

        var task = this.tasks.shift();

        this.lastTask = task;
        this.emit('rm', task.taskName);
        return task;
    };

    this.rmTask = function (taskName) {
        var index = NaN;
        for (var i in this.tasks) {
            var task = this.tasks[i];
            if (task.taskName == taskName) {
                index = i;
                break;
            }
        }

        if (!isNaN(index)) {
			this.tasks.splice(index, 1);
            return true;
        }
        return false;
    };

    /**
     * @param {String} taskName
     * @returns {Task|Boolean}
     */
    this.find = function (taskName) {
        for (var key in this.tasks) {
            if (this.tasks[key].taskName == taskName) {
                return this.tasks[key];
            }
        }
        return false;
    };

    /**
     * Проверить есть ли такая задача в очереди
     * @param taskName
     * @returns {boolean}
     */
    this.hasTask = function (taskName) {
        for (var key in this.tasks) {
            if (this.tasks[key].taskName == taskName) {
                return true;
            }
        }
        return false;
    };

    /**
     * Получить последний таск, который был выброшен зи очереди. Может пригодиться например для удобного выполнения callback
     * @returns {Task|null}
     */
    this.getLastTask = function () {
        return this.lastTask;
    };

    EventEmitter.call(this);
};

util.inherits(Queue, EventEmitter);

module.exports = Queue;