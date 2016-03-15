var socket = io('http://' + window.location.hostname + ':8099');

var mustache = require('mustache');

var path_to_mustache_template = 'template.mst';


socket.on('stats.update', function (data) {
    $.get(path_to_mustache_template, function(template) {
        var rendered = mustache.to_html(template, data);
        console.log(rendered);
        $('.table.table-striped tbody').prepend(rendered);
    });
});