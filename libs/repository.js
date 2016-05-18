var Repository = function (settings) {

	this.git = require('simple-git')(settings['repository_path']);

    /**
     * @param callback
     */
    this.update = function (callback) {
		var self = this;
        var branch = 'origin/' + settings['local_branch'];

        self.git.fetch('origin')
            ._run(['reset', '--hard', branch], function() {
                self.git._run(['rebase', branch], function(err) {
                    if(!err) {
                        callback();
                    }
                });
            });
    };

    this.checkout = function (commit_hash, callback) {
        this.git.fetch('origin')._run(['reset', '--hard', commit_hash], function(err) {
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
		this.git.log(['-n', '1', '--pretty=format:%H'], function(err, data) {
            if(!err) {
                callback(data.latest.hash);
            }
        });
    };

    this.getMergeCommitHistory = function(lastCommit, currentCommit, callback) {
		this.git.log({ from: lastCommit, to: currentCommit }, function (err, data) {
			if (!err) {
				var commits = data.all;
				var merge_commits = [];
				var merge = /(.*?)Merge branch(.*?)into integration/i;

				commits.forEach(function (commit) {
					if (commit.author_name !== undefined && commit.message !== undefined && merge.test(commit.message)) {
                        merge_commits.push(commit);
					}
				});

				callback(merge_commits);
			}
		});
    };
};

module.exports = Repository;
