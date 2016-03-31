var forker = require('./libs/forker.js');
var spawn = require('child_process').spawn;
var git = require('simple-git')();

var ClientForker = function(sh) {
    this.client_script = sh || 'client.js';

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
        argv[1] = this.client_script;
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

(new ClientForker()).run();