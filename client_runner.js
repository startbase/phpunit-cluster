var forker = require('./libs/forker.js');
var argv = process.argv;
argv.splice(1, 1);
var f = new forker(argv);
f.restartApp();