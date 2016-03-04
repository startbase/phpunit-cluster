var io = io('http://' + window.location.hostname + ':8101');

io.on('connection', function (socket) {
    socket.on('message', function (data) {
        console.log(data);
    })
});