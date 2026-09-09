#!/usr/bin/env node

/**
 * generateQR.js
 * Generates a high-resolution QR code PNG for event guests.
 * Run: npm run generate-qr
 */

require('dotenv').config();
const QRCode = require('qrcode');
const path = require('path');
const os = require('os');

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

const networkIp = getNetworkIp();
const PORT = process.env.PORT || 3000;
let publicUrl = process.env.PUBLIC_APP_URL;

if (!publicUrl || publicUrl.includes('localhost')) {
  // If set to localhost, prefer LAN IP so phones scanning on Wi-Fi can connect
  console.log(`ℹ️  PUBLIC_APP_URL is localhost. Encoding Wi-Fi LAN IP (${networkIp}) for phone scanning.`);
  publicUrl = `http://${networkIp}:${PORT}`;
}

const guestUrl = publicUrl.replace(/\/+$/, '') + '/guest.html';
const outputPath = path.join(__dirname, '..', 'qr-code.png');

QRCode.toFile(outputPath, guestUrl, {
  width: 800,
  margin: 2,
  color: { dark: '#0a0a0f', light: '#ffffff' },
})
  .then(() => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  ✅  QR CODE GENERATED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`  📱  Guest URL : ${guestUrl}`);
    console.log(`  📁  Saved to  : ${outputPath}`);
    console.log('───────────────────────────────────────────────────────────');
    console.log('  💡  Print this QR code or display it on event screens.');
    console.log('      Guests on the same Wi-Fi can scan and view live photos!');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
  })
  .catch((err) => {
    console.error('❌  Failed to generate QR code:', err.message);
    process.exit(1);
  });
