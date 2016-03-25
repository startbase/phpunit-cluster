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
        return fail_count != 0 && (fail_count >= this.repeat_attempts_number || fail_count >= this.clients_number);
    };

    this.getTask = function(client_name) {
        var task = false;
        if(!Boolean(this.repeat_attempts_number)) {
            return false;
        }
        for(var i in this.queueTasks.tasks) {
            var item = this.queueTasks.tasks[i];
            if(!this.isFailedTask(item.taskName) && !this.prohStates.count(client_name, item.taskName)) {
                this.queueTasks.rmTask(item.taskName);
                task = item;
                break;
            }
        }
        return task;
    };

    this.needReturnTask = function(client_name, task) {
        if(!!this.repeat_attempts_number) {
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

    this.registerFailed = function(client_name, task) {
        this.prohStates.add(client_name, task.taskName);
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