var socket = io('http://' + window.location.hostname + ':8099');
socket.on('stats.update', function (data) {
    $('#testResult').prepend(data + "<hr>");
});