var spawn = require('child_process').spawn;

/**
 * @param command
 * @param {function} before_start_callback
 * @constructor
 */
var Forker = function(command, before_start_callback) {
    var child;
    this.app_params_array = command instanceof Array ? command : command.split(' ');
    this.app_command = this.app_params_array.splice(0, 1)[0];
    this.before_start = before_start_callback || this.defaultBeforeStart;

    this.restartApp = function()
    {
        var self = this;
        self.before_start(function() {
            if (child) {
                child.kill();
            }
            self.startApp();
        });
    };

    this.startApp = function()
    {
        var self = this;
        child = spawn(self.app_command, self.app_params_array, { stdio: 'inherit' });
        console.log('Application pid: ' + child.pid);
        child.on('close', function() {
            self.restartApp();
        });
    };

    this.defaultBeforeStart = function() {};
};

module.exports = Forker;
