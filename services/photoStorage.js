const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');
const DATA_DIR = path.join(__dirname, '..', 'data');
const PHOTOS_JSON = path.join(DATA_DIR, 'photos.json');

// Ensure directories exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory cache of photo metadata
let photos = [];

function loadPhotosFromDisk() {
  try {
    if (fs.existsSync(PHOTOS_JSON)) {
      const data = fs.readFileSync(PHOTOS_JSON, 'utf-8');
      photos = JSON.parse(data);
    } else {
      photos = [];
    }
  } catch (err) {
    console.error('Error reading photos.json, resetting to empty array:', err.message);
    photos = [];
  }
}

function savePhotosToDisk() {
  try {
    fs.writeFileSync(PHOTOS_JSON, JSON.stringify(photos, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing photos.json:', err.message);
  }
}

// Initialize on startup
loadPhotosFromDisk();

/**
 * Add a new photo record
 * @param {Object} photoData
 * @returns {Object}
 */
function addPhoto(photoData) {
  const record = {
    id: photoData.id || `photo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    filename: photoData.filename,
    originalName: photoData.originalName || photoData.filename,
    url: photoData.url || `/uploads/${photoData.filename}`,
    mimeType: photoData.mimeType || 'image/jpeg',
    size: photoData.size || 0,
    timestamp: photoData.timestamp || new Date().toISOString(),
    driveId: photoData.driveId || null,
    driveUrl: photoData.driveUrl || null,
    driveSynced: Boolean(photoData.driveSynced),
  };

  photos.unshift(record); // newest first
  savePhotosToDisk();
  return record;
}

/**
 * Update an existing photo (e.g. after Google Drive sync finishes)
 * @param {string} id
 * @param {Object} updates
 */
function updatePhoto(id, updates) {
  const photo = photos.find((p) => p.id === id);
  if (photo) {
    Object.assign(photo, updates);
    savePhotosToDisk();
    return photo;
  }
  return null;
}

/**
 * Get the latest single photo
 * @returns {Object|null}
 */
function getLatestPhoto() {
  return photos.length > 0 ? photos[0] : null;
}

/**
 * Get photos list with optional limit
 * @param {number} [limit=50]
 * @returns {Array<Object>}
 */
function getRecentPhotos(limit = 50) {
  return photos.slice(0, limit);
}

/**
 * Delete a photo
 * @param {string} id
 * @returns {boolean}
 */
function deletePhoto(id) {
  const index = photos.findIndex((p) => p.id === id);
  if (index === -1) return false;

  const [removed] = photos.splice(index, 1);
  savePhotosToDisk();

  // Try to remove physical file
  const filePath = path.join(UPLOADS_DIR, removed.filename);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.error('Failed to unlink deleted photo file:', e.message);
    }
  }

  return true;
}

/**
 * Total count of photos
 */
function getCount() {
  return photos.length;
}

module.exports = {
  UPLOADS_DIR,
  addPhoto,
  updatePhoto,
  getLatestPhoto,
  getRecentPhotos,
  deletePhoto,
  getCount,
};
