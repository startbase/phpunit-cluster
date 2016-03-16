var config = require('../config.js');
var config_params = config.getParams();

var DbManager = function() {

    this.migrateUp = function(callback) {
        var repository_path = config_params.repository.repository_path;

        var sh = 'cd ' + repository_path + ' && ' + config_params.db.cmd_update;

        var exec = require('child_process').exec;
        var child = exec(sh);
        child.stdout.on('data', function(data) {
            console.log(data);
        });
        child.stderr.on('data', function(data) {
            console.log(data);
        });
        child.on('close', function() {
            console.log('database updated');
            if (callback != undefined) {
                callback();
            }

        });

    };
};