const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "4000", 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Ensure public/uploads directory exists
const uploadsDir = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Database initialization
const dbPath = path.resolve(process.cwd(), "bingo.db");
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    password_hash TEXT,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    bingo_score INTEGER DEFAULT 0,
    approved_count INTEGER DEFAULT 0,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS player_grids (
    player_id TEXT NOT NULL,
    tile_index INTEGER NOT NULL,
    task_id INTEGER,
    status TEXT CHECK(status IN ('not_started', 'pending', 'approved', 'rejected')) NOT NULL DEFAULT 'not_started',
    image_path TEXT,
    uploaded_at TEXT,
    rejection_reason TEXT,
    rejection_count INTEGER DEFAULT 0,
    PRIMARY KEY (player_id, tile_index),
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS used_captchas (
    id TEXT PRIMARY KEY,
    used_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS signup_rate_limits (
    ip TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

try {
  db.exec(`CREATE INDEX IF NOT EXISTS idx_used_captchas_used_at ON used_captchas(used_at);`);
} catch (_) {}
try {
  db.exec(`CREATE INDEX IF NOT EXISTS idx_signup_rate_limits_ip_time ON signup_rate_limits(ip, timestamp);`);
} catch (_) {}

try {
  db.exec(`ALTER TABLE players ADD COLUMN email TEXT;`);
} catch (_) {}
try {
  db.exec(`ALTER TABLE players ADD COLUMN password_hash TEXT;`);
} catch (_) {}
try {
  db.exec(`ALTER TABLE players ADD COLUMN created_at TEXT;`);
} catch (_) {}
try {
  db.exec(`ALTER TABLE players ADD COLUMN nickname TEXT;`);
} catch (_) {}
try {
  db.exec(`ALTER TABLE player_grids ADD COLUMN rejection_count INTEGER DEFAULT 0;`);
} catch (_) {}
try {
  db.exec(`UPDATE player_grids SET rejection_count = 1 WHERE status = 'rejected' AND (rejection_count IS NULL OR rejection_count = 0);`);
} catch (_) {}
try {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_players_email ON players(email);`);
} catch (_) {}
try {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_players_nickname ON players(LOWER(nickname)) WHERE nickname IS NOT NULL;`);
} catch (_) {}
try {
  db.exec(`ALTER TABLE tasks ADD COLUMN task_type TEXT DEFAULT 'photo';`);
} catch (_) {}
try {
  db.exec(`ALTER TABLE player_grids ADD COLUMN text_answer TEXT;`);
} catch (_) {}
try {
  db.exec(`ALTER TABLE tasks ADD COLUMN clue_image TEXT;`);
} catch (_) {}

// Sync / Populate Thilakkam Annual Day tasks
const THILAKKAM_ANNUAL_DAY_TASKS = [
  {
    "title": "CDMG Team Full Form",
    "description": "What is the full form of the CDMG team?",
    "task_type": "question"
  },
  {
    "title": "Dog Bench Selfie",
    "description": "Find the bench featuring a picture of a dog and take a selfie while sitting on it.",
    "task_type": "photo"
  },
  {
    "title": "Programme Hall Steps",
    "description": "How many steps lead to the Programme Hall (Conference Room) from the ground?",
    "task_type": "question"
  },
  {
    "title": "Find This Spot: Resort Gate",
    "description": "Find the gate shown in the reference photo and take a selfie in front of it.",
    "task_type": "photo",
    "clue_image": "/clues/clue_gate.jpg"
  },
  {
    "title": "Confianz Marketing Mascot",
    "description": "What is the name of Confianz’s marketing mascot?",
    "task_type": "question"
  },
  {
    "title": "Pool View Moment",
    "description": "Capture a photo of someone enjoying the pool view.",
    "task_type": "photo"
  },
  {
    "title": "Kalvilakku Traditional Lamp",
    "description": "Take a selfie with the Kalvilakku (traditional stone lamp).",
    "task_type": "photo"
  },
  {
    "title": "Resort Restaurant Name",
    "description": "What is the name of the resort’s restaurant?",
    "task_type": "question"
  },
  {
    "title": "Yoga Centre Visit",
    "description": "Take a photo of yourself or a colleague at the Yoga Centre, with the yoga poster.",
    "task_type": "photo"
  },
  {
    "title": "Arch-Shaped Bridge",
    "description": "Find the arch-shaped bridge and take a selfie with it.",
    "task_type": "photo"
  },
  {
    "title": "Director of PR",
    "description": "Who is the Director of Public Relations at Confianz?",
    "task_type": "question"
  },
  {
    "title": "Beer Parlour Signboard",
    "description": "What is the font/text color used on the “BEER PARLOUR” board?",
    "task_type": "question"
  },
  {
    "title": "Colleague in Black Dress",
    "description": "Take a selfie with a colleague wearing a black-colored dress.",
    "task_type": "photo"
  },
  {
    "title": "TDP Team Full Form",
    "description": "What is the full form of the TDP team?",
    "task_type": "question"
  },
  {
    "title": "Indoor Game Action",
    "description": "Capture a photo of yourself or a colleague playing an indoor game.",
    "task_type": "photo"
  },
  {
    "title": "Find This Spot: Wall Painting",
    "description": "Find the wall painting shown in the reference photo and take a selfie with it.",
    "task_type": "photo",
    "clue_image": "/clues/clue_wall_painting.jpg"
  },
  {
    "title": "Confianz Employee Awards",
    "description": "Name any three awards or recognitions received by Confianz employees.",
    "task_type": "question"
  },
  {
    "title": "Ayur Theeram Hospital",
    "description": "Take a selfie in front of Ayur Theeram Hospital.",
    "task_type": "photo"
  },
  {
    "title": "Resort MD Name",
    "description": "Find the suggestions box and answer this question: What is the name of the resort’s Managing Director?",
    "task_type": "question"
  },
  {
    "title": "Nail Polish Snapshot",
    "description": "Upload a photo of a female colleague wearing nail polish.",
    "task_type": "photo"
  },
  {
    "title": "Multi-Unit Group Selfie",
    "description": "Take a group selfie with members from at least four different units.",
    "task_type": "photo"
  },
  {
    "title": "Indian Office Room Names",
    "description": "List the names of the rooms in the Confianz Indian office.",
    "task_type": "question"
  },
  {
    "title": "Creative Reflection Shot",
    "description": "Take a creative photo using a reflection in water, glass, or a mirror.",
    "task_type": "photo"
  },
  {
    "title": "Selfie with Vinod",
    "description": "Take a selfie with Vinod.",
    "task_type": "photo"
  }
];

const insertOrReplaceTask = db.prepare(`
  INSERT INTO tasks (id, title, description, task_type, clue_image)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET 
    title = excluded.title, 
    description = excluded.description, 
    task_type = excluded.task_type,
    clue_image = excluded.clue_image
`);
const syncTx = db.transaction((tasks) => {
  for (let i = 0; i < tasks.length; i++) {
    insertOrReplaceTask.run(
      i + 1, 
      tasks[i].title, 
      tasks[i].description, 
      tasks[i].task_type || 'photo',
      tasks[i].clue_image || null
    );
  }
});
syncTx(THILAKKAM_ANNUAL_DAY_TASKS);
db.close();

function detectFileMime(filePath) {
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);

    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return "image/jpeg";
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return "image/png";
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "image/gif";
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
        buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "image/webp";
  } catch (_) {}

  const ext = path.extname(filePath).toLowerCase();
  const MIME_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml"
  };
  return MIME_TYPES[ext] || "application/octet-stream";
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    const pathname = parsedUrl.pathname || "";

    // 1. Direct static serving for user uploaded photos
    if (pathname.startsWith("/uploads/")) {
      const filename = path.basename(decodeURIComponent(pathname));
      const possibleUploadPaths = [
        path.join(uploadsDir, filename),
        path.join(__dirname, "public", "uploads", filename),
        path.join(process.cwd(), "public", "uploads", filename),
        path.join(process.cwd(), "uploads", filename),
        path.join(__dirname, "uploads", filename)
      ];

      let foundUploadPath = null;
      for (const p of possibleUploadPaths) {
        if (fs.existsSync(p)) {
          foundUploadPath = p;
          break;
        }
      }

      if (foundUploadPath) {
        try {
          const stat = fs.statSync(foundUploadPath);
          const contentType = detectFileMime(foundUploadPath);

          res.writeHead(200, {
            "Content-Type": contentType,
            "Content-Length": stat.size,
            "Cache-Control": "public, max-age=31536000, immutable",
            "Access-Control-Allow-Origin": "*"
          });

          const stream = fs.createReadStream(foundUploadPath);
          stream.pipe(res);
          return;
        } catch (err) {
          console.error("Error streaming upload:", err);
        }
      }
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("File not found");
      return;
    }

    // 2. Direct static serving for task clue images
    if (pathname.startsWith("/clues/")) {
      const filename = path.basename(decodeURIComponent(pathname));
      const possibleCluePaths = [
        path.join(process.cwd(), "public", "clues", filename),
        path.join(__dirname, "public", "clues", filename),
        path.join(process.cwd(), "clues", filename),
        path.join(__dirname, "clues", filename)
      ];

      let foundCluePath = null;
      for (const p of possibleCluePaths) {
        if (fs.existsSync(p)) {
          foundCluePath = p;
          break;
        }
      }

      if (foundCluePath) {
        try {
          const stat = fs.statSync(foundCluePath);
          const contentType = detectFileMime(foundCluePath);

          res.writeHead(200, {
            "Content-Type": contentType,
            "Content-Length": stat.size,
            "Cache-Control": "public, max-age=31536000, immutable",
            "Access-Control-Allow-Origin": "*"
          });

          const stream = fs.createReadStream(foundCluePath);
          stream.pipe(res);
          return;
        } catch (err) {
          console.error("Error streaming clue:", err);
        }
      }
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("File not found");
      return;
    }

    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Attach io to global object so Next.js APIs can access it
  global.io = io;

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("join", (roomName) => {
      console.log(`Socket ${socket.id} joined room: ${roomName}`);
      socket.join(roomName);
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
