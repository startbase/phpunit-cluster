var fs = require('fs');
var path = require('path');

var TestParser = function() {

    this.getTestsArray = function(base_dir, callback) {
        var regexp = new RegExp(/Test\.php$/);
        var result = [];
        var instance = this;
        fs.readdir(base_dir, function(err, list) {
            if(err) {
                return callback(err);
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
                        if(regexp.test(file)) {
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
};

module.exports = new TestParser();
