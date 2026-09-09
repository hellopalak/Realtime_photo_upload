const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

let driveClient = null;
let authMode = 'none'; // 'oauth2' | 'service_account' | 'none'
let initError = null;

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
let REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;
const SERVICE_ACCOUNT_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || path.join(__dirname, '..', 'service-account-key.json');

/**
 * Initialize Google Drive Client safely
 */
function initializeDrive() {
  try {
    // 1. Try OAuth2 if refresh token and client secrets are available
    if (CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN) {
      const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
      oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
      driveClient = google.drive({ version: 'v3', auth: oauth2Client });
      authMode = 'oauth2';
      initError = null;
      console.log('☁️  Google Drive initialized with OAuth2 user credentials.');
      return;
    }

    // 2. Try Service Account JSON key if present
    const resolvedKeyPath = path.isAbsolute(SERVICE_ACCOUNT_PATH)
      ? SERVICE_ACCOUNT_PATH
      : path.join(__dirname, '..', SERVICE_ACCOUNT_PATH);

    if (fs.existsSync(resolvedKeyPath)) {
      const auth = new google.auth.GoogleAuth({
        keyFile: resolvedKeyPath,
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
      driveClient = google.drive({ version: 'v3', auth });
      authMode = 'service_account';
      initError = null;
      console.log(`☁️  Google Drive initialized with Service Account (${path.basename(resolvedKeyPath)}).`);
      return;
    }

    // 3. Fallback: Not configured
    authMode = 'none';
    initError = 'Neither OAuth2 refresh token nor service account key is available.';
    console.log('ℹ️  Google Drive not configured. Running in Local Storage mode.');
  } catch (err) {
    authMode = 'none';
    initError = err.message;
    console.warn('⚠️  Could not initialize Google Drive:', err.message);
  }
}

// Run initial setup
initializeDrive();

/**
 * Generate OAuth2 Authorization URL
 * @param {string} redirectUri
 * @returns {string}
 */
function getAuthUrl(redirectUri = 'http://localhost:3000/oauth2callback') {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env to use OAuth2.');
  }

  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, redirectUri);
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'],
  });
}

/**
 * Exchange OAuth2 authorization code for refresh token and re-initialize
 * @param {string} code
 * @param {string} redirectUri
 * @returns {Promise<string>}
 */
async function exchangeCodeForTokens(code, redirectUri = 'http://localhost:3000/oauth2callback') {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
  }

  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, redirectUri);
  const { tokens } = await oauth2Client.getToken(code.trim());

  if (tokens.refresh_token) {
    REFRESH_TOKEN = tokens.refresh_token;

    // Update .env file automatically
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      if (envContent.includes('GOOGLE_REFRESH_TOKEN=')) {
        envContent = envContent.replace(/GOOGLE_REFRESH_TOKEN=.*/, `GOOGLE_REFRESH_TOKEN=${REFRESH_TOKEN}`);
      } else {
        envContent += `\nGOOGLE_REFRESH_TOKEN=${REFRESH_TOKEN}\n`;
      }
      fs.writeFileSync(envPath, envContent, 'utf8');
    }

    process.env.GOOGLE_REFRESH_TOKEN = REFRESH_TOKEN;
    initializeDrive();
  }

  return tokens.refresh_token || null;
}

/**
 * Upload a photo to the configured Google Drive folder.
 * Gracefully catches errors (e.g. quota limits) and returns a result object.
 * @param {string} filePath - Local absolute file path
 * @param {string} fileName - Destination file name
 * @param {string} mimeType - File mime type
 * @returns {Promise<{success: boolean, fileId?: string, url?: string, timestamp?: string, error?: string}>}
 */
async function uploadPhotoToDrive(filePath, fileName, mimeType = 'image/jpeg') {
  if (!driveClient) {
    return {
      success: false,
      error: initError || 'Google Drive client is not active.',
    };
  }

  try {
    const fileMetadata = {
      name: fileName,
      ...(FOLDER_ID ? { parents: [FOLDER_ID] } : {}),
    };

    const media = {
      mimeType: mimeType || 'image/jpeg',
      body: fs.createReadStream(filePath),
    };

    const response = await driveClient.files.create({
      requestBody: fileMetadata,
      media,
      supportsAllDrives: true,
      fields: 'id, createdTime, webViewLink, webContentLink',
    });

    const fileId = response.data.id;
    const timestamp = response.data.createdTime || new Date().toISOString();

    // Attempt to make file readable by anyone with link
    try {
      await driveClient.permissions.create({
        fileId,
        supportsAllDrives: true,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });
    } catch (permErr) {
      console.warn('Could not set public permission on Drive file:', permErr.message);
    }

    const url = `https://drive.google.com/uc?export=view&id=${fileId}`;
    const webViewLink = response.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

    return {
      success: true,
      fileId,
      url,
      webViewLink,
      timestamp,
    };
  } catch (err) {
    console.error('Google Drive upload attempt error:', err.message);
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Get current Google Drive configuration status
 */
function getDriveStatus() {
  return {
    configured: driveClient !== null,
    authMode,
    folderId: FOLDER_ID || null,
    hasOAuthSecrets: Boolean(CLIENT_ID && CLIENT_SECRET),
    hasRefreshToken: Boolean(REFRESH_TOKEN),
    initError,
  };
}

module.exports = {
  uploadPhotoToDrive,
  getDriveStatus,
  getAuthUrl,
  exchangeCodeForTokens,
  initializeDrive,
};
