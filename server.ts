import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RoomData {
  code: string;
  status: 'WAITING' | 'PLAYING' | 'FINISHED' | 'DISCONNECTED';
  players: {
    left: { name: string; avatar: string; ready: boolean; lastPing: number };
    right: { name: string; avatar: string; ready: boolean; lastPing: number } | null;
  };
  currentTurn: 'left' | 'right';
  seed: number;
  wind: number;
  lastAction?: any;
  lastUpdated: number;
}

const rooms = new Map<string, RoomData>();

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let res = '';
  for (let i = 0; i < 5; i++) {
    res += chars[Math.floor(Math.random() * chars.length)];
  }
  return res;
}

// Clean up stale rooms older than 30 mins
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.lastUpdated > 30 * 60 * 1000) {
      rooms.delete(code);
    }
  }
}, 5 * 60 * 1000);

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: Date.now() });
  });

  // Create room
  app.post('/api/rooms/create', (req, res) => {
    const { hostName, avatar } = req.body || {};
    const code = generateCode();
    const seed = Math.floor(Math.random() * 900000) + 100000;
    const wind = Number(((Math.floor(Math.random() * 81) - 40) / 10).toFixed(1));

    const room: RoomData = {
      code,
      status: 'WAITING',
      players: {
        left: {
          name: hostName || 'SOLUCAN 1',
          avatar: avatar || '🐛',
          ready: true,
          lastPing: Date.now(),
        },
        right: null,
      },
      currentTurn: 'left',
      seed,
      wind,
      lastAction: null,
      lastUpdated: Date.now(),
    };

    rooms.set(code, room);
    res.json({ success: true, room });
  });

  // Join room
  app.post('/api/rooms/join', (req, res) => {
    const { code, guestName, avatar } = req.body || {};
    const upperCode = (code || '').toUpperCase().trim();
    const room = rooms.get(upperCode);

    if (!room) {
      return res.status(404).json({ success: false, message: 'Oda bulunamadı!' });
    }

    if (room.players.right && room.players.right.name !== guestName) {
      return res.status(400).json({ success: false, message: 'Oda dolu!' });
    }

    room.players.right = {
      name: guestName || 'SOLUCAN 2',
      avatar: avatar || '🪖',
      ready: true,
      lastPing: Date.now(),
    };
    room.status = 'PLAYING';
    room.lastUpdated = Date.now();

    res.json({ success: true, room });
  });

  // Get room state
  app.get('/api/rooms/:code/state', (req, res) => {
    const code = req.params.code.toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Oda bulunamadı!' });
    }

    // Check disconnection (if other player hasn't pinged in 20s while playing)
    const now = Date.now();
    if (room.status === 'PLAYING') {
      if (now - room.players.left.lastPing > 20000 || (room.players.right && now - room.players.right.lastPing > 20000)) {
        room.status = 'DISCONNECTED';
      }
    }

    res.json({ success: true, room });
  });

  // Action (Fire bazooka or pass)
  app.post('/api/rooms/:code/action', (req, res) => {
    const code = req.params.code.toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Oda bulunamadı!' });
    }

    const { team, action, nextWind } = req.body;
    room.lastAction = action;
    room.currentTurn = team === 'left' ? 'right' : 'left';
    if (typeof nextWind === 'number') {
      room.wind = nextWind;
    } else {
      room.wind = Number(((Math.floor(Math.random() * 81) - 40) / 10).toFixed(1));
    }
    room.lastUpdated = Date.now();

    res.json({ success: true, room });
  });

  // Heartbeat ping
  app.post('/api/rooms/:code/ping', (req, res) => {
    const code = req.params.code.toUpperCase().trim();
    const { team } = req.body;
    const room = rooms.get(code);
    if (room) {
      if (team === 'left') {
        room.players.left.lastPing = Date.now();
      } else if (team === 'right' && room.players.right) {
        room.players.right.lastPing = Date.now();
      }
      room.lastUpdated = Date.now();
    }
    res.json({ success: true });
  });

  // Vite middleware in dev or static files in prod
  const isDev = process.env.NODE_ENV === 'development';
  const distPath = path.resolve(__dirname, 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));

  if (!isDev && hasDist) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
