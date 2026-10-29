import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import { FUNNY_NICKNAMES } from './nicknames';

const dbPath = path.resolve(process.cwd(), 'bingo.db');
let dbInstance: Database.Database | null = null;
let initialized = false;

export function getDB() {
  if (!dbInstance) {
    dbInstance = new Database(dbPath, { verbose: console.log });
    dbInstance.pragma('journal_mode = WAL');
  }
  if (!initialized) {
    initialized = true;
    initDB();
  }
  return dbInstance;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  task_type?: 'photo' | 'question';
}

export interface Player {
  id: string;
  email?: string;
  name: string;
  nickname?: string;
  department: string;
  bingo_score: number;
  approved_count: number;
  created_at?: string;
}

export interface GridCell {
  player_id: string;
  tile_index: number;
  task_id: number | null;
  status: 'not_started' | 'pending' | 'approved' | 'rejected';
  image_path: string | null;
  text_answer?: string | null;
  uploaded_at: string | null;
  approved_at?: string | null;
  rejection_reason: string | null;
  rejection_count: number;
  // Joined fields
  task_title?: string;
  task_description?: string;
  task_type?: 'photo' | 'question';
  clue_image?: string | null;
}

export const THILAKKAM_ANNUAL_DAY_TASKS: Array<{ title: string; description: string; task_type: 'photo' | 'question'; clue_image?: string }> = [
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

export const RESORT_ANNUAL_DAY_TASKS = THILAKKAM_ANNUAL_DAY_TASKS;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

export function initDB() {
  const db = getDB();

  // Create tables
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
      nickname TEXT,
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
      approved_at TEXT,
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

  // Run migrations safely for existing databases
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
  try {
    db.exec(`ALTER TABLE player_grids ADD COLUMN approved_at TEXT;`);
  } catch (_) {}
  try {
    db.exec(`UPDATE player_grids SET approved_at = COALESCE(uploaded_at, datetime('now')) WHERE status = 'approved' AND approved_at IS NULL;`);
  } catch (_) {}

  // Sync / Populated Thilakkam Annual Day tasks
  const insertOrReplace = db.prepare(`
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
      insertOrReplace.run(
        i + 1, 
        tasks[i].title, 
        tasks[i].description, 
        tasks[i].task_type || 'photo',
        tasks[i].clue_image || null
      );
    }
  });
  syncTx(THILAKKAM_ANNUAL_DAY_TASKS);
}

export function getAvailableNicknames(): { available: string[]; taken: string[] } {
  const db = getDB();
  const takenRows = db.prepare("SELECT LOWER(TRIM(nickname)) as name FROM players WHERE nickname IS NOT NULL AND TRIM(nickname) != ''").all() as { name: string }[];
  const takenSet = new Set(takenRows.map(r => r.name.toLowerCase()));

  const available = FUNNY_NICKNAMES.filter(n => !takenSet.has(n.toLowerCase()));
  const takenList = FUNNY_NICKNAMES.filter(n => takenSet.has(n.toLowerCase()));

  return { available, taken: takenList };
}

export function isNicknameAvailable(nickname: string): boolean {
  const db = getDB();
  const clean = nickname.trim().toLowerCase();
  if (!clean) return false;
  const row = db.prepare('SELECT id FROM players WHERE LOWER(TRIM(nickname)) = ?').get(clean);
  return !row;
}

export function signUpPlayer(
  email: string,
  password: string,
  nickname: string,
  name?: string,
  department: string = ''
): { player: Player; grid: GridCell[] } {
  const db = getDB();
  const cleanEmail = email.trim().toLowerCase();
  const cleanNickname = (nickname || '').trim();
  const cleanName = (name && name.trim()) ? name.trim() : cleanNickname;
  const cleanDept = (department || '').trim();

  if (!cleanEmail) {
    throw new Error('Email is required.');
  }
  if (!cleanEmail.endsWith('@confianzit.com') || cleanEmail.indexOf('@') <= 0) {
    throw new Error("Email addresses outside the organization won't be allowed. Please use your @confianzit.com email.");
  }
  if (!cleanNickname) {
    throw new Error('Please choose or enter a nickname.');
  }
  if (cleanNickname.length < 2) {
    throw new Error('Nickname must be at least 2 characters long.');
  }
  if (cleanNickname.length > 35) {
    throw new Error('Nickname cannot exceed 35 characters.');
  }
  if (!password || password.length < 4) {
    throw new Error('Password must be at least 4 characters long.');
  }

  // Check if email is already registered
  const existing = db.prepare('SELECT id FROM players WHERE LOWER(email) = ?').get(cleanEmail) as { id: string } | undefined;
  if (existing) {
    throw new Error('An account with this email address already exists.');
  }

  // Check if nickname is already registered (case-insensitive)
  const existingNick = db.prepare('SELECT id FROM players WHERE LOWER(TRIM(nickname)) = ?').get(cleanNickname.toLowerCase()) as { id: string } | undefined;
  if (existingNick) {
    throw new Error(`The nickname "${cleanNickname}" is already taken by another player. Please select another one!`);
  }

  const playerId = crypto.randomUUID();
  const passwordHash = hashPassword(password);
  const now = new Date().toISOString();

  // Insert player
  const insertPlayer = db.prepare(`
    INSERT INTO players (id, email, password_hash, name, nickname, department, bingo_score, approved_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)
  `);
  insertPlayer.run(playerId, cleanEmail, passwordHash, cleanName, cleanNickname, cleanDept, now);

  // Fetch all tasks and shuffle them
  const allTasks = db.prepare('SELECT id FROM tasks').all() as { id: number }[];
  const shuffledTasks = [...allTasks].sort(() => Math.random() - 0.5);

  // Insert 25 grid entries (5x5 grid)
  const insertGridCell = db.prepare(`
    INSERT INTO player_grids (player_id, tile_index, task_id, status, image_path, uploaded_at, approved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const gridTransaction = db.transaction((pid: string) => {
    let taskIndex = 0;
    for (let i = 0; i < 25; i++) {
      if (i === 12) {
        // Center FREE SPACE: pre-approved, no task_id, no image
        insertGridCell.run(pid, i, null, 'approved', null, now, now);
      } else {
        const task = shuffledTasks[taskIndex++];
        insertGridCell.run(pid, i, task ? task.id : null, 'not_started', null, null, null);
      }
    }
  });

  gridTransaction(playerId);

  const player: Player = {
    id: playerId,
    email: cleanEmail,
    name: cleanName,
    nickname: cleanNickname,
    department: cleanDept,
    bingo_score: 0,
    approved_count: 0,
    created_at: now
  };

  const grid = getPlayerGrid(playerId);

  return { player, grid };
}

export function loginPlayer(email: string, password: string): { player: Player; grid: GridCell[] } {
  const db = getDB();
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail || !password) {
    throw new Error('Please enter both email and password.');
  }

  const row = db.prepare('SELECT * FROM players WHERE LOWER(email) = ?').get(cleanEmail) as (Player & { password_hash?: string }) | undefined;

  if (!row || !row.password_hash) {
    throw new Error('Invalid email or password.');
  }

  const isValid = verifyPassword(password, row.password_hash);
  if (!isValid) {
    throw new Error('Invalid email or password.');
  }

  const player: Player = {
    id: row.id,
    email: row.email,
    name: row.name,
    nickname: (row as any).nickname || undefined,
    department: row.department,
    bingo_score: row.bingo_score,
    approved_count: row.approved_count,
    created_at: row.created_at
  };

  const grid = getPlayerGrid(row.id);

  return { player, grid };
}

export function deletePlayer(playerId: string): { success: boolean; email?: string; nickname?: string } {
  const db = getDB();
  const player = db.prepare('SELECT id, email, nickname FROM players WHERE id = ?').get(playerId) as { id: string; email?: string; nickname?: string } | undefined;
  if (!player) {
    throw new Error('Player not found.');
  }

  const deleteTx = db.transaction(() => {
    db.prepare('DELETE FROM player_grids WHERE player_id = ?').run(playerId);
    db.prepare('DELETE FROM players WHERE id = ?').run(playerId);
  });

  deleteTx();

  return {
    success: true,
    email: player.email,
    nickname: player.nickname
  };
}

export function resetPlayerPassword(playerId: string, newPassword: string): { success: boolean; email?: string; nickname?: string } {
  const db = getDB();
  const player = db.prepare('SELECT id, email, nickname FROM players WHERE id = ?').get(playerId) as { id: string; email?: string; nickname?: string } | undefined;
  if (!player) {
    throw new Error('Player not found.');
  }

  if (!newPassword || newPassword.length < 4) {
    throw new Error('Password must be at least 4 characters long.');
  }

  const passwordHash = hashPassword(newPassword);
  db.prepare('UPDATE players SET password_hash = ? WHERE id = ?').run(passwordHash, playerId);

  return {
    success: true,
    email: player.email,
    nickname: player.nickname
  };
}

export function registerPlayer(name: string, department: string = ''): Player {
  const db = getDB();
  const playerId = crypto.randomUUID();
  const cleanName = name.trim();
  const cleanDept = (department || '').trim();

  // Fallback for guest registration
  const insertPlayer = db.prepare('INSERT INTO players (id, name, department, bingo_score, approved_count, created_at) VALUES (?, ?, ?, 0, 0, ?)');
  insertPlayer.run(playerId, cleanName, cleanDept, new Date().toISOString());

  // Fetch all tasks and shuffle them
  const allTasks = db.prepare('SELECT id FROM tasks').all() as { id: number }[];
  const shuffledTasks = [...allTasks].sort(() => Math.random() - 0.5);

  const nowIso = new Date().toISOString();
  const insertGridCell = db.prepare(`
    INSERT INTO player_grids (player_id, tile_index, task_id, status, image_path, uploaded_at, approved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const gridTransaction = db.transaction((pid: string) => {
    let taskIndex = 0;
    for (let i = 0; i < 25; i++) {
      if (i === 12) {
        insertGridCell.run(pid, i, null, 'approved', null, nowIso, nowIso);
      } else {
        const task = shuffledTasks[taskIndex++];
        insertGridCell.run(pid, i, task ? task.id : null, 'not_started', null, null, null);
      }
    }
  });

  gridTransaction(playerId);

  return {
    id: playerId,
    name: cleanName,
    department: cleanDept,
    bingo_score: 0,
    approved_count: 0
  };
}

export function getPlayer(playerId: string): Player | null {
  const db = getDB();
  const stmt = db.prepare('SELECT id, email, name, nickname, department, bingo_score, approved_count, created_at FROM players WHERE id = ?');
  return (stmt.get(playerId) as Player) || null;
}

export function getPlayerGrid(playerId: string): GridCell[] {
  const db = getDB();
  const stmt = db.prepare(`
    SELECT pg.*, t.title as task_title, t.description as task_description, COALESCE(t.task_type, 'photo') as task_type, t.clue_image
    FROM player_grids pg
    LEFT JOIN tasks t ON pg.task_id = t.id
    WHERE pg.player_id = ?
    ORDER BY pg.tile_index ASC
  `);
  return stmt.all(playerId) as GridCell[];
}

export function updateTileStatus(
  playerId: string,
  tileIndex: number,
  status: 'pending' | 'approved' | 'rejected',
  imagePath?: string | null,
  rejectionReason?: string,
  textAnswer?: string
): { player: Player; grid: GridCell[] } {
  const db = getDB();

  // Update grid cell
  if (status === 'pending') {
    const stmt = db.prepare(`
      UPDATE player_grids
      SET status = ?, 
          image_path = COALESCE(?, image_path), 
          text_answer = COALESCE(?, text_answer),
          uploaded_at = ?, 
          approved_at = NULL,
          rejection_reason = NULL
      WHERE player_id = ? AND tile_index = ?
    `);
    stmt.run(status, imagePath || null, textAnswer || null, new Date().toISOString(), playerId, tileIndex);
  } else if (status === 'approved') {
    const stmt = db.prepare(`
      UPDATE player_grids
      SET status = ?, approved_at = ?, rejection_reason = NULL
      WHERE player_id = ? AND tile_index = ?
    `);
    stmt.run(status, new Date().toISOString(), playerId, tileIndex);
  } else if (status === 'rejected') {
    const stmt = db.prepare(`
      UPDATE player_grids
      SET status = ?, approved_at = NULL, rejection_reason = ?, rejection_count = COALESCE(rejection_count, 0) + 1
      WHERE player_id = ? AND tile_index = ?
    `);
    stmt.run(status, rejectionReason || null, playerId, tileIndex);
  }

  // Fetch updated grid to calculate scores
  const grid = getPlayerGrid(playerId);

  // Calculate scores
  const tiles = Array(25).fill('not_started');
  let approvedCount = 0;
  grid.forEach((cell) => {
    tiles[cell.tile_index] = cell.status;
    if (cell.status === 'approved' && cell.tile_index !== 12) {
      approvedCount++;
    }
  });
  tiles[12] = 'approved'; // Center is always approved for Bingo calculations

  let bingoScore = 0;

  // Check 5 horizontal rows
  for (let row = 0; row < 5; row++) {
    let rowApproved = true;
    for (let col = 0; col < 5; col++) {
      if (tiles[row * 5 + col] !== 'approved') {
        rowApproved = false;
        break;
      }
    }
    if (rowApproved) bingoScore++;
  }

  // Check 5 vertical columns
  for (let col = 0; col < 5; col++) {
    let colApproved = true;
    for (let row = 0; row < 5; row++) {
      if (tiles[row * 5 + col] !== 'approved') {
        colApproved = false;
        break;
      }
    }
    if (colApproved) bingoScore++;
  }

  // Update players table
  const updatePlayer = db.prepare(`
    UPDATE players
    SET bingo_score = ?, approved_count = ?
    WHERE id = ?
  `);
  updatePlayer.run(bingoScore, approvedCount, playerId);

  const player = getPlayer(playerId)!;

  return { player, grid };
}

export function getLeaderboard(): Player[] {
  const db = getDB();
  const stmt = db.prepare(`
    SELECT id, email, name, nickname, department, bingo_score, approved_count, created_at FROM players
    ORDER BY bingo_score DESC, approved_count DESC, name ASC
  `);
  return stmt.all() as Player[];
}

export interface PendingSubmission {
  player_id: string;
  player_name: string;
  player_nickname?: string;
  player_department: string;
  tile_index: number;
  task_id: number;
  task_title: string;
  task_description: string;
  task_type?: 'photo' | 'question';
  clue_image?: string | null;
  image_path?: string | null;
  text_answer?: string | null;
  uploaded_at: string;
  approved_at?: string | null;
  rejection_count: number;
}

export function getPendingSubmissions(): PendingSubmission[] {
  const db = getDB();
  const stmt = db.prepare(`
    SELECT 
      p.id as player_id,
      p.name as player_name,
      p.nickname as player_nickname,
      p.department as player_department,
      pg.tile_index,
      pg.task_id,
      t.title as task_title,
      t.description as task_description,
      COALESCE(t.task_type, 'photo') as task_type,
      t.clue_image,
      pg.image_path,
      pg.text_answer,
      pg.uploaded_at,
      pg.approved_at,
      COALESCE(pg.rejection_count, 0) as rejection_count
    FROM player_grids pg
    JOIN players p ON pg.player_id = p.id
    JOIN tasks t ON pg.task_id = t.id
    WHERE pg.status = 'pending'
    ORDER BY pg.uploaded_at ASC
  `);
  return stmt.all() as PendingSubmission[];
}

export interface RejectedSubmission {
  player_id: string;
  player_name: string;
  player_nickname?: string;
  player_department: string;
  tile_index: number;
  task_id: number;
  task_title: string;
  task_description: string;
  task_type?: 'photo' | 'question';
  clue_image?: string | null;
  image_path?: string | null;
  text_answer?: string | null;
  uploaded_at: string | null;
  rejection_reason: string | null;
  rejection_count: number;
}

export function getRejectedSubmissions(): RejectedSubmission[] {
  const db = getDB();
  const stmt = db.prepare(`
    SELECT 
      p.id as player_id,
      p.name as player_name,
      p.nickname as player_nickname,
      p.department as player_department,
      pg.tile_index,
      pg.task_id,
      t.title as task_title,
      t.description as task_description,
      COALESCE(t.task_type, 'photo') as task_type,
      t.clue_image,
      pg.image_path,
      pg.text_answer,
      pg.uploaded_at,
      pg.rejection_reason,
      COALESCE(pg.rejection_count, 0) as rejection_count
    FROM player_grids pg
    JOIN players p ON pg.player_id = p.id
    JOIN tasks t ON pg.task_id = t.id
    WHERE pg.status = 'rejected'
    ORDER BY pg.uploaded_at DESC
  `);
  return stmt.all() as RejectedSubmission[];
}
