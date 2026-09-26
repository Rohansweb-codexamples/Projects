io.on("connection", socket => {

    socket.on(
        "controller-image",
        data => {

            socket.broadcast.emit(
                "controller-image",
                data
            );

        }
    );

    socket.on(
        "audio-level",
        data => {

            socket.broadcast.emit(
                "audio-level",
                data
            );

        }
    );

});
