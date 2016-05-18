var http = require("http");
var fs = require("fs");
var path = require("path");
var mime = require("mime");
var url = require("url");

var Config = new (require('../config'));
var settings = Config.getParams();

var PoolList = new (require("./render-list"));
var PoolDetail = new (require("./render-detail"));

var ClusterLogs = new (require('../models/cluster-logs'));

const __DIR__ = path.dirname(process.mainModule.filename);
/** @type {number} Количество билдов на странице */
const POOL_PER_PAGE = 20;

var server = http.createServer(function(request, response) {
	/** Парсим URI */
	var uri = url.parse(request.url, true);
	/** Путь до файла */
	var pathname = __DIR__ + uri.pathname;

	/**
	 * Для корня/главной сайта или детальной страницы будем использовать шаблон
	 * @type {boolean}
	 */
	var render = uri.pathname == '/' || uri.pathname == '/index.html' || uri.pathname == '/detail.html';
	if (render) {
		pathname = __DIR__ + '/templates/main.html';
	}

	fs.readFile(pathname, function (err, data) {
		if (err) {
			renderPage(response, 404, 'text/plain', 'Page not found');
			return;
		}

		var content = data;
		if (render) {
			switch (uri.pathname) {
				case '/':
				case '/index.html':
					var params = {
						order: ['datetime', 'DESC'],
						limit: getSqlLimit(uri.query.page),
						use_calc_rows: true
					};
					ClusterLogs.getPools([], params, function(pools, total_rows) {
						var prepareContent = PoolList.render({
							pools: pools,
							current_page: uri.query.page,
							per_page: POOL_PER_PAGE,
							total_pools: total_rows
						});

						content = data.toString('utf8').replace(new RegExp("{content}", 'g'), prepareContent);
						renderPage(response, 200, mime.lookup(path.basename(pathname)), content);
					});
					break;
				case '/detail.html':
					ClusterLogs.getPoolById(uri.query.id, function(pool) {
						var prepareContent = PoolDetail.render(pool);
						content = data.toString('utf8').replace(new RegExp("{content}", 'g'), prepareContent);
						renderPage(response, 200, mime.lookup(path.basename(pathname)), content);
					});
					break;
			}
		} else {
			renderPage(response, 200, mime.lookup(path.basename(pathname)), content);
		}
	});
});

server.listen(settings['ports']['web']);

/**
 * Отдаём контент клиенту
 * @param response
 * @param status HTTP код ответа
 * @param mime
 * @param content
 */
function renderPage(response, status, mime, content) {
	response.writeHead(status, {"Content-type" : mime});
	response.write(content);
	response.end();
}

/**
 * Формирует LIMIT
 * @param page
 * @returns {string}
 */
function getSqlLimit(page) {
	var offset = 0;

	if (page === undefined || page < 1) {
		page = 1;
	}

	if (page > 1) {
		offset = (page - 1) * POOL_PER_PAGE;
	}

	return offset + ', ' + POOL_PER_PAGE;
}
