// ---------------------------------------------------------------------------
// Load environment variables FIRST
// ---------------------------------------------------------------------------
require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const os = require('os');
const { Server } = require('socket.io');

const uploadRouter = require('./routes/upload');
const { getAuthUrl, exchangeCodeForTokens, getDriveStatus } = require('./config/googleDrive');

// ---------------------------------------------------------------------------
// Express + HTTP + Socket.IO setup
// ---------------------------------------------------------------------------
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Make io accessible inside route handlers via req.app.get('io')
app.set('io', io);

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  console.log(`➡️ ${req.method} ${req.url}`);
  next();
});

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads'), {
  maxAge: '1d',
  etag: true,
}));

// Serve static frontend files from /public
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
app.use('/api', uploadRouter);

// ---------------------------------------------------------------------------
// Google Drive OAuth2 routes (for 1-click authorization)
// ---------------------------------------------------------------------------
app.get('/auth/google', (req, res) => {
  try {
    const host = req.get('host');
    const protocol = req.protocol;
    const redirectUri = `${protocol}://${host}/oauth2callback`;
    const authUrl = getAuthUrl(redirectUri);
    return res.redirect(authUrl);
  } catch (err) {
    return res.status(500).send(`<h2>OAuth Initialization Error</h2><p>${err.message}</p>`);
  }
});

app.get('/oauth2callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) {
    return res.status(400).send(`<h2>Authorization Failed</h2><p>${error}</p><p><a href="/upload.html">Back to Upload</a></p>`);
  }
  if (!code) {
    return res.status(400).send(`<h2>No code received</h2><p><a href="/upload.html">Back to Upload</a></p>`);
  }

  try {
    const host = req.get('host');
    const protocol = req.protocol;
    const redirectUri = `${protocol}://${host}/oauth2callback`;
    await exchangeCodeForTokens(code, redirectUri);
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Google Drive Connected</title>
        <style>
          body { font-family: system-ui, sans-serif; background: #0a0a0f; color: #fff; text-align: center; padding: 60px 20px; }
          .card { max-width: 460px; margin: 0 auto; background: #1a1a26; padding: 30px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); }
          h2 { color: #00cec9; margin-bottom: 12px; }
          a { display: inline-block; margin-top: 20px; background: #6c5ce7; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>🎉 Google Drive Connected!</h2>
          <p>The refresh token was saved. Photos will now back up automatically to Google Drive.</p>
          <a href="/upload.html">Continue to Upload Page</a>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('OAuth exchange error:', err.message);
    return res.status(500).send(`<h2>Error Exchanging Code</h2><p>${err.message}</p>`);
  }
});

// ---------------------------------------------------------------------------
// Socket.IO connection handling
// ---------------------------------------------------------------------------
let activeGuestsCount = 0;

io.on('connection', (socket) => {
  activeGuestsCount++;
  io.emit('guests-count', activeGuestsCount);
  console.log(`✨ Guest connected: ${socket.id} (Active: ${activeGuestsCount})`);

  socket.on('disconnect', () => {
    activeGuestsCount = Math.max(0, activeGuestsCount - 1);
    io.emit('guests-count', activeGuestsCount);
    console.log(`👋 Guest disconnected: ${socket.id} (Active: ${activeGuestsCount})`);
  });
});

// Helper to get local network IP
function getNetworkIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
const networkIp = getNetworkIp();

server.listen(PORT, '0.0.0.0', () => {
  const driveStatus = getDriveStatus();
  console.log('');
  console.log('════════════════════════════════════════════════════════════');
  console.log('  📸  REALTIME EVENT PHOTO SHARING SYSTEM IS LIVE');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`  🏠  Event Hub:     http://localhost:${PORT}`);
  console.log(`  📷  Upload Page:   http://localhost:${PORT}/upload.html`);
  console.log(`  👀  Guest Viewer:  http://localhost:${PORT}/guest.html`);
  console.log('  ────────────────────────────────────────────────────────────');
  console.log(`  📱  Mobile/Wi-Fi:  http://${networkIp}:${PORT}/guest.html`);
  console.log(`  ☁️  Google Drive:  ${driveStatus.configured ? `Active (${driveStatus.authMode})` : 'Offline / Local Instant Mode'}`);
  console.log('════════════════════════════════════════════════════════════');
  console.log('');
});
