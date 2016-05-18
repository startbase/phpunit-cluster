var mysql = require('mysql');

var DB = function (settings) {

	/** Устанавливает соединение с БД */
	this.getNewConnection = function () {
		return mysql.createConnection({
			user: settings['user'],
			password: settings['password'],
			database: settings['database']
		});
	};

	/**
	 * Возвращает название таблицы
	 * @returns {String}
	 */
	this.getTableName = function () {
		return this.tablename;
	};

	/**
	 * Собирает SQL запрос.
	 * Пример использования condition: ['id = 1', 'age < 30']
	 * Пример использования params:
	 * {
	 * 		select: ['id', 'data'],
	 * 		order: ['age', 'DESC'],
	 * 		limit: '0, 10',
	 * 		use_calc_rows: true
	 * }
	 *
	 * @param condition условие WHERE
	 * @param params
	 * @returns {String}
	 */
	this.getQueryString = function (condition, params) {
		var select = '*';
		if (params['select'] && params['select'].length > 0) {
			select = params['select'].join(', ');
		}

		var calc = '';
		if (params['use_calc_rows'] == true) {
			calc = 'SQL_CALC_FOUND_ROWS ';
		}

		var where = '';
		if (condition && condition.length > 0) {
			where = 'WHERE ' + condition.join(' AND ');
		}

		var order = '';
		if (params['order'] && params['order'].length > 0) {
			order = 'ORDER BY ' + params['order'][0] + ' ' + params['order'][1];
		}

		var limit = '';
		if (params['limit']) {
			limit = 'LIMIT ' + params['limit'];
		}

		var tableName = this.getTableName();

		return "SELECT " + calc + select + " FROM " + tableName + " " + where + " " + order + " " + limit;
	};

	/**
	 * Возвращает общее количество записей в таблице
	 * @param connection
	 * @param callback
	 */
	this.getFoundRows = function (connection, callback) {
		var self = this;

		var query = {
			sql: "SELECT FOUND_ROWS() as count",
			rowsAsArray: true
		};

		connection.query(query, function(err, results) {
			if (err) {
				self.queryError({
					message: '\n[MYSQL] DB ERROR (getFoundRows):',
					error: err,
					query: query
				}, callback);
				return;
			}

			callback(results[0]['count']);
		});
	};

	/**
	 * Возвращает данные одной записи
	 * @param condition
	 * @param params
	 * @param callback
	 */
	this.find = function (condition, params, callback) {
		var self = this;

		params['limit'] = 1;
		var query = {
			sql: this.getQueryString(condition, params),
			rowsAsArray: true
		};

		var connection = this.getNewConnection();
		connection.connect();
		connection.query(query, function(err, rows) {
			if (err) {
				self.queryError({
					message: '\n[MYSQL] DB ERROR (find):',
					error: err,
					query: query
				}, callback);
				return;
			}

			callback(rows[0]);
		});
		connection.end();
	};

	/**
	 * Возвращает данные нескольких записей
	 * @param condition
	 * @param params
	 * @param callback
	 */
	this.findAll = function (condition, params, callback) {
		var self = this;

		var query = {
			sql: this.getQueryString(condition, params),
			rowsAsArray: true
		};

		var connection = this.getNewConnection();
		connection.connect();
		connection.query(query, function(err, rows) {
			if (err) {
				self.queryError({
					message: '\n[MYSQL] DB ERROR (findAll):',
					error: err,
					query: query
				}, callback);
				return;
			}

			if (params['use_calc_rows'] == true) {
				self.getFoundRows(connection, function(found_rows) {
					callback(rows, found_rows);
				});
			} else {
				callback(rows);
			}

			connection.end();
		});
	};

	/**
	 * Выполняет обычный SQL запрос. Использовать для INSERT, UPDATE, DELETE
	 * @param {String} sql
	 * @param {Array} values
	 * @param callback
	 */
	this.query = function (sql, values, callback) {
		var self = this;

		var query = {
			sql: sql,
			values: values
		};

		var connection = this.getNewConnection();
		connection.connect();
		connection.query(query, function (err) {
			if (err) {
				self.queryError({
					message: '\n[MYSQL] DB ERROR (query):',
					error: err,
					query: query
				});
				return;
			}

			if (callback) {
				callback();
			}
		});
		connection.end();
	};

	/**
	 * Выводит в консоль ошибку
	 * @param params
	 * @param callback
	 */
	this.queryError = function (params, callback) {
		if (params['message']) {
			console.log(params['message']);
		}

		if (params['error']) {
			console.log(params['error']);
		}

		if (params['query']) {
			console.log(params['query']);
		}

		var value = {};
		if (params['value']) {
			value = params['value'];
		}

		if (callback) {
			callback(value);
		}
	};
};

module.exports = DB;
