var config = require('./config.js');

var config_params = config.getParams();
var Repository = function () {
    this.local_branch = config_params.repository.local_branch;
    this.repository_path = config_params.repository.repository_path;
    this.update = function (callback) {

        var local_branch = this.local_branch;
        var repository_path = this.repository_path;

        var sh = 'cd '+repository_path+' '
            + ' && git reset --hard origin/'+local_branch+ ' '
            + ' && git fetch origin '
            + ' && git rebase origin/'+local_branch+' ';

        var exec = require('child_process').exec;
        var child = exec(sh);
        child.stdout.on('data', function(data) {
            console.log(data);
        });
        child.stderr.on('data', function(data) {
            console.log(data);
        });
        child.on('close', function(code) {
            console.log('repository updated!');

            if (callback != undefined) {
                callback();
            }

        });
    };
};

module.exports = new Repository();