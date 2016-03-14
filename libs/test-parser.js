var fs = require('fs');
var path = require('path');

var TestParser = function() {
    this.base_dirs = [];

    this.processParse = function (callback) {
        var instance = this;
        var res = [];
        var complete = 0;
        this.base_dirs.forEach(function (directory) {
            fs.stat(directory, function (err, stats) {
                if (stats.isFile()) {
                    res = res.concat(directory);
                }
                instance.getTestsArray(directory, function (error, result) {
                    res = res.concat(result);
                    complete++;
                    if (complete == instance.base_dirs.length) {
                        callback(error, res);
                    }
                });
            });
        });
    };

    this.getTestsArray = function(base_dir, callback) {
        var result = [];
        var instance = this;
        fs.readdir(base_dir, function(err, list) {
            if(err) {
                return callback(err, []);
            }
            var length = list.length;
            if (!length) {
                return callback(null, result);
            }
            list.forEach(function(file) {
                file = path.resolve(base_dir, file);
                fs.stat(file, function(err, stat) {
                    if (stat && stat.isDirectory()) {
                        instance.getTestsArray(file, function(err, res) {
                            result = result.concat(res);
                            --length;
                            if (!length) {
                                callback(null, result);
                            }
                        });
                    }
                    else {
                        if(instance.isTest(file)) {
                            result.push(file);
                        }
                        --length;
                        if (!length) {
                            callback(null, result);
                        }
                    }
                })
            });
        });
    };

    this.isTest = function(item) {
        return (new RegExp(/Test\.php$/)).test(item);
    };

    this.getCleanResults = function(results, base_dir) {
        var clean_results = [];
        results.forEach(function(item) {
            clean_results.push(path.relative(base_dir, item));
        });
        return clean_results;
    };
};

module.exports = new TestParser();
