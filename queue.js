const EventEmitter = require('events');
const util = require('util');

var Task = function (taskName, callback) {
    this.taskName = taskName;
    this.callback = callback;
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
     * @param {Function|null} [callback]
     * @returns Queue
     */
    this.addTask = function (taskName, callback) {
        this.tasks.push(new Task(taskName, callback));
        this.emit('add');
        return this;
    };

    /**
     * Получить первый из очереди
     * @returns {Task}
     */
    this.getTask = function () {
        var task = this.tasks.shift();
        this.lastTask = task;
        this.emit('rm');
        if (!this.tasks.length) {
            this.emit('empty');
        }
        return task;
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

module.exports = new Queue();