var mysql = require('mysql');

var ClusterLogs = function (config) {

	this.tablename = config.mysql.tables.cluster_logs;

	this.stack = [];

	this.init = function () {
		var self = this;
		var connection = this.getNewConnection();
		var query = "CREATE TABLE IF NOT EXISTS `" + self.tablename + "` ( " +
			"`id` INT(11) NOT NULL AUTO_INCREMENT," +
			"`commit` VARCHAR(255) NOT NULL," +
			"`data` TEXT NOT NULL," +
			"`datetime` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
			"PRIMARY KEY (`id`)" +
			") COLLATE='utf8_general_ci' ENGINE=InnoDB";

		connection.connect();
		connection.query(query, function (err, result) {
			if (err) {
				console.log('\n[MYSQL] CLUSTER LOGS ERROR (init):');
				console.log(err);
				console.log(query);
			}
			self.startInterval();
		});
		connection.end();
	};

	this.getNewConnection = function () {
		return mysql.createConnection({
			user: config.mysql.user,
			password: config.mysql.password,
			database: config.mysql.database
		});
	};

	this.getLastPoolData = function (callback) {
		var self = this;
		var connection = self.getNewConnection();
		var query = "SELECT `data` FROM `" + self.tablename + "` ORDER BY `datetime` DESC LIMIT 1";

		connection.connect();
		connection.query(query, function(err, rows) {
			if (err) {
				console.log('\n[MYSQL] CLUSTER LOGS ERROR (getLastPoolData):');
				console.log(err);
				console.log(query);
			} else {
				if (rows.length > 0) {
					callback(JSON.parse(rows[0].data));
				} else {
					callback({});
				}
			}
		});
		connection.end();
	};

	this.startInterval = function () {
		var self = this;
		setInterval(function () {
			if (!self.stack.length) {
				return;
			}

			var data = self.stack.shift();

			if (data) {
				var connection = self.getNewConnection();
				var query = "INSERT INTO `" + self.tablename + "` (`commit`, `data`) VALUES (?, ?)";

				connection.connect();
				connection.query(query, [data.commit_hash, JSON.stringify(data)], function(err, rows) {
					if (err) {
						console.log('\n[MYSQL] CLUSTER LOGS ERROR (startInterval):');
						console.log(err);
						console.log(query);
					}
				});
				connection.end();
			}
		}, 1000);
	};

	this.push = function (data) {
		this.stack.push(data);
	};

	this.init();
};

module.exports = ClusterLogs;
