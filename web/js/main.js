var App = App || {};
var socket = io('http://' + window.location.hostname + ':8099');

App.main = function () {
    var self = this;
    var stats_fails_only = true;

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

    this.start = function () {
        var progressBarHtml = '<div class="progress" id="tests-progress">' +
            '<div class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" style="width: 0;">' +
            '<span>0</span>' +
            '</div>' +
            '</div>' +
            '<div id="tests-result-info"></div>';
        $('#info-tests').empty().html(progressBarHtml);
        
        var treeHtml = '<div id="tree"></div>';
        $('#tree-block').empty().html(treeHtml);
        
        var testSuitesHtml = '<div id="event_result"></div>';
        $('#event-block').empty().html(testSuitesHtml);
    };

    this.update = function (data) {
        console.log('update', data);

        if (!data.count_tasks) {
            return;
        }

        var tp = $('#tests-progress');
        if (!tp.size()) {
            self.start(data);
        }
        var pb = tp.find('.progress-bar');
        pb.attr('aria-valuemax', data.count_tasks);
        var percent = Math.ceil((100 / parseInt(pb.attr('aria-valuemax'))) * data.tests_overall_count);
        pb.css('width', percent + '%');
        pb.find('span').text(percent + '% Complete');
    };

    this.complete = function (data) {
		var commits_history = '';
		data.stats.commit_history.forEach(function(commit) {
			commits_history += '<p>' + commit + '</p>';
		});

        var resultHtml = '<table class="table table-striped">' +
			'<tr><td class="col-xs-3">Ветка: </td><td class="col-xs-9"> integration </td></tr>' +
			'<tr><td>Commit Hash: </td><td>' + data.commit_hash + '<br /><br />' + commits_history + '</td></tr>' +
            '<tr><td>Всего пройдено тестов: </td><td>' + data.stats.tests_overall_count + '</td></tr>' +
            '<tr><td>Успешно пройдено тестов: </td><td>' + data.stats.tests_success_count + '</td></tr>' +
            '<tr><td>Завалено тестов: </td><td>' + data.stats.tests_failed_count + '</td></tr>' +
            '<tr><td>Время выполнения последнего пула тестов: </td><td>' + data.stats.time_pool + '</td></tr>' +
            '<tr><td>Общее время выполнения тестов в PHPUnit: </td><td>' + (data.stats.time_overall).toFixed(4) + ' сек.</td></tr>' +
            '</table>';

        // progress-bar-success
        var pb = $('#tests-progress').find('.progress-bar');
        if (data.tests_failed_count) {
            pb.addClass('progress-bar-danger');
        } else {
            pb.addClass('progress-bar-success');
        }

        $('#tests-result-info').html(resultHtml);

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
	};

    this.stats_update = function (data) {
        var tests_all = data.all_tests_data;
        
        var failed_test_suites_names = data.failed_test_suites_names;

        var tests_fails = [];
        tests_all.forEach(function (test) {
            if (!test.status) {
                tests_fails.push(test);
            }
        });

        var tree_arr;
        var tree = new Tree();

        if (stats_fails_only) {
            tree_arr = tests_fails;
        }
        else {
            tree_arr = tests_all;
        }

        tree.addArr(tree_arr);
        var treeJSON = tree.asArray();

        $('#tree')
            // listen for event
            .on('changed.jstree', function (e, data) {
                var i, j, r = {};

                for (i = 0, j = data.selected.length; i < j; i++) {
                    var node_id = data.instance.get_node(data.selected[i]).id;
                    var test_suites_arr = failed_test_suites_names[node_id];
                    r[node_id] = failed_test_suites_names[node_id];
                }

                var event_result_html = '';
                Object.keys(r).forEach(function (key) {
                    var value = r[key];

                    event_result_html += '<table class="table table-striped"><tbody>';
                    event_result_html += '<tr><th>Test name:</th><td>' + key + '</td></tr>';
                    event_result_html += '<tr><th>Failed Test Suites:</th><td>' + value.join('<br>') + '</td></tr>';
                    event_result_html += '</tr></tbody></table>';
                });
                event_result_html += '';



                $('#event_result').html(event_result_html);
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

    socket.on('web.start', this.start);
    socket.on('web.update', this.update);
    socket.on('web.complete', this.complete);
    socket.on('web.reset', this.reset);

    socket.on('web.users.update', this.users_update);

    socket.on('stats.update', this.stats_update);

    this.repaintIframe();
    this.addManualRunnerHandler();
};

App.main = new App.main();