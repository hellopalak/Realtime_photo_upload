#!/usr/bin/env node

/**
 * authorize.js
 * One-click helper for Google Drive OAuth2 authorization.
 * Run: npm run authorize
 */

require('dotenv').config();
const http = require('http');
const { google } = require('googleapis');
const open = null; // optional external opener

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('');
  console.error('❌  GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env.');
  console.error('    Get them from Google Cloud Console -> APIs & Services -> Credentials.');
  console.error('');
  process.exit(1);
}

const PORT = 3000;
console.log('');
console.log('═══════════════════════════════════════════════════════');
console.log('  🔑  Google Drive One-Click Authorization');
console.log('═══════════════════════════════════════════════════════');
console.log('');
console.log('When your server is running (npm start), simply visit:');
console.log('');
console.log(`   👉  http://localhost:${PORT}/auth/google`);
console.log('');
console.log('It will:');
console.log('  1. Open Google OAuth consent page.');
console.log('  2. Receive the authorization token automatically.');
console.log('  3. Save GOOGLE_REFRESH_TOKEN into your .env file.');
console.log('');
console.log('Alternatively, if you prefer local storage, no Google Drive setup is needed!');
console.log('═══════════════════════════════════════════════════════');
console.log('');
