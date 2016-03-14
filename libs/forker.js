var child_process = require('child_process'),
    spawn = child_process.spawn;

/**
 * @param command
 * @constructor
 */
var Forker = function(command) {
    var child;
    this.app_params_array = command instanceof Array ? command : command.split(' ');
    this.app_command = this.app_params_array.splice(0, 1)[0];

    this.restartApp = function()
    {
        var self = this;
        //@todo сделать обновление по нормальному
        spawn('git', ['pull']).on('close', function() {
            console.log('Repository has been updated');
            spawn('npm', ['install']).on('close', function() {
                console.log('npm install completed');
                if (child) {
                    child.kill();
                }
                self.startApp();
            });
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
};

module.exports = Forker;