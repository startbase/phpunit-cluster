var taskBalancer = new (require('../task-balancer'));
var assert = require('assert');

describe('task-balancer.js', function() {

    beforeEach(function (done) {
        var data = ['/dir1/test1Test.php',
            '/dir1/test2Test.php',
            '/dir2/test2Test.php',
            '/dir2/test1Test.php',
            'test2Test.php',
            'test1Test.php'];

        taskBalancer.generateQueue(data);
        taskBalancer.repeat_attempts_number = 1;
        taskBalancer.clients_number = 2;

        done();
    });

    afterEach(function(done) {
        taskBalancer.clearTaskQueue();
        done();
    });

    describe('test getTask', function() {
        it('one failed task, two clients', function () {
            var client = 'bounty_hunter';
            var client2 = 'hangman';
            taskBalancer.registerFailed(client, {taskName: '/dir1/test1Test.php'});

            assert.equal(taskBalancer.tasksCount(), 6);
            assert.notDeepEqual(taskBalancer.getTask(client), {taskName: 'test2Test.php'});
            assert.equal(taskBalancer.tasksCount(), 5);

            assert.notDeepEqual(taskBalancer.getTask(client2), {taskName: 'test1Test.php'});
            assert.equal(taskBalancer.tasksCount(), 4);
        });

        it('all tasks failed for a client', function () {
            var client = 'prisoner';
            var client2 = 'sheriff';
            taskBalancer.queueTasks.tasks.forEach(function(item) {
                taskBalancer.registerFailed(client, item);
            });

            assert.equal(taskBalancer.tasksCount(), 6);
            assert.equal(taskBalancer.getTask(client), false);

            assert.notDeepEqual(taskBalancer.getTask(client2), {taskName: 'test1Test.php'});
            assert.equal(taskBalancer.tasksCount(), 5);
        });

        it('all tasks failed for all clients', function () {
            var client = 'mexican';
            var client2 = 'little Man';
            taskBalancer.queueTasks.tasks.forEach(function(item) {
                taskBalancer.registerFailed(client, item);
                taskBalancer.registerFailed(client2, item);
            });

            assert.equal(taskBalancer.tasksCount(), 6);
            assert.equal(taskBalancer.getTask(client), false);
            assert.equal(taskBalancer.getTask(client2), false);
        });

        it('maximum attempts', function () {
            var client = 'cow_puncher';
            var client2 = 'confederate';
            taskBalancer.queueTasks.tasks.forEach(function(item) {
                taskBalancer.registerFailed(client, item);
                taskBalancer.registerFailed(client2, item);
            });

            assert.equal(taskBalancer.tasksCount(), 6);
            assert.equal(taskBalancer.getTask(client), false);
            assert.equal(taskBalancer.getTask(client2), false);
        });
    });

    describe('test canReturnTask', function() {
        it('return task test', function () {
            var task = {taskName: '/dir1/test1Test.php'};
            assert.equal(taskBalancer.canReturnTask(task), true);

            taskBalancer.registerFailed('o_b_jackson', task);
            assert.equal(taskBalancer.canReturnTask(task), true);

            taskBalancer.registerFailed('sweet_dave', task);
            assert.equal(taskBalancer.canReturnTask(task), false);
        });
    });

});

