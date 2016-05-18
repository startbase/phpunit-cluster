var Queue = require('./queue');
var weightBase = require('./weight-base');

var TaskBalancer = function() {
    /** Failed states structure */
    this.prohStates = new (function() {
        var states = [];

        this.add = function(client, taskname) {
            states.push({client: client, task: taskname});
        };

        this.countByTask = function(taskname) {
            var cnt = 0;
            states.forEach(function(item) {
                if(item.task == taskname) {
                    cnt++;
                }
            });
            return cnt;
        };

        this.count = function(client, task) {
            var cnt = 0;
            states.forEach(function(item) {
                if(item.task == task && item.client == client) {
                    cnt++;
                }
            });
            return cnt;
        };

		this.showState = function () {
			console.log(states);
		};

		this.clear = function () {
			states = [];
		};
    })();
    this.queueTasks = new Queue();

    this.repeat_attempts_number = 0;

    this.clients_number = 0;

    /**
     * Check is task failed maximum times
     * @param task_name
     * @returns {boolean}
     */
    this.isMaxFailed = function(task_name) {
        var fail_count = this.prohStates.countByTask(task_name);
        return fail_count != 0 && (fail_count > this.repeat_attempts_number || fail_count >= this.clients_number);
    };

    /**
     * @param {String} client_name
     * @returns {*}
     */
    this.getTask = function(client_name) {
        var task = false;
        if(!Boolean(this.repeat_attempts_number)) {
            return this.queueTasks.getTask();
        }
        for(var i in this.queueTasks.tasks) {
            var item = this.queueTasks.tasks[i];
            if(!this.isMaxFailed(item.taskName) && !this.prohStates.count(client_name, item.taskName)) {
                this.queueTasks.rmTask(item.taskName);
                task = item;
                break;
            }
        }
        return task;
    };

    /**
     * Check can task return to queue
     * @param task
     * @returns {boolean}
     */
    this.canReturnTask = function(task) {
        if(!!this.repeat_attempts_number) {
            if(!this.isMaxFailed(task.taskName)) {
                return true;
            }
        }
        return false;
    };

    /**
     * Register task as failed
     * @param client_name
     * @param task
     */
    this.registerFailed = function(client_name, task) {
        this.prohStates.add(client_name, task.taskName);
    };

    /**
     * Make queue of tests from array
     * After this emmit "queue ready" event
     * @param {Array} data tests list
     */
    this.generateQueue = function(data) {
        var instance = this;

        data.forEach(function(item) {
            instance.queueTasks.addTask(item);
        });

        weightBase.sortTasks(this.queueTasks, function() {
            instance.queueTasks.emit('fill.complete');
        });
    };

    /**
     * Clear balancer state
     */
    this.clearTaskQueue = function() {
        this.queueTasks.tasks = [];
        this.prohStates.clear();
    };

    this.tasksCount = function() {
        return this.queueTasks.tasks.length;
    };
};

module.exports = TaskBalancer;