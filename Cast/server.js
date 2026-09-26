```js
const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

const PUBLIC_DIR = path.join(__dirname, "public");

if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, {
        recursive: true
    });
}

/* Serve index.html, viewer.html and other files */
app.use(express.static(PUBLIC_DIR));

app.use(express.json({
    limit: "100mb"
}));

/* Health check */
app.get("/health", (req, res) => {
    res.json({
        ok: true,
        service: "Rohans Web TV Display",
        time: new Date().toISOString()
    });
});

/* Home page */
app.get("/", (req, res) => {
    res.sendFile(
        path.join(
            PUBLIC_DIR,
            "index.html"
        )
    );
});

/* TV viewer */
app.get("/viewer", (req, res) => {
    res.sendFile(
        path.join(
            PUBLIC_DIR,
            "viewer.html"
        )
    );
});


/* =====================================================
   CURRENT DISPLAY STATE
===================================================== */

let currentState = {

    image: null,

    audioLevel: 0,

    scale: 1,

    rotation: 0,

    connected: true

};


/* =====================================================
   CONNECTIONS
===================================================== */

let controllers = 0;
let viewers = 0;


/* =====================================================
   SOCKET.IO
===================================================== */

io.on("connection", socket => {

    console.log(
        "Socket connected:",
        socket.id
    );


    /* -------------------------------------------------
       IDENTIFY DEVICE
    ------------------------------------------------- */

    socket.on(
        "identify",
        role => {

            socket.role = role;

            if (role === "controller") {

                controllers++;

                console.log(
                    "Controller connected:",
                    socket.id
                );

            }

            if (role === "viewer") {

                viewers++;

                console.log(
                    "TV viewer connected:",
                    socket.id
                );

                /*
                 Send current display state
                 immediately to newly connected TV.
                */

                socket.emit(
                    "initial-state",
                    currentState
                );

            }

            sendConnectionStatus();

        }
    );


    /* -------------------------------------------------
       IMAGE FROM TABLET
    ------------------------------------------------- */

    socket.on(
        "controller-image",
        data => {

            if (
                !data ||
                typeof data.image !== "string"
            ) {
                return;
            }

            currentState.image =
                data.image;

            console.log(
                "Picture received from controller"
            );

            /*
             Send picture to every TV
             except the controller.
            */

            socket.broadcast.emit(
                "controller-image",
                {
                    image:
                        data.image
                }
            );

        }
    );


    /* -------------------------------------------------
       AUDIO LEVEL FROM TABLET
    ------------------------------------------------- */

    socket.on(
        "audio-level",
        data => {

            if (!data) {
                return;
            }

            let level =
                Number(data.level);

            if (!Number.isFinite(level)) {
                level = 0;
            }

            level =
                Math.max(
                    0,
                    Math.min(
                        255,
                        level
                    )
                );

            currentState.audioLevel =
                level;

            socket.broadcast.emit(
                "audio-level",
                {
                    level
                }
            );

        }
    );


    /* -------------------------------------------------
       IMAGE SCALE
    ------------------------------------------------- */

    socket.on(
        "image-scale",
        data => {

            if (!data) {
                return;
            }

            let scale =
                Number(data.scale);

            if (!Number.isFinite(scale)) {
                return;
            }

            scale =
                Math.max(
                    0.2,
                    Math.min(
                        3,
                        scale
                    )
                );

            currentState.scale =
                scale;

            socket.broadcast.emit(
                "image-scale",
                {
                    scale
                }
            );

        }
    );


    /* -------------------------------------------------
       IMAGE ROTATION
    ------------------------------------------------- */

    socket.on(
        "image-rotation",
        data => {

            if (!data) {
                return;
            }

            let rotation =
                Number(data.rotation);

            if (!Number.isFinite(rotation)) {
                return;
            }

            currentState.rotation =
                rotation;

            socket.broadcast.emit(
                "image-rotation",
                {
                    rotation
                }
            );

        }
    );


    /* -------------------------------------------------
       RESET DISPLAY
    ------------------------------------------------- */

    socket.on(
        "reset-display",
        () => {

            currentState = {

                image: null,

                audioLevel: 0,

                scale: 1,

                rotation: 0,

                connected: true

            };

            io.emit(
                "reset-display"
            );

        }
    );


    /* -------------------------------------------------
       PING / KEEP ALIVE
    ------------------------------------------------- */

    socket.on(
        "display-ping",
        () => {

            socket.emit(
                "display-pong",
                {
                    time:
                        Date.now()
                }
            );

        }
    );


    /* -------------------------------------------------
       DISCONNECT
    ------------------------------------------------- */

    socket.on(
        "disconnect",
        reason => {

            console.log(
                "Socket disconnected:",
                socket.id,
                reason
            );

            if (
                socket.role ===
                "controller"
            ) {

                controllers =
                    Math.max(
                        0,
                        controllers - 1
                    );

            }

            if (
                socket.role ===
                "viewer"
            ) {

                viewers =
                    Math.max(
                        0,
                        viewers - 1
                    );

            }

            sendConnectionStatus();

        }
    );

});


/* =====================================================
   CONNECTION STATUS
===================================================== */

function sendConnectionStatus() {

    io.emit(
        "connection-status",
        {
            controllers,
            viewers
        }
    );

}


/* =====================================================
   START SERVER
===================================================== */

server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "================================="
        );

        console.log(
            "Rohans Web TV Display Server"
        );

        console.log(
            "Server running on port:",
            PORT
        );

        console.log(
            "================================="
        );

    }
);


/* =====================================================
   ERROR HANDLING
===================================================== */

process.on(
    "uncaughtException",
    error => {

        console.error(
            "Uncaught exception:",
            error
        );

    }
);

process.on(
    "unhandledRejection",
    error => {

        console.error(
            "Unhandled rejection:",
            error
        );

    }
);
```
