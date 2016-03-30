var mysql = require('mysql2');
var colors = require('colors');

var LogAgregator = function (config) {
    this.stack = [];

    this.init = function () {
        var self = this;
        var connection = this.getNewConnection();
        connection.query("CREATE TABLE IF NOT EXISTS `" + config.logAgregator.table + "` ( " +
            "`id` INT(11) NOT NULL AUTO_INCREMENT," +
            "`commit` VARCHAR(32) NOT NULL," +
            "`data` TEXT NOT NULL," +
            "`datetime` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
            "PRIMARY KEY (`id`)" +
            ") COLLATE='utf8_general_ci' ENGINE=InnoDB", function (err, result) {

            if (err) {
                console.log("CLUSTER: >>>>>>>>>>>>>>>\n".red);
                console.log(err);
            }
            connection.close();
            self.startInterval();
        });
    };

    this.getNewConnection = function () {
        return mysql.createConnection({
            user: config.logAgregator.user,
            password: config.logAgregator.password,
            database: config.logAgregator.database
        });
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
                connection.prepare("INSERT INTO `" + config.logAgregator.table + "` (`commit`, `data`) VALUES (?, ?)", function (err, statement) {
                    statement.execute([data.commit_hash, JSON.stringify(data)], function (err, rows, columns) {
                        if (err) {
                            console.log("CLUSTER: >>>>>>>>>>>>>>>\n".red);
                            console.log(err.red);
                        }
                        connection.close();
                    });
                });
            }
        }, 1000);
    };

    this.push = function (data) {
        this.stack.push(data);
    };

    this.init();
};
module.exports = LogAgregator;