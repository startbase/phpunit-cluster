var App = App || {};
var socket = io('http://' + window.location.hostname + ':8099');

App.main = function () {
    var self = this;

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
        var resultHtml = '<table class="table table-striped">' +
            '<tr><td>Всего пройдено тестов:</td><td>' + data.tests_overall_count + '</td></tr>' +
            '<tr><td>Успешно пройдено тестов: </td><td>' + data.tests_success_count + '</td></tr>' +
            '<tr><td>Завалено тестов: </td><td>' + data.tests_failed_count + '</td></tr>' +
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

	this.users_update = function (users) {
		var users_block = $('.users');
		// Количество
		users_block.find('span.users-count').html(users.length);
		// Список пользователей
		var users_list = '';
		users.forEach(function (user) {
			users_list += user[0] + ', ';
		});
		users_block.find('#users-list').html(users_list.substring(0, users_list.length-2));
	};

    socket.on('web.start', this.start);
    socket.on('web.update', this.update);
    socket.on('web.complete', this.complete);
    socket.on('web.reset', this.reset);

    socket.on('web.users.update', this.users_update);

    socket.on('stats.update', function (data) {
            var tests_all = data.all_tests_data;

            var tree = new Tree();
            tree.addArr(tests_all);
            var treeJSON = tree.asArray();

            $('#tree').jstree({
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
                // тут мы перечисляем все плагины, которые используем
                plugins: ['themes', 'json_data', 'ui', 'types', 'state']
            });
        });

    this.repaintIframe();
    this.addManualRunnerHandler();
};

App.main = new App.main();