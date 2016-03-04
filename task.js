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
			var params = {};
			instance.queue.addTask(item, params);
		});

		instance.queue.emit('fill.complete');
	};
};

module.exports = Task;