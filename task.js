var Task = function(queue) {
    this.queue = queue;

	/**
	 * ������ ������� ������ �� ������
	 * � ����� �������� ������� "������� ��������� � ������"
	 *
	 * @param result ������ ������ � ���� �������
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