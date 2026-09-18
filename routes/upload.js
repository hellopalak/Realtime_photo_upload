const express = require('express');
const multer = require('multer');
const path = require('path');
const QRCode = require('qrcode');
const { uploadPhotoToDrive, getDriveStatus } = require('../config/googleDrive');
const photoStorage = require('../services/photoStorage');

const router = express.Router();

// ---------------------------------------------------------------------------
// Multer setup — save directly into the public/uploads directory
// ---------------------------------------------------------------------------
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, photoStorage.UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const prefix = file.mimetype.startsWith('video/') ? 'video' : 'photo';
    cb(null, `${prefix}_${timestamp}_${random}${ext}`);
  },
});

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'image/gif',
  'image/bmp',
  'video/mp4',
  'video/quicktime',   // iOS .mov
  'video/3gpp',        // Android 3gp
  'video/3gpp2',
  'video/webm',
  'video/x-matroska',  // mkv
  'video/x-msvideo',   // avi
  'video/x-m4v',       // m4v
  'audio/mpeg',
  'audio/mp3',
];

// Allowed extensions as fallback when MIME type is missing or generic
const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.bmp',
  '.mp4', '.mov', '.avi', '.webm', '.mkv', '.3gp', '.3gpp', '.flv', '.m4v',
  '.mp3', '.mpeg',
];

const fileFilter = (_req, file, cb) => {
  const mime = (file.mimetype || '').toLowerCase();
  const ext = path.extname(file.originalname).toLowerCase();

  if (ALLOWED_MIME_TYPES.includes(mime)
    || mime.startsWith('image/')
    || mime.startsWith('video/')
    || mime.startsWith('audio/')
    || ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type "${file.mimetype}" (${ext}). Supported: images, videos (MP4, MOV, WebM), and audio.`
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max (videos need more)
});

// ---------------------------------------------------------------------------
// POST /api/upload — upload single photo
// ---------------------------------------------------------------------------
router.post('/upload', (req, res) => {
  upload.single('photo')(req, res, async (multerErr) => {
    if (multerErr) {
      return res.status(400).json({ success: false, error: multerErr.message });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided. Send an image or video with the field name "photo".',
      });
    }

    const { filename, path: filePath, originalname, mimetype, size } = req.file;

    try {
      // 1. Create local photo record
      const photoRecord = photoStorage.addPhoto({
        filename,
        originalName: originalname,
        url: `/uploads/${filename}`,
        mimeType: mimetype,
        size,
        timestamp: new Date().toISOString(),
      });

      // 2. Broadcast immediately via Socket.IO for zero-latency live viewing
      const io = req.app.get('io');
      if (io) {
        io.emit('new-photo', photoRecord);
      }

      // 3. Attempt Google Drive backup in background (does not block or fail the user request)
      uploadPhotoToDrive(filePath, originalname || filename, mimetype)
        .then((driveRes) => {
          if (driveRes.success) {
            photoStorage.updatePhoto(photoRecord.id, {
              driveId: driveRes.fileId,
              driveUrl: driveRes.webViewLink || driveRes.url,
              driveSynced: true,
            });
            console.log(`✅ Photo "${filename}" successfully backed up to Google Drive (ID: ${driveRes.fileId})`);
            if (io) {
              io.emit('photo-updated', {
                id: photoRecord.id,
                driveUrl: driveRes.webViewLink || driveRes.url,
                driveSynced: true,
              });
            }
          } else {
            console.warn(`ℹ️  Local photo saved. Google Drive sync skipped: ${driveRes.error}`);
          }
        })
        .catch((driveErr) => {
          console.warn('ℹ️  Drive background sync warning:', driveErr.message);
        });

      return res.status(200).json({
        success: true,
        photo: photoRecord,
        message: 'Media uploaded successfully and broadcast to guests!',
      });
    } catch (err) {
      console.error('Upload processing error:', err.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to process photo: ' + err.message,
      });
    }
  });
});

// ---------------------------------------------------------------------------
// GET /api/latest-photo — get the latest photo
// ---------------------------------------------------------------------------
router.get('/latest-photo', (_req, res) => {
  const photo = photoStorage.getLatestPhoto();
  return res.status(200).json({
    success: true,
    photo: photo || null,
    message: photo ? 'Latest photo retrieved' : 'No photos uploaded yet.',
  });
});

// ---------------------------------------------------------------------------
// GET /api/photos — get list of recent photos
// ---------------------------------------------------------------------------
router.get('/photos', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  const photos = photoStorage.getRecentPhotos(limit);
  return res.status(200).json({
    success: true,
    photos,
    total: photoStorage.getCount(),
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/photos/:id — delete a photo
// ---------------------------------------------------------------------------
router.delete('/photos/:id', (req, res) => {
  const { id } = req.params;
  const deleted = photoStorage.deletePhoto(id);

  if (deleted) {
    const io = req.app.get('io');
    if (io) {
      io.emit('photo-deleted', { id });
    }
    return res.status(200).json({ success: true, message: 'Photo deleted' });
  }

  return res.status(404).json({ success: false, error: 'Photo not found' });
});

// ---------------------------------------------------------------------------
// GET /api/status — system status overview
// ---------------------------------------------------------------------------
router.get('/status', (_req, res) => {
  const driveStatus = getDriveStatus();
  return res.status(200).json({
    success: true,
    status: 'online',
    photosCount: photoStorage.getCount(),
    googleDrive: driveStatus,
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// GET /api/qr — generate QR code as a data URL for client display
// ---------------------------------------------------------------------------
router.get('/qr', async (req, res) => {
  try {
    const host = req.get('host');
    const protocol = req.protocol;
    const defaultUrl = `${protocol}://${host}/guest.html`;
    const targetUrl = process.env.PUBLIC_APP_URL
      ? `${process.env.PUBLIC_APP_URL.replace(/\/+$/, '')}/guest.html`
      : defaultUrl;

    const qrDataUrl = await QRCode.toDataURL(targetUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#0a0a0f', light: '#ffffff' },
    });

    return res.status(200).json({
      success: true,
      url: targetUrl,
      qrDataUrl,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
