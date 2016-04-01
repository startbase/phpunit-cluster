var testParser = require('../../libs/test-parser');
var assert = require('assert');

describe('test-parser.js', function() {

    describe("test processParse function", function() {
        var test_iteration = 0;
        function testProcessParse(dirs, excluded_dirs, expect) {
            var actual = false;
            before(function (done) {
                testParser.base_dirs = dirs;
                testParser.excluded_dirs = excluded_dirs;
                testParser.processParse(function (err, res) {
                    actual = res;
                    done();
                });
            });
            it('case num: ' + test_iteration++, function () {
                assert.deepEqual(actual.sort(), expect.sort());
            });
        }

        function processParseProvider() {
            return [
                [
                    ['./test/libs/file_fixtures/dir1/test1Test.php', false, './test/libs/file_fixtures/dir2'],
                    [],
                    [
                        '/var/phpunit-cluster/test/libs/file_fixtures/dir1/test1Test.php',
                        '/var/phpunit-cluster/test/libs/file_fixtures/dir2/test1Test.php',
                        '/var/phpunit-cluster/test/libs/file_fixtures/dir2/test2Test.php'
                    ]
                ],
                [
                    ['./test/libs/file_fixtures/dir1/class.php'], [], []
                ],
                [
                    ['./test/libs/file_fixtures/../'], [],
                    [
                        '/var/phpunit-cluster/test/libs/file_fixtures/dir1/test1Test.php',
                        '/var/phpunit-cluster/test/libs/file_fixtures/dir1/test2Test.php',
                        '/var/phpunit-cluster/test/libs/file_fixtures/dir2/test2Test.php',
                        '/var/phpunit-cluster/test/libs/file_fixtures/dir2/test1Test.php',
                        '/var/phpunit-cluster/test/libs/file_fixtures/test2Test.php',
                        '/var/phpunit-cluster/test/libs/file_fixtures/test1Test.php'
                    ]
                ],
                [
                    ['./test/libs/file_fixtures/../'],
                    ['./test/libs/file_fixtures/dir2/', '/var/phpunit-cluster/test/libs/file_fixtures/test1Test.php'],
                    [
                        '/var/phpunit-cluster/test/libs/file_fixtures/dir1/test1Test.php',
                        '/var/phpunit-cluster/test/libs/file_fixtures/dir1/test2Test.php',
                        '/var/phpunit-cluster/test/libs/file_fixtures/test2Test.php'
                    ]
                ],
                [
                    'lol', [], []
                ]
            ];
        }

        processParseProvider().forEach(function (item) {
            testProcessParse(item[0], item[1], item[2]);
        });
    });

    describe("test getCleanResults function", function() {
        var result = testParser.getCleanResults([
            '/var/phpunit-cluster/test/libs/file_fixtures/dir1/test1Test.php',
            '/var/phpunit-cluster/test/libs/file_fixtures/test2Test.php'
        ], './test');
        it('tests relative paths', function () {
            assert.deepEqual([
                'libs/file_fixtures/dir1/test1Test.php',
                'libs/file_fixtures/test2Test.php'
            ], result);
        });
    });

});

