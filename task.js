var Task = function (queue, parser) {
    this.queue = queue;
    this.parser = parser;

    this.generateTask = function () {
        /*var limit = 20;
        var i = 1;
        while (i <= limit) {
            var id = Date.now() + '_' + i;
            var params = { calc: 40, process_time: 0 };
            this.queue.addTask(id, params);
            i++;
        }*/

        var instance = this;

        this.parser.getTestsArray('../phpunit-cluster-tests/', function(err, results) {
            if(err) {
                throw err;
            }
            instance.generateQueue(results);
        });
    };

    this.generateQueue = function (result) {
        var instance = this;

        result.forEach(function(item) {
            var params = { calc: 40, process_time: 0 };
            instance.queue.addTask(item, params);
        });
        instance.queue.emit('fill.complete');
    };

    this.queue.on('generateTasks', function (obj) {
        obj.generateTask();
    });
};

module.exports = Task;