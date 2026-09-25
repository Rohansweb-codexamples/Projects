const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

const publicDir = path.join(__dirname, "public");
const uploadsDir = path.join(publicDir, "uploads");

if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}


/* -------------------------------------------------------
   FILE UPLOADS
------------------------------------------------------- */

const storage = multer.diskStorage({

    destination: function(req, file, cb) {
        cb(null, uploadsDir);
    },

    filename: function(req, file, cb) {

        const safeName = file.originalname
            .replace(/[^a-zA-Z0-9._-]/g, "_");

        const unique =
            Date.now() +
            "-" +
            Math.random()
                .toString(36)
                .substring(2, 8);

        cb(
            null,
            unique + "-" + safeName
        );
    }

});

const upload = multer({
    storage,

    limits: {
        fileSize: 500 * 1024 * 1024
    },

    fileFilter: function(req, file, cb) {

        const allowed =
            file.mimetype.startsWith("audio/") ||
            file.mimetype.startsWith("video/") ||
            file.mimetype.startsWith("image/");

        if (!allowed) {
            return cb(
                new Error(
                    "Only audio, video and image files are allowed."
                )
            );
        }

        cb(null, true);
    }
});


/* -------------------------------------------------------
   STATIC FILES
------------------------------------------------------- */

app.use(express.json({
    limit: "10mb"
}));

app.use(
    express.urlencoded({
        extended: true,
        limit: "10mb"
    })
);

app.use(
    express.static(publicDir)
);


/* -------------------------------------------------------
   HOME
------------------------------------------------------- */

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            publicDir,
            "index.html"
        )
    );

});


/* -------------------------------------------------------
   UPLOAD
------------------------------------------------------- */

app.post(
    "/upload",
    upload.single("file"),
    (req, res) => {

        if (!req.file) {

            return res.status(400).json({
                error: "No file uploaded."
            });

        }

        const mediaType =
            req.file.mimetype.startsWith("video/")
                ? "video"
                : req.file.mimetype.startsWith("audio/")
                    ? "audio"
                    : "image";

        const media = {

            id:
                Date.now().toString(36) +
                Math.random()
                    .toString(36)
                    .substring(2),

            name: req.file.originalname,

            filename: req.file.filename,

            type: mediaType,

            mime: req.file.mimetype,

            size: req.file.size,

            url:
                "/uploads/" +
                encodeURIComponent(
                    req.file.filename
                )

        };


        /*
         * Tell every connected viewer
         * that a new media file exists.
         */

        io.emit(
            "media-added",
            media
        );


        res.json({
            success: true,
            media
        });

    }
);


/* -------------------------------------------------------
   MEDIA LIST
------------------------------------------------------- */

app.get("/api/media", (req, res) => {

    fs.readdir(
        uploadsDir,
        (error, files) => {

            if (error) {

                return res.json([]);

            }

            const media =
                files.map(filename => {

                    const extension =
                        path.extname(
                            filename
                        ).toLowerCase();

                    let type = "unknown";

                    if (
                        [
                            ".mp4",
                            ".webm",
                            ".mov",
                            ".m4v",
                            ".ogv"
                        ].includes(extension)
                    ) {
                        type = "video";
                    }

                    if (
                        [
                            ".mp3",
                            ".wav",
                            ".ogg",
                            ".m4a",
                            ".aac",
                            ".flac"
                        ].includes(extension)
                    ) {
                        type = "audio";
                    }

                    if (
                        [
                            ".jpg",
                            ".jpeg",
                            ".png",
                            ".gif",
                            ".webp"
                        ].includes(extension)
                    ) {
                        type = "image";
                    }

                    return {

                        name: filename,

                        filename,

                        type,

                        url:
                            "/uploads/" +
                            encodeURIComponent(
                                filename
                            )

                    };

                })
                .filter(
                    item =>
                        item.type !== "unknown"
                );

            res.json(media);

        }
    );

});


/* -------------------------------------------------------
   DELETE MEDIA
------------------------------------------------------- */

app.delete(
    "/api/media/:filename",
    (req, res) => {

        const filename =
            path.basename(
                req.params.filename
            );

        const filePath =
            path.join(
                uploadsDir,
                filename
            );

        if (!fs.existsSync(filePath)) {

            return res.status(404).json({
                error: "File not found."
            });

        }

        fs.unlink(
            filePath,
            error => {

                if (error) {

                    return res.status(500)
                        .json({
                            error:
                                "Could not delete file."
                        });

                }

                io.emit(
                    "media-removed",
                    {
                        filename
                    }
                );

                res.json({
                    success: true
                });

            }
        );

    }
);


/* -------------------------------------------------------
   SOCKET.IO
------------------------------------------------------- */

let controllerCount = 0;
let viewerCount = 0;

let currentState = {

    type: "idle",

    media: null,

    playing: false,

    currentTime: 0,

    volume: 1,

    muted: false,

    loop: false,

    visualiser: {

        style: "bars",

        primary: "#ff7a00",

        secondary: "#ffd43b",

        background: "#050505",

        sensitivity: 1

    }

};


