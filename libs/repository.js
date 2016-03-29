var config = require('../config.js');
var config_params = config.getParams();

var git = require('simple-git')(config_params.repository.repository_path);
git.outputHandler(function (command, stdout, stderr) {
    stdout.pipe(process.stdout);
    stderr.pipe(process.stderr);
});

var Repository = function () {

    /**
     * @param callback
     */
    this.update = function (callback) {
        var branch = 'origin/' + config_params.repository.local_branch;
        git.fetch('origin')
            ._run(['reset', '--hard', branch], function() {
				console.log('DEBUG: repository.js : update() > fetch run [reset] callback');
                git._run(['rebase', branch], function(err) {
					console.log('DEBUG: repository.js : update() > fetch run [reset] callback > run [rebase] callback');
                    if(!err) {
						console.log('DEBUG: repository.js : update() > fetch run [reset] callback > run [rebase] > no errors');
                        callback();
                    }
                });
            });
    };

    this.checkout = function (commit_hash, callback) {
        git.fetch('origin')._run(['reset', '--hard', commit_hash], function(err) {
			console.log('DEBUG: repository.js : checkout() > fetch run [reset] callback');
            if(!err) {
				console.log('DEBUG: repository.js : checkout() > fetch run [reset] callback > no errors');
                callback();
            }
        });
    };

    /**
     * Получаем последний commit hash
     * @param callback
     */
    this.getLastCommitHash = function(callback) {
        git.log(['-n', '1', '--pretty=format:%H'], function(err, data) {
			console.log('DEBUG: repository.js : getLastCommitHash() > log callback');
            if(!err) {
				console.log('DEBUG: repository.js : getLastCommitHash() > log callback > no errors');
                callback(data.latest.hash);
            }
        });
    };

    this.getCommitHistory = function(lastCommit, currentCommit, callback) {
		git.log({ from: lastCommit, to: currentCommit }, function (err, data) {
			if (!err) {
				var commits = data.all;
				var logs = [];
				commits.forEach(function (commit) {
					logs.push('[' + commit.author_name + '] ' + commit.message);
				});

				callback(logs);
			}
		});
    };
};

module.exports = new Repository();