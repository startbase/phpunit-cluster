var forker = require('./libs/forker.js');
var spawn = require('child_process').spawn;
var git = require('simple-git')();

var CRunner = function() {

    this.updateClient = function(callback) {
        git.fetch('origin').pull(function() {
            console.log('Repository has been updated');
            spawn('npm', ['install']).on('close', function() {
                console.log('npm install completed');
                callback();
            });
        });
    };

    this.getArgv = function() {
        var argv = process.argv;
        argv.splice(1, 1);
        return argv;
    };

    this.run = function() {
        var self = this;
        var f = new forker(this.getArgv(), function(callback) {
            self.updateClient(callback);
        });
        f.restartApp();
    };
};

(new CRunner()).run();