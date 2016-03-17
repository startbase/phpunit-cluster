var weightBase = require('./libs/weight-base');

var Task = function(queue) {
	this.queue = queue;

	/**
	 * Создаём очередь тестов из списка
	 * В конце вызываем событие "очередь наполнена и готова"
	 *
	 * @param result список тестов в виде массива
	 */
	this.generateQueue = function (result) {
		var instance = this;

		result.forEach(function(item) {
			instance.queue.addTask(item);
		});

		weightBase.sortTasks(this.queue, function() {
			instance.queue.emit('fill.complete');
		});
	};
};

module.exports = Task;