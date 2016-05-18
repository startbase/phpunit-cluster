var nodemailer = require('nodemailer');

/**
* Человеко понятное время
* @returns {string}
*/
function getDate() {
	var date = new Date();
	return date.toLocaleString();
}

var Mailer = function (settings) {
	this.transporter = null;

	this.mailOptions = {
		from: settings['smtp']['from'],
		subject: '[PHP Unit Cluster] Tests status has been changed'
	};

	this.smtpConfig = {
		host: settings['smtp']['host'],
		port: settings['smtp']['port'],
		secure: true,
		auth: {
			user: settings['smtp']['auth']['user'],
			pass: settings['smtp']['auth']['pass']
		}
	};

	this.init = function () {
		this.transporter = nodemailer.createTransport(this.smtpConfig);

		this.transporter.verify(function (err) {
			if (err) {
				console.log('[' + getDate() + '] SMTP verify error:\n');
				console.log(err);
			} else {
				console.log('[' + getDate() + '] Server is ready to take our messages');
			}
		});
	};

	/**
	* Отправляем письма
	*
	* @param {Object} mailOptions
	*/
	this.sendMail = function (mailOptions) {
		this.transporter.sendMail(mailOptions, function (err, info) {
			if (err) {
				console.log('[' + getDate() + '] Send email error:');
				console.log(err);
				return;
			}

			console.log('[' + getDate() + '] Send email info:');
			console.log(info.response);
		});
	};

	/**
	* Готовим сообщения для отправки
	*
	* @param {Object} notification
	*/
	this.prepareMails = function (notification) {
		/** Если нет коммитеров и никаких тестов не исправили, то и уведомлять некого */
		if (notification.commit_authors.length == 0 && notification.repair_tests.length == 0) {
			console.log('[' + getDate() + '] Коммитеров и исправленых тестов нет. Уведомлений не отправляем.');
			return;
		}

		/** Если нет новых сломаных тестов или исправленых, то и уведомлять некого */
		if (notification.broken_tests.length == 0 && notification.repair_tests.length == 0) {
			console.log('[' + getDate() + '] Ничего не сломали и не исправили. Уведомлений не отправляем.');
			return;
		}

		var receivers = notification.commit_authors.join(', ');
		console.log('[' + getDate() + '] Коммитеры текущего пула:');
		console.log(receivers);
		var lucky_receivers = this.getAuthorsForRepairNotify(receivers, notification.repair_tests);
		console.log('[' + getDate() + '] Коммитеры, чьи тесты были исправлены без них:');
		console.log(lucky_receivers);

		var html = this.getHeader(notification.commit_authors, notification.commit_hash);

		if (notification.repair_tests.length > 0) {
			html += "<br /><h4 style='color: darkgreen;'>Исправленные тесты:</h4>" + this.getTestInfoForMail(notification.repair_tests);
		}

		if (lucky_receivers.length > 0) {
			console.log('[' + getDate() + '] Отправляем уведомления коммитерам, чьи тесты были исправлены без них...');
			//this.mailOptions.to = lucky_receivers.join(', ');
			this.mailOptions.to = settings['emails']['support'];
			this.mailOptions.html = html;
			this.sendMail(this.mailOptions);
		}

		if (notification.broken_tests.length > 0) {
			html += "<br /><h4 style='color: red;'>Сломанные тесты:</h4>" + this.getTestInfoForMail(notification.broken_tests);
		}

		console.log('[' + getDate() + '] Отправляем уведомления текущим коммитерам');
		//this.mailOptions.to = receivers;
		this.mailOptions.to = settings['emails']['support'];
		this.mailOptions.html = html;
		this.sendMail(this.mailOptions);
	};

	/**
	* Формируем шапку письма из даты, хеша и авторов коммита
	*
	* @param {Array} commit_authors
	* @param {String} commit_hash
	* @returns {String}
	*/
	this.getHeader = function(commit_authors, commit_hash) {
		var header = '<p>Дата: ' + getDate() + '<br />Commit Hash: ' + commit_hash + '</p>';
		header += '<p>Изменения в <strong>integration</strong> от:' +
		'<ul>';

		commit_authors.forEach(function (author) {
			header += '<li>' + author + '</li>';
		});

		header += '</ul></p>';

		return header;
	};

	/**
	* Преобразовываем массив тестов в список для сообщения
	*
	* @param {Array} tests
	* @returns {String}
	*/
	this.getTestInfoForMail = function (tests) {
		var groupTest = [];
		var html = '<ol>';

		tests.forEach(function (test) {
			var path = test['path'];
			var suite = test['suitename'];

			if (!(path in groupTest)) {
				groupTest[path] = [];
			}

			groupTest[path].push(suite);
		});

		for (var key in groupTest) {
			html += '<li><strong>' + key + '</strong>';

			if (groupTest.hasOwnProperty(key)) {
				html += '<ul>';
				groupTest[key].forEach(function (suitename) {
					html += '<li>' + suitename + '</li>';
				});
				html += '</ul>';
			}

			html += '</li>';
		}

		html += '</ol>';

		return html;
	};

	/**
	* Возвращает список коммитеров, чьи тесты были исправлены, но не ими.
	* Этим коммитерам будет выслано отдельное уведомление,
	* содержащие только список исправленных тестов.
	*
	* @param {String} excluded_authors
	* @param {Array} repaired_tests
	* @returns {Array}
	*/
	this.getAuthorsForRepairNotify = function (excluded_authors, repaired_tests) {
		if (repaired_tests.length == 0) {
			return [];
		}

		var notifyBrokeAuthors = [];

		repaired_tests.forEach(function (tests) {
			var authors = tests.broke_authors.split(', ');

			authors.forEach(function (author) {
				if (excluded_authors.indexOf(author) == -1 && notifyBrokeAuthors.indexOf(author) == -1) {
					notifyBrokeAuthors.push(author);
				}
			});
		});

		return notifyBrokeAuthors;
	};

	this.init();
};

module.exports = Mailer;
