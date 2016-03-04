var server = require('http').createServer();
var config = require('../config').getParams();
var fs = require('fs');
var path = require('path');
const __DIR__ = path.dirname(process.mainModule.filename);

server.on('request', function (request, response) {
    var content = __DIR__ + '/index.html';

    if (fs.existsSync(__DIR__ + request.url) && !fs.lstatSync(__DIR__ + request.url).isDirectory()) {
        content = __DIR__ + request.url;
    }

    fs.readFile(content, function (err, data) {
        if (err) {
            console.log(fs.existsSync(content), content, err);
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