var server = require('http').createServer();
var config = require('../config').getParams();
var fs = require('fs');
var path = require('path');
const __DIR__ = path.dirname(process.mainModule.filename);

server.on('request', function (request, response) {
    var filepath = __DIR__ + '/index2.html';

    if (fs.existsSync(__DIR__ + request.url) && !fs.lstatSync(__DIR__ + request.url).isDirectory()) {
        filepath = __DIR__ + request.url;
    }

    fs.readFile(filepath, 'utf8', function (err, data) {
        if (err) {
            response.statusCode = 500;
            response.write("Error");
            response.end();
            return;
        }
        response.write(data);
        response.end();
    });
});

server.listen(config.web.port);