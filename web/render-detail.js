var ta = require('time-ago')();

function issueLink(message) {
	var issue = message.match(/issue_.*-[0-9]{1,6}/g);
	if (issue != null && issue.length > 0) {
		var task = issue[0].replace(/issue_/g, '');
		message = message.replace(issue, '<a href="https://jira.b2b-center.ru/browse/' + task + '" target="_blank" rel="noopener">' + issue[0] + '</a>');
	}

	return message;
}

function groupCommitsByAuthors(commits_merge) {
	if (commits_merge.length == 0) {
		return [];
	}

	var groupCommits = [];
	commits_merge.forEach(function (commit) {
		var author = commit.author_name;
		var message = commit.message;

		if (!(author in groupCommits)) {
			groupCommits[author] = [];
		}

		var head_pos = message.indexOf(" (HEAD, ");
		if (head_pos > 0) {
			message = message.substring(0, head_pos);
		}

		message = message.replace(/'/g, '"');

		var position = groupCommits[author].indexOf(message);
		if (position == -1) {
			groupCommits[author].push(issueLink(message));
		}
	});

	return groupCommits;
}

var PoolDetail = function () {

	this.render = function (pool) {
		if (pool == null) {
			return '<h5 class="text-center"">Build not found</h5>';
		}

		var header = this.header(pool.id);
		var content = this.content(pool);
		var tests = this.tests(JSON.parse(pool.data).failed_tests);

		return header + content + tests;
	};

	this.header = function (pool_id) {
		var content = '';
		content += '<ul class="breadcrumb">';
		content += '	<li><a href="/">B2B-Center</a></li>';
		content += '	<li class="active">Integration</li>';
		content += '	<li class="active">Build #' + pool_id + '</li>';
		content += '</ul>';

		return content;
	};

	this.content = function (pool) {
		var detail = this.detail(pool);
		var commits = this.commits(pool);

		var content = '';
		content += '<div class="row">';
		content += '	<div class="col-sm-6">' + detail + '</div>';
		content += '	<div class="col-sm-6">' + commits + '</div>';
		content += '</div>';

		return content;
	};

	this.detail = function (pool) {
		var data = JSON.parse(pool.data);
		var content = '';
		content += '<table class="table ">';
		content += '	<thead>';
		content += '		<tr>';
		content += '			<th colspan="4" class="text-center bg-primary">Время выполнения</th>';
		content += '		</tr>';
		content += '		<tr>';
		content += '			<th class="col-sm-3">Всего</th>';
		content += '			<th class="col-sm-3">PHP Unit</th>';
		content += '			<th class="col-sm-3">Теста (average)</th>';
		content += '			<th class="col-sm-3">Повторы для заваленых</th>';
		content += '		</tr>';
		content += '	</thead>';
		content += '	<tbody>';
		content += '		<tr>';
		content += '			<td>' + data.build_time + ' сек.</td>';
		content += '			<td>' + data.phpunit_time + ' сек.</td>';
		content += '			<td>' + data.test_avg_time + ' сек.</td>';
		content += '			<td>' + data.phpunit_repeat_time + ' сек.</td>';
		content += '		</tr>';
		content += '	</tbody>';
		content += '</table>';
		content += '<br />';
		content += '<table class="table">';
		content += '	<thead>';
		content += '		<tr>';
		content += '			<th>Всего тестов</th>';
		content += '			<th>Успешно пройдено</th>';
		content += '			<th>Завалено</th>';
		content += '		</tr>';
		content += '	</thead>';
		content += '	<tbody>';
		content += '		<tr>';
		content += '			<td><span class="text-info">' + data.tests_total_count + '</span></td>';
		content += '			<td><span class="text-success">' + (data.tests_total_count - Object.keys(data.failed_tests).length) + '</span></td>';
		content += '			<td><span class="text-danger">' + Object.keys(data.failed_tests).length + '</span></td>';
		content += '		</tr>';
		content += '	</tbody>';
		content += '</table>';
		content += '<p><strong>Complete:</strong> ' + ta.ago(pool.build_date) + '</p>';
		content += '<p><strong>Commit hash:</strong> ' + data.commit_hash + '</p>';

		return content;
	};

	this.commits = function (pool) {
		var commits = JSON.parse(pool.data).commits_merge;
		var authors_commits = groupCommitsByAuthors(commits);

		var content = '';
		content += '<table class="table table-striped table-hover">';
		content += '	<thead>';
		content += '		<tr>';
		content += '			<th colspan="2" class="text-center bg-primary">Коммиты, вошедшие в билд</th>';
		content += '		</tr>';
		content += '	</thead>';
		content += '	<tbody>';

		for (var author in authors_commits) {
			if (authors_commits.hasOwnProperty(author)) {
				content += '<tr>';
				content += '	<td>' + author + '</td>';
				content += '	<td>' + authors_commits[author].join('<br />') + '</td>';
				content += '</tr>';
			}
		}

		content += '	</tbody>';
		content += '</table>';

		return content;
	};

	this.tests = function (failed_tests) {
		if (Object.keys(failed_tests).length == 0) {
			return '';
		}

		var content = '';
		content += '<div class="row">';
		content += '	<div class="col-sm-12">';
		content += '		<table class="table table-striped table-hover">';
		content += '			<thead>';
		content += '				<tr>';
		content += '					<th class="text-center bg-primary">Заваленные тесты</th>';
		content += '				</tr>';
		content += '			</thead>';
		content += '			<tbody>';
		content += '				<tr>';
		content += '					<td>';
		content += '						<div class="panel-group" id="accordion">';

		var index = 0;
		for (var pathname in failed_tests) {
			if (failed_tests.hasOwnProperty(pathname)) {
				content += '<div class="panel panel-default">';
				content += '	<div class="panel-heading">';
				content += '		<h4 class="panel-title">';
				content += '			<a data-toggle="collapse" data-parent="#accordion" href="#collapse' + index + '">' + pathname.replace(/\/var\/reps\/b2bcenter/g, '') + '</a>';
				content += '		</h4>';
				content += '	</div>';
				content += '	<div id="collapse' + index + '" class="panel-collapse collapse out suites">';
				content += '		<div class="panel-body">';
				content += '			<ul class="list-group">';

				failed_tests[pathname].forEach(function (suite) {
					content += '<li class="list-group-item">' + suite + '</li>';
				});

				content += '			</ul>';
				content += '		</div>';
				content += '	</div>';
				content += '</div>';
			}

			index++;
		}

		return content;
	};
};

module.exports = PoolDetail;
