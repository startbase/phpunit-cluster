var Task = function (queue) {
    this.queue = queue;

    this.generateTask = function () {
        var limit = 20;
        var i = 1;
        while (i <= limit) {
            var id = Date.now() + '_' + i;
            this.queue.addTask(id, function () {
                return Math.floor(Math.random() * (40 - 40 + 1) + 40);
            });
            i++;
        }
    };

    this.queue.on('generateTasks', function (obj) {
        obj.generateTask();
    });
};

module.exports = Task;