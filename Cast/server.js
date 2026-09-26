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
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");

if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

console.log("Cast root:", ROOT_DIR);
console.log("Public folder:", PUBLIC_DIR);
console.log("Public exists:", fs.existsSync(PUBLIC_DIR));
console.log("Files:", fs.existsSync(PUBLIC_DIR) ? fs.readdirSync(PUBLIC_DIR) : []);

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

// Serve every file inside Cast/public
app.use(express.static(PUBLIC_DIR, {
    extensions: ["html"],
    index: "index.html"
}));

// Explicit pages
app.get("/", (req, res) => {
    const file = path.join(PUBLIC_DIR, "index.html");

    if (!fs.existsSync(file)) {
        return res.status(404).send(
            "<h1>Rohans Web TV Display</h1><p>index.html was not found in Cast/public.</p>"
        );
    }

    res.sendFile(file);
});

app.get("/index.html", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get("/viewer", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "viewer.html"));
});

app.get("/viewer.html", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "viewer.html"));
});

// Editor route: supports editor.html if present
app.get("/editor", (req, res) => {
    const file = path.join(PUBLIC_DIR, "editor.html");

    if (!fs.existsSync(file)) {
        return res.status(404).send(
            "<h1>Editor not found</h1><p>Create Cast/public/editor.html to use the editor.</p>"
        );
    }

    res.sendFile(file);
});

app.get("/editor.html", (req, res) => {
    const file = path.join(PUBLIC_DIR, "editor.html");

    if (!fs.existsSync(file)) {
        return res.status(404).send(
            "<h1>Editor not found</h1><p>Create Cast/public/editor.html to use the editor.</p>"
        );
    }

    res.sendFile(file);
});

app.get("/health", (req, res) => {
    res.json({
        ok: true,
        service: "Rohans Web TV Display",
        time: new Date().toISOString(),
        files: {
            index: fs.existsSync(path.join(PUBLIC_DIR, "index.html")),
            viewer: fs.existsSync(path.join(PUBLIC_DIR, "viewer.html")),
            editor: fs.existsSync(path.join(PUBLIC_DIR, "editor.html"))
        }
    });
});

let currentState = {
    image: null,
    audioLevel: 0,
    scale: 1,
    rotation: 0,
    mode: 0,
    auto: true,
    speed: 1,
    intensity: 1,
    brightness: 1,
    color: "#ff9800",
    effect: "none",
    audioReactive: true,
    lights: true,
    message: "",
    messageVisible: false,
    announcement: "",
    announcementVisible: false,
    screensaver: false
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

    socket.on("display-settings", (data) => {
        if (socket.role !== "controller" || !data || typeof data !== "object") return;
        const allowed = ["mode","auto","speed","intensity","brightness","color","effect","audioReactive","lights","message","messageVisible","announcement","announcementVisible","screensaver"];
        for (const key of allowed) {
            if (Object.prototype.hasOwnProperty.call(data,key)) currentState[key]=data[key];
        }
        io.emit("display-settings", currentState);
    });

    socket.on("animation-mode", (data) => {
        if (socket.role !== "controller") return;
        const mode = Number(data && data.mode);
        if (!Number.isInteger(mode) || mode < 0 || mode > 9) return;
        currentState.mode = mode;
        io.emit("animation-mode", { mode });
    });

    socket.on("animation-auto", (data) => {
        if (socket.role !== "controller") return;
        currentState.auto = Boolean(data && data.enabled);
        io.emit("animation-auto", { enabled: currentState.auto });
    });

    socket.on("reset-display", () => {
        if (socket.role !== "controller") return;

        currentState = {
            image: null,
            audioLevel: 0,
            scale: 1,
            rotation: 0,
            mode: 0,
            auto: true,
            speed: 1,
            intensity: 1,
            brightness: 1,
            color: "#ff9800",
            effect: "none",
            audioReactive: true,
            lights: true,
            message: "",
            messageVisible: false,
            announcement: "",
            announcementVisible: false,
            screensaver: false
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
    console.log("Port:", PORT);
    console.log("Index:", path.join(PUBLIC_DIR, "index.html"));
    console.log("Viewer:", path.join(PUBLIC_DIR, "viewer.html"));
    console.log("Editor:", path.join(PUBLIC_DIR, "editor.html"));
    console.log("=================================");
});

process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
});

process.on("unhandledRejection", (error) => {
    console.error("Unhandled rejection:", error);
});
