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
                git._run(['rebase', branch], function(err) {
                    if(!err) {
                        callback();
                    }
                });
            });
    };

    this.checkout = function (commit_hash, callback) {
        git.fetch('origin')._run(['reset', '--hard', commit_hash], function(err) {
            if(!err) {
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
            if(!err) {
                callback(data.latest.hash);
            }
        });
    };

    this.getCommitHistory = function(lastCommit, currentCommit, callback) {
		git.log({ from: lastCommit, to: currentCommit, options: options }, function (err, data) {
			if (!err) {
				var commits = data.all;
				var logs = [];
				var merge = /(.*?)Merge branch(.*?)into integration/i;

				commits.forEach(function (commit) {
					if (commit.author_name !== undefined && commit.message !== undefined && merge.test(commit.message)) {
						logs.push('[' + commit.author_name + '] ' + commit.message);
					}
				});

				callback(logs);
			}
		});
    };
};

module.exports = new Repository();