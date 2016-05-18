var Config = new (require('../config'));
var settings = Config.getParams();
var DB = new (require('../libs/db'))(settings['mysql']);

var ClusterLogs = function () {

	/** Название таблицы из конфига */
	this.tablename = settings['mysql']['tables']['cluster_logs'];

	/** Создание таблицы */
	this.createTable = function () {
		var sql = "CREATE TABLE IF NOT EXISTS `" + this.getTableName() + "` ( " +
			"`id` INT(11) NOT NULL AUTO_INCREMENT," +
			"`commit` VARCHAR(255) NOT NULL," +
			"`data` TEXT NOT NULL," +
			"`datetime` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
			"PRIMARY KEY (`id`)" +
			") COLLATE='utf8_general_ci' ENGINE=InnoDB";

		this.query(sql);
	};

	/**
	 * Возвращает поля data последнего пула
	 * @param callback
	 */
	this.getLastPool = function (callback) {
		var params = {
			select: ['data'],
			order: ['datetime', 'DESC']
		};

		this.find([], params, function (row) {
			if (row) {
				callback(JSON.parse(row.data));
			} else {
				callback(null);
			}
		});
	};

	/**
	 * Возвращает данные пула по его ID
	 * @param {Number} id
	 * @param callback
	 */
	this.getPoolById = function (id, callback) {
		this.find(['id = ' + id], [], function (row) {
			if (row) {
				callback(row);
			} else {
				callback(null);
			}
		});
	};

	/**
	 * Возвращает список пулов
	 * @param condition Условие WHERE в виде массива
	 * @param params список дополнительных опций
	 * @param callback
	 */
	this.getPools = function (condition, params, callback) {
		this.findAll([], params, function (rows, total_rows) {
			callback(rows, total_rows);
		});
	};

	/**
	 * Добавляет данные по пулу в таблицу
	 * @param data данные из статистики
	 * @param callback
	 */
	this.addPool = function (data, callback) {
		var sql = "INSERT INTO `" + this.getTableName() + "` (`commit`, `data`) VALUES (?, ?)";
		var values = [data.commit_hash, JSON.stringify(data)];

		this.query(sql, values, callback);
	};

	this.createTable();
};

ClusterLogs.prototype = DB;
module.exports = ClusterLogs;