io.on(
    "connection",
    socket => {

        console.log(
            "Connected:",
            socket.id
        );


        /* ------------------------------------------------
           CLIENT IDENTIFICATION
        ------------------------------------------------ */

        socket.on(
            "identify",
            role => {

                if (role === "controller") {

                    controllerCount++;

                    socket.role =
                        "controller";

                }

                if (role === "viewer") {

                    viewerCount++;

                    socket.role =
                        "viewer";

                    /*
                     * Immediately give a new TV
                     * the current screen state.
                     */

                    socket.emit(
                        "state",
                        currentState
                    );

                }

                broadcastStatus();

            }
        );


        /* ------------------------------------------------
           CONTROLLER COMMANDS
        ------------------------------------------------ */

        socket.on(
            "control",
            command => {

                if (!command)
                    return;


                /*
                 * Update server-side state.
                 */

                if (
                    command.action ===
                    "play"
                ) {

                    currentState.playing =
                        true;

                }

                if (
                    command.action ===
                    "pause"
                ) {

                    currentState.playing =
                        false;

                }

                if (
                    command.action ===
                    "stop"
                ) {

                    currentState.playing =
                        false;

                    currentState.currentTime =
                        0;

                }

                if (
                    command.action ===
                    "seek"
                ) {

                    if (
                        typeof command.time ===
                        "number"
                    ) {

                        currentState.currentTime =
                            command.time;

                    }

                }

                if (
                    command.action ===
                    "volume"
                ) {

                    currentState.volume =
                        Number(
                            command.volume
                        );

                }

                if (
                    command.action ===
                    "mute"
                ) {

                    currentState.muted =
                        Boolean(
                            command.muted
                        );

                }

                if (
                    command.action ===
                    "loop"
                ) {

                    currentState.loop =
                        Boolean(
                            command.loop
                        );

                }

                if (
                    command.action ===
                    "load"
                ) {

                    currentState.media =
                        command.media;

                    currentState.type =
                        command.media?.type ||
                        "idle";

                    currentState.currentTime =
                        0;

                }

                if (
                    command.action ===
                    "visualiser"
                ) {

                    currentState.visualiser = {

                        ...currentState.visualiser,

                        ...command.settings

                    };

                }


                /*
                 * Send the command to ALL clients.
                 *
                 * This means:
                 *
                 * phone
                 * tablet
                 * computer
                 * TV
                 *
                 * can stay synchronised.
                 */

                io.emit(
                    "control",
                    command
                );


                /*
                 * Save the latest complete state.
                 */

                io.emit(
                    "state",
                    currentState
                );

            }
        );


        /* ------------------------------------------------
           LIVE VISUALISER DATA
        ------------------------------------------------ */

        socket.on(
            "visualiser-data",
            data => {

                /*
                 * This is intentionally lightweight.
                 *
                 * The controller can send the current
                 * waveform/spectrum values.
                 */

                io.emit(
                    "visualiser-data",
                    data
                );

            }
        );


        /* ------------------------------------------------
           CHAT / STATUS MESSAGE
        ------------------------------------------------ */

        socket.on(
            "screen-message",
            message => {

                io.emit(
                    "screen-message",
                    {
                        message:
                            String(
                                message
                            ).slice(
                                0,
                                1000
                            )
                    }
                );

            }
        );


        /* ------------------------------------------------
           DISCONNECT
        ------------------------------------------------ */

        socket.on(
            "disconnect",
            () => {

                if (
                    socket.role ===
                    "controller"
                ) {

                    controllerCount =
                        Math.max(
                            0,
                            controllerCount - 1
                        );

                }

                if (
                    socket.role ===
                    "viewer"
                ) {

                    viewerCount =
                        Math.max(
                            0,
                            viewerCount - 1
                        );

                }

                broadcastStatus();

                console.log(
                    "Disconnected:",
                    socket.id
                );

            }
        );

    }
);


/* -------------------------------------------------------
   STATUS
------------------------------------------------------- */

function broadcastStatus(){

    io.emit(
        "connection-status",
        {

            controllers:
                controllerCount,

            viewers:
                viewerCount

        }
    );

}


/* -------------------------------------------------------
   ERROR HANDLER
------------------------------------------------------- */

app.use(
    (error, req, res, next) => {

        console.error(error);

        res.status(500).json({

            error:
                error.message ||
                "Server error."

        });

    }
);


/* -------------------------------------------------------
   START
------------------------------------------------------- */

server.listen(
    PORT,
    () => {

        console.log("");
        console.log(
            "================================="
        );
        console.log(
            " Rohans Web Display Server"
        );
        console.log(
            "================================="
        );
        console.log(
            `Server: http://localhost:${PORT}`
        );
        console.log(
            `Viewer: http://localhost:${PORT}/viewer.html`
        );
        console.log(
            `Controller: http://localhost:${PORT}/index.html`
        );
        console.log(
            "================================="
        );
        console.log("");

    }
);
