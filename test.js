
var tests_all = [];

socket.on('newTestsLoaded', function () {
    tests_all = [];
    console.log('Статистика очищена');
    socket.emit('statsErased');
});

socket.on('allComplete', function (tests) {
    tests_all = tests;

    socket.username = username;
    users.push(username);

    console.log('Статистика подгружена');
    socket.emit('statsLoaded');
});

socket.on('getStats', function() {
    var time_overall = 0;
    //var tests_count = tests_all.length();
    var tests_failed = [];
    var tests_completed = [];

    for (var test in tests_completed) {
        time_overall += test.time;

        if (test.status=='fail') {
            tests_failed.append(test);
        }
        else {
            tests_completed.append(test);
        }
    }

    var stat_msg = "\nПройдено " + tests_completed.length() + " тестов из " + tests_all.length() + "\n";

    if (tests_failed.length() > 0) {
        stat_msg += "Завалены тесты: \n";

        for (test in tests_failed) {
            stat_msg += "\t\t" + test.file + "\n";
        }
    }

});