var async = require('async');

var MigrationManager = function(settings) {
    this.executeMigrationCommand = function(cmd, callback) {
        var repository_path = settings['repository_path'];
        var sh = 'cd ' + repository_path + ' && ' + cmd;
        var exec = require('child_process').exec;
        var child = exec(sh);
        child.stdout.on('data', function(data) {
            console.log(data);
        });
        child.stderr.on('data', function(data) {
            console.log(data);
        });
        child.on('close', function() {
            if (callback != undefined) {
                callback();
            }
        });
    };

    this.migrateUpDb = function(callback) {
        this.executeMigrationCommand(settings['migration']['cmd_update']['db'], function() {
            console.log('Database migrations completed');
            callback();
        });
    };

    this.migrateUpFs = function(callback) {
        this.executeMigrationCommand(settings['migration']['cmd_update']['fs'], function() {
            console.log('File migrations completed');
            callback();
        });
    };

    this.migrateUp = function(onUpdate) {
        var self = this;
        async.parallel([
                function(callback) {
                    self.migrateUpDb(callback);
                },
                function(callback) {
                    self.migrateUpFs(callback);
                }
            ],
            function(err) {
                if(err) {
                    console.log(err);
                }
                onUpdate();
            }
        );
    };
};

module.exports = MigrationManager;
