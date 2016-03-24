var Task = require('./task');
var Queue = require('./queue');
var config = require('./config.js');
var config_params = config.getParams().task_balancer;

var TaskBalancer = function() {
    this.prohStates = new (function() {
        var states = [];

        this.add = function(client, task) {
            states.push({client: client, task: task});
        };

        this.countByTask = function(task) {
            var cnt = 0;
            states.forEach(function(item) {
                if(item.task == task) {
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
    })();
    this.queueTasks = new Queue();
    this.task = new Task(this.queueTasks);

    this.repeat_attempts_number = config_params.failed_attempts;

    this.clients_number = 0;

    this.isFailedTask = function(task_name) {
        var fail_count = this.prohStates.countByTask(task_name);
        return fail_count != 0 && (fail_count > this.repeat_attempts_number || fail_count >= this.clients_number);
    };

    this.getTask = function(client_name) {
        do {
            var task = this.queueTasks.getTask();
            if(task == false || !Boolean(this.repeat_attempts_number)) {
                break;
            }
            var has_client_fail = !!this.prohStates.count(client_name, task.taskName);
            if(has_client_fail) {
                this.queueTasks.addTask(task.taskName, task.params);
            }
        } while(has_client_fail || this.isFailedTask(task.taskName));

        return task;
    };

    this.returnFailedToQueue = function(client_name, task) {
        if(!!this.repeat_attempts_number) {
            this.prohStates.add(client_name, task.taskName);
            if(this.isFailedTask(task.taskName)) {
                //not return task to the queue
                return false;
            }
            else {
                //return task to the queue
                this.queueTasks.addTask(task.taskName, task.params);
                return true;
            }
        }
        return false;
    };

    this.fillTaskQueue = function(data) {
        this.task.generateQueue(data);
    };

    this.clearTaskQueue = function() {
        this.queueTasks.tasks = [];
        this.prohStates.states = [];
    };

    this.tasksCount = function() {
        return this.queueTasks.tasks.length;
    };
};

module.exports = TaskBalancer;