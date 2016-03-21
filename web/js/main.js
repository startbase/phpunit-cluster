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

    this.start = function (data) {
        console.log('start', data);
        if (!data.count_tasks) {
            return;
        }
        var progressBarHtml = '<div class="progress" id="tests-progress">' +
            '<div class="progress-bar" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" style="width: 0;">' +
            '<span>0</span>' +
            '</div>' +
            '</div>' +
            '<div id="tests-result-info"></div>';
        $('#info-tests').empty().html(progressBarHtml);
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

    socket.on('web.start', this.start);
    socket.on('web.update', this.update);
    socket.on('web.complete', this.complete);

    this.repaintIframe();
    this.addManualRunnerHandler();
};

App.main = new App.main();