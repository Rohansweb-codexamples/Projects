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
    },
    maxHttpBufferSize: 50 * 1024 * 1024,
    pingInterval: 25000,
    pingTimeout: 20000
});

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

app.use(express.static(PUBLIC_DIR));
app.use(express.json({ limit: "100mb" }));

app.get("/health", (req, res) => {
    res.json({
        ok: true,
        service: "Rohans Web TV Display",
        time: new Date().toISOString()
    });
});

app.get("/", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get("/viewer", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "viewer.html"));
});

let currentState = {
    image: null,
    audioLevel: 0,
    scale: 1,
    rotation: 0
};

let controllers = 0;
let viewers = 0;

io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("identify", (role) => {
        if (socket.role) return;

        if (role === "controller") {
            socket.role = "controller";
            controllers++;
            console.log("Controller connected:", socket.id);
        } else if (role === "viewer") {
            socket.role = "viewer";
            viewers++;
            console.log("TV viewer connected:", socket.id);

            socket.emit("initial-state", currentState);
        } else {
            return;
        }

        sendConnectionStatus();
    });

    socket.on("controller-image", (data) => {
        if (socket.role !== "controller") return;
        if (!data || typeof data.image !== "string") return;

        currentState.image = data.image;

        console.log(
            "Picture received:",
            Math.round(data.image.length / 1024),
            "KB"
        );

        io.emit("controller-image", {
            image: data.image
        });
    });

    socket.on("audio-level", (data) => {
        if (socket.role !== "controller") return;

        let level = Number(data && data.level);

        if (!Number.isFinite(level)) level = 0;

        level = Math.max(0, Math.min(255, level));
        currentState.audioLevel = level;

        socket.broadcast.emit("audio-level", { level });
    });

    socket.on("image-scale", (data) => {
        if (socket.role !== "controller") return;

        let scale = Number(data && data.scale);

        if (!Number.isFinite(scale)) return;

        scale = Math.max(0.2, Math.min(3, scale));
        currentState.scale = scale;

        socket.broadcast.emit("image-scale", { scale });
    });

    socket.on("image-rotation", (data) => {
        if (socket.role !== "controller") return;

        let rotation = Number(data && data.rotation);

        if (!Number.isFinite(rotation)) return;

        currentState.rotation = rotation;

        socket.broadcast.emit("image-rotation", { rotation });
    });

    socket.on("reset-display", () => {
        if (socket.role !== "controller") return;

        currentState = {
            image: null,
            audioLevel: 0,
            scale: 1,
            rotation: 0
        };

        io.emit("reset-display");
    });

    socket.on("display-ping", () => {
        socket.emit("display-pong", {
            time: Date.now()
        });
    });

    socket.on("disconnect", (reason) => {
        console.log("Socket disconnected:", socket.id, reason);

        if (socket.role === "controller") {
            controllers = Math.max(0, controllers - 1);
        }

        if (socket.role === "viewer") {
            viewers = Math.max(0, viewers - 1);
        }

        sendConnectionStatus();
    });
});

function sendConnectionStatus() {
    io.emit("connection-status", {
        controllers,
        viewers
    });
}

server.listen(PORT, "0.0.0.0", () => {
    console.log("=================================");
    console.log("Rohans Web TV Display Server");
    console.log("Server running on port:", PORT);
    console.log("=================================");
});

process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
});

process.on("unhandledRejection", (error) => {
    console.error("Unhandled rejection:", error);
});
