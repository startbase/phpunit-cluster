var App = App || {};
var socket = io('http://' + window.location.hostname + ':8099');

function cut(str, substr) {
    var cutStart = str.indexOf(substr);
    var cutEnd = cutStart + substr.length - 1;

    if (cutStart == -1) {
        return str;
    }

    return str.substr(0, cutStart) + str.substr(cutEnd + 1);
}

function processDir(dir) {
    var base_dir = '/var/reps/b2bcenter';
    return cut(dir, base_dir);
}

/**
 * Человеко понятное время
 *
 * @returns {string}
 */
function getDate() {
    var date = new Date();
    return date.toLocaleString();
}


App.main = function () {
    var self = this;

    this.connect_status = socket.connected;

    this.repaintIframe = function () {
        var iframe = $('#ourframe', parent.document.body);
        iframe.height($(document.body).height());
    };

    this.addManualRunnerHandler = function () {
        var btn = $('#manual-runner');
        btn.on('click', function () {
            $(this).prop('disabled', true);
            socket.emit('manual.run');
        });
    };

    this.renderAlert = function() {
        var alertTop = $('#alert-top');
        if (self.connect_status) {
            alertTop.addClass('hidden');
        }
        else {
            alertTop.removeClass('hidden');
        }
    };
    
    this.stats_init = function (data) {
        var data_obj = JSON.parse(data);
        data_obj.commits_history = self.getCommitsHistory(data_obj.commit_history);
        self.renderStatsText(data_obj);
        self.repaintIframe();
    };

    this.start = function (data) {
		var currentTestInfoHtml = '<p><strong>Время запуска:</strong> <span class="start-time">' + new Date(data.date_start).toLocaleString() + '</span></p>' +
			'<p><strong>Текущий commit hash</strong>: <span class="commit-hash">' + data.commit_hash + '</span></p>';
        var progressBarHtml = '<div class="progress" id="tests-progress">' +
            '<div class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" style="width: 0;">' +
            '<span>0</span>' +
            '</div>' +
            '</div>';
        $('#current-info-tests').empty().html(currentTestInfoHtml + progressBarHtml);
		self.repaintIframe();
    };

    this.update = function (data) {
        console.log('update', data);

        if (!data.count_tasks) {
            return;
        }

		var it = $('#current-info-tests');
		// Обновление даты старта
		it.find('span.start-time').html(new Date(data.date_start).toLocaleString());
		// Обновление commit hash
		it.find('span.commit-hash').html(data.commit_hash);

        var tp = $('#tests-progress');
        if (!tp.size()) {
            self.start(data);
        }
        var pb = tp.find('.progress-bar');
        pb.attr('aria-valuemax', data.count_tasks);
        var percent = Math.ceil((100 / parseInt(pb.attr('aria-valuemax'))) * data.tests_overall_count);
        pb.css('width', percent + '%');
        pb.find('span').text(percent + '% Complete');
		self.repaintIframe();
    };

    this.renderStatsText = function(data) {
        var resultHtml = '<p><strong>Данные по последнему выполненому пулу</strong></p>' +
            '<table class="table table-striped">' +
            '<tr><td class="col-xs-3">Время выполнения пула: </td><td class="col-xs-9">' + new Date(data.date_finish).toLocaleString() + '</td></tr>' +
            '<tr><td>Ветка: </td><td>integration</td></tr>' +
            '<tr><td>Commit Hash: </td><td>' + data.commit_hash + '' + data.commits_history + '</td></tr>' +
            '<tr><td>Всего пройдено тестов: </td><td>' + data.tests_overall_count + '</td></tr>' +
            '<tr><td>Успешно пройдено тестов: </td><td>' + data.tests_success_count + '</td></tr>' +
            '<tr><td>Завалено тестов: </td><td>' + data.tests_failed_count + '</td></tr>' +
            '<tr><td>Время выполнения пула: </td><td>' + data.time_pool + '</td></tr>' +
            '<tr><td>Общее время выполнения в PHPUnit: </td><td>' + (data.time_overall).toFixed(4) + ' сек.</td></tr>' +
            '</table>';

        $('#last-info-tests').empty().html(resultHtml);
    };

    this.getCommitsHistory = function (commit_history) {
        var commits_history = '';
        if (commit_history.length > 0) {
            commits_history += '<br /><br />';
            commit_history.forEach(function (commit) {
                commits_history += '<p>' + commit + '</p>';
            });
        }

        return commits_history;
    };

    this.complete = function (data) {
        data.commits_history = self.getCommitsHistory(data.commit_history);

        // progress-bar-success
        var pb = $('#tests-progress').find('.progress-bar');
        if (data.tests_failed_count) {
            pb.addClass('progress-bar-danger');
        } else {
            pb.addClass('progress-bar-success');
        }

        self.renderStatsText(data);
        self.repaintIframe();
    };

    this.reset = function () {
        setTimeout(function () {
            window.location.reload();
        }, 3000);
    };

	this.users_update = function (data) {
		var users_count = data.length;
		var users_list = '';
		// Количество
		$('span.users-count').html(users_count);
		// Список пользователей
		if (users_count > 0) {
			data.forEach(function (user) {
				users_list += user[0] + ', ';
			});
			users_list = users_list.substring(0, users_list.length - 2)
		}
		$('#users-list').html(users_list);
		self.repaintIframe();
	};

    this.stats_update = function (data) {
        var data_obj = JSON.parse(data);

        var treeHtml = '<div id="tree"></div>';
        $('#tree-block').empty().html(treeHtml);

        var testSuitesHtml = '<div id="event_result"></div>';
        $('#event-block').empty().html(testSuitesHtml);

        var failed_test_suites_names = {};
        var tests_fails = [];
        var failed_test_suites = data_obj.failed_tests_suites;
        var failed_tests_names = data_obj.failed_tests_names;

        failed_tests_names.forEach(function (test_path, i) {
            console.log(test_path);
            var new_path = processDir(test_path);
            failed_test_suites_names[new_path] = failed_test_suites[i];
            tests_fails.push({'path': new_path, 'status': 0});
        });

        var tree_arr;
        var tree = new Tree();

        tree_arr = tests_fails;

        tree.addArr(tree_arr);
        var treeJSON = tree.asArray();

        var is_tree_new = true;

        $('#tree')
            // listen for event
            .on('select_node.jstree', function (e, data) {
                console.log(e);
                var i, j, node_suites_arr = {};

                for (i = 0, j = data.selected.length; i < j; i++) {
                    var node_id = data.instance.get_node(data.selected[i]).id;
                    node_suites_arr[node_id] = failed_test_suites_names[node_id];
                }

                var event_result_html = '';
                Object.keys(node_suites_arr).forEach(function (node) {
                    var value = node_suites_arr[node];

                    event_result_html += '<table class="table table-striped"><tbody>';
                    event_result_html += '<tr><th>Test name:</th><td>' + node + '</td></tr>';
                    event_result_html += '<tr><th>Failed Test Suites:</th><td>' + value.join('<br>') + '</td></tr>';
                    event_result_html += '</tr></tbody></table>';
                });
                event_result_html += '';

                $('#event_result').html(event_result_html);

                // Scroll to test-cases head
                jQuery.fn.exists = function () {
                    return ($(this).length > 0);
                };

                var test_suite_last = $("#event-block").find('table :last');

                if (!is_tree_new && test_suite_last.exists()) {
                    $('html, body').animate({
                        scrollTop: test_suite_last.offset().top
                    }, 100);
                }

                is_tree_new = false;
				self.repaintIframe();
            })
            .jstree({
            themes: {
                theme: 'default'
            },
            "types": {
                "#": {
                    // "max_children": 1,
                    // "max_depth": 4,
                    "valid_children": ["root"]
                },
                "root": {
                    "icon": "folder",
                    "valid_children": ["default"]
                },
                "default": {
                    "icon": "folder",
                    "valid_children": ["default", "file"]
                },
                "file": {
                    "icon": "file-php",
                    "valid_children": []
                },
                "file-error": {
                    "icon": "file-php-error",
                    "valid_children": []
                },
                "folder-error": {
                    "icon": "folder-error",
                    "valid_children": []
                }
            },
            'core': {
                'data': treeJSON
            },
            // "ui": {
            //     "select_limit": 1
            // },
            // тут мы перечисляем все плагины, которые используем
            plugins: ['themes', 'json_data', 'ui', 'types', 'state']
        });
    };

    socket.on('connect', function() {
        self.connect_status = true;
        console.log('[' + getDate() + '] Сервер доступен. Присоединяюсь...');
        self.renderAlert();
        $('#panel-users').removeClass('hidden');
    });

    socket.on('disconnect', function() {
        self.connect_status = false;
        console.log('[' + getDate() + '] Сервер недоступен');
        self.renderAlert();
        $('#panel-users').addClass('hidden');
    });

    socket.on('stats.init_result', this.stats_init);
    socket.on('web.start', this.start);
    socket.on('web.update', this.update);
    socket.on('web.complete', this.complete);
    socket.on('web.reset', this.reset);

    socket.on('web.users.update', this.users_update);

    socket.on('stats.update', this.stats_update);

    socket.emit('stats.init_request');

    this.addManualRunnerHandler();
};

App.main = new App.main();