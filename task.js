var Task = function (queue) {
    this.queue = queue;

    this.generateTask = function () {
        var limit = 20;
        var i = 1;
        while (i <= limit) {
            var id = Date.now() + '_' + i;
            var params = { calc: 40, process_time: 0 };
            this.queue.addTask(id, params);
            i++;
        }
    };

    this.queue.on('generateTasks', function (obj) {
        obj.generateTask();
    });
};

module.exports = Task;