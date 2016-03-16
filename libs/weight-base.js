var fs = require('fs');

function sortByWeight(task_1, task_2) {
	if (task_1.weight < task_2.weight || (task_1.weight === undefined && task_2.weight > 0)) {
		return 1;
	}

	if (task_1.weight > task_2.weight || (task_1.weight > 0 && task_2.weight === undefined)) {
		return -1;
	}

	return 0;
}

var WeightBase = function () {
	this.weightsFile = './weight.json';

	this.weightsPool = [];

	this.resetPool = function () {
		this.weightsPool = [];
	};

	this.addWeight = function (data) {
		this.weightsPool.push(data);
	};

	this.sortTasks = function(queueTasks, callback) {
		if (fs.existsSync(this.weightsFile)) {
			fs.readFile(this.weightsFile, function(err, data) {
				if (err) throw err;

				var weightTasks = JSON.parse(data);

				weightTasks.forEach(function(item) {
					var foundTask = queueTasks.find(item.taskName);
					if (foundTask) {
						foundTask.weight = item.weight;
					}
				});

				queueTasks.tasks.sort(sortByWeight);

				callback();
			});
		} else {
			callback();
		}
	};

	this.saveWeights = function(callback) {
		var data = JSON.stringify(this.weightsPool);

		fs.writeFile(this.weightsFile, data, function(err) {
			if (err) throw err;

			callback();
		});
	};
};

module.exports = new WeightBase();