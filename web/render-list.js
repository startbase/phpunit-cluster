var ta = require('time-ago')();

/**
 * Вырезает из истории коммитов автора(-ов) и возвращает в виде массива
 *
 * @param {Array} commits_merge
 * @returns {Array}
 */
function getCommitAuthors(commits_merge) {
	if (commits_merge.length == 0) {
		return [];
	}

	var authors = [];
	commits_merge.forEach(function (commit) {
		var author = commit.author_email;

		if (authors.indexOf(author) == -1) {
			authors.push(author);
		}
	});

	return authors;
}

/**
 * Возвращает список авторов в удобном для веба виде
 *
 * @param {Array} authors
 * @param {Number} pool_id
 * @returns {String}
 */
function getAuthorsForWeb(authors, pool_id) {
	if (authors.length < 3) {
		return authors.join(', ');
	}

	if (authors.length > 2) {
		var count = authors.length - 2;
		return authors[0] + ', ' + authors[1] + ' and <a href="/detail.html?id=' + pool_id + '">' + count + ' others</a>';
	}

	return '';
}

var PoolList = function () {

	this.render = function (data) {
		var header = this.header();
		var table = this.table(data.pools);
		var pagination = this.pagination(data.current_page, data.per_page, data.total_pools);

		return header + table + pagination;
	};

	this.table = function (pools) {
		var content = '';
		content += '<table class="table table-striped table-hover">';
		content += '	<thead>';
		content += '		<tr>';
		content += '			<th>Build</th>';
		content += '			<th>Commit authors</th>';
		content += '			<th>Build time</th>';
		content += '			<th>Date</th>';
		content += '		</tr>';
		content += '	</thead>';
		content += '	<tbody>';
		content += '		' + this.pool_row(pools);
		content += '	</tbody>';
		content += '</table>';

		return content;
	};

	this.pool_row = function (pools) {
		if (pools.length == 0) {
			return '<tr><td colspan="4">Builds not found</td></tr>';
		}

		var content = '';
		pools.forEach(function (pool) {
			var data = JSON.parse(pool.data);
			var authors = getCommitAuthors(data.commits_merge);
			var status = 'successful';
			if (data.tests_failed_count > 0) {
				status = 'failed';
			}

			content += '<tr>';
			content += '	<td class="' + status + '"><a href="/detail.html?id=' + pool.id + '"><span class="icon"></span> #' + pool.id + '</a></td>';
			content += '	<td>' + getAuthorsForWeb(authors, pool.id) + '</td>';
			content += '	<td>' + data.time_pool + ' sec</td>';
			content += '	<td>' + ta.ago(pool.datetime) + '</td>';
			content += '</tr>';
		});

		return content;
	};

	this.header = function () {
		var content = '';
		content += '<ul class="breadcrumb">';
		content += '	<li><a href="/">B2B-Center</a></li>';
		content += '	<li class="active">Integration</li>';
		content += '</ul>';

		return content;
	};

	this.pagination = function (current_page, per_page, total) {
		if (total <= per_page) {
			return '';
		}

		if (current_page === undefined || current_page < 1) {
			current_page = 1;
		}

		var count_pages = Math.ceil(total / per_page);
		var content = '<ul class="pagination">';
		var pages = [];

		for (var i = 1; i <= count_pages; i++) {
			if (i == current_page) {
				pages.push('<li class="active"><a href="#">' + i + '</a></li>');
			} else {
				pages.push('<li><a href="/?page=' + i + '">' + i + '</a></li>');
			}
		}

		content += pages.join(' &nbsp; ');
		content += '</ul>';

		return content;
	};
};

module.exports = PoolList;
