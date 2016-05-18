var fs = require('fs');
var path = require('path');

var TestParser = function(settings) {
    this.base_dirs = settings['base_dirs'];
    this.excluded_dirs = settings['excluded_dirs'];

    /**
     * Parse multiple dirs async and invoke result
     * @param callback
     */
    this.processParse = function (callback) {
        var instance = this;
        var res = [];
        var complete = 0;
        if(!Array.isArray(this.base_dirs)) {
            callback(null, []);
        }
         else {
            this.base_dirs.forEach(function (directory) {
                instance.getTestsArray(directory.toString(), function (error, result) {
                    res = res.concat(result);
                    complete++;
                    if (complete == instance.base_dirs.length) {
                        callback(error, res);
                    }
                });
            });
        }
    };

    /**
     * Look for tests in a single directory
     * @param base_dir
     * @param callback
     */
    this.getTestsArray = function(base_dir, callback) {
        var result = [];
        var instance = this;
        fs.stat(base_dir, function (err, stats) {
            if(err) {
                return callback(err, []);
            }
            if (stats.isFile()) {
                if(instance.isTest(base_dir) && !instance.isExcluded(base_dir)) {
                    return callback(null, [path.resolve('./', base_dir)]);
                }
                else {
                    return callback(null, []);
                }
            }
            else {
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
                                if(instance.isTest(file) && !instance.isExcluded(file)) {
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
            }
        });
    };

    /**
     * Check is file must be excluded from results
     * @param item
     * @returns {boolean}
     */
    this.isExcluded = function(item) {
        return this.excluded_dirs.findIndex(function(element) {
            return (new RegExp("^" + path.resolve('./', element))).test(item);
        }) != -1;
    };

    /**
     * Check is file test
     * @param item
     * @returns {boolean}
     */
    this.isTest = function(item) {
        return (new RegExp(/Test\.php$/)).test(item);
    };

    /**
     * Get results with relative paths
     * @param results
     * @param base_dir
     * @returns {Array}
     */
    this.getCleanResults = function(results, base_dir) {
        var clean_results = [];
        results.forEach(function(item) {
            clean_results.push(path.relative(base_dir, item));
        });
        return clean_results;
    };
};

module.exports = TestParser;
