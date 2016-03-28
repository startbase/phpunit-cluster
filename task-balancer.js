var Task = require('./task');
var Queue = require('./queue');
var config = require('./config.js');
var config_params = config.getParams().task_balancer;

var TaskBalancer = function() {
    this.prohStates = new (function() {
        var states = [];

        this.add = function(client, taskname) {
            states.push({client: client, task: taskname});
			console.log('Task Balancer debug [add]');
			console.log(this.states);
			console.log('\n');
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
    })();
    this.queueTasks = new Queue();
    this.task = new Task(this.queueTasks);

    this.repeat_attempts_number = config_params.failed_attempts;

    this.clients_number = 0;

    this.isFailedTask = function(task_name) {
        var fail_count = this.prohStates.countByTask(task_name);
		console.log('Task Balancer debug [isFailedTask]: fail_count = ' + fail_count);
		console.log('Task Balancer debug [isFailedTask]: repeat_attempts_number = ' + this.repeat_attempts_number);
		console.log('Task Balancer debug [isFailedTask]: clients_number = ' + this.clients_number);
        return fail_count != 0 && (fail_count >= this.repeat_attempts_number || fail_count >= this.clients_number);
    };

    this.getTask = function(client_name) {
        console.log('Task Balancer debug [getTask]: ' + client_name);
        var task = false;
        if(!Boolean(this.repeat_attempts_number)) {
            console.log('Task Balancer debug [getTask]: repeat number - ' + this.repeat_attempts_number + ' => false');
            return false;
        }
        for(var i in this.queueTasks.tasks) {
            var item = this.queueTasks.tasks[i];
            console.log('Task Balancer debug [getTask]: item - ' + item.taskName);
            console.log('Task Balancer debug [getTask]: is failed task - ' + this.isFailedTask(item.taskName));
            console.log('Task Balancer debug [getTask]: prohStates.count - ' + this.prohStates.count(client_name, item.taskName));
            if(!this.isFailedTask(item.taskName) && !this.prohStates.count(client_name, item.taskName)) {
                this.queueTasks.rmTask(item.taskName);
                task = item;
				console.log('Task Balancer debug [getTask]: task - ' + task.taskName);
                break;
            }
        }
        return task;
    };

    this.needReturnTask = function(client_name, task) {
        if(!!this.repeat_attempts_number) {
            if(!this.isFailedTask(task.taskName)) {
                return true;
            }
        }
        return false;
    };

    this.registerFailed = function(client_name, task) {
		console.log('Task Balancer debug [registerFailed]');
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