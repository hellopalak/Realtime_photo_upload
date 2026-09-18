(function () {
  'use strict';

  // Elements
  const dropzoneArea = document.getElementById('dropzoneArea');
  const multiFileInput = document.getElementById('multiFileInput');
  const cameraDirectInput = document.getElementById('cameraDirectInput');
  const videoDirectInput = document.getElementById('videoDirectInput');
  const galleryPickerInput = document.getElementById('galleryPickerInput');

  const uploadedCountStat = document.getElementById('uploadedCountStat');
  const activeGuestsStat = document.getElementById('activeGuestsStat');
  const storageStatusStat = document.getElementById('storageStatusStat');

  const uploadQueue = document.getElementById('uploadQueue');
  const queueList = document.getElementById('queueList');
  const sessionCountBadge = document.getElementById('sessionCountBadge');
  const photographerGalleryGrid = document.getElementById('photographerGalleryGrid');

  const openQrBtn = document.getElementById('openQrBtn');
  const qrModal = document.getElementById('qrModal');
  const closeQrModalBtn = document.getElementById('closeQrModalBtn');
  const copyGuestUrlBtn = document.getElementById('copyGuestUrlBtn');
  const modalQrImg = document.getElementById('modalQrImg');

  // Camera modal elements
  const snapCameraBtn = document.getElementById('snapCameraBtn');
  const recordVideoBtn = document.getElementById('recordVideoBtn');
  const cameraModal = document.getElementById('cameraModal');
  const closeCameraModalBtn = document.getElementById('closeCameraModalBtn');
  const cameraPreview = document.getElementById('cameraPreview');
  const flipCameraBtn = document.getElementById('flipCameraBtn');
  const shutterBtn = document.getElementById('shutterBtn');
  const recordBtn = document.getElementById('recordBtn');
  const recordBtnInner = document.getElementById('recordBtnInner');
  const snapshotCanvas = document.getElementById('snapshotCanvas');
  const cameraModalTitle = document.getElementById('cameraModalTitle');
  const recIndicator = document.getElementById('recIndicator');
  const recTimer = document.getElementById('recTimer');

  let sessionPhotos = [];

  // Camera state
  let cameraStream = null;
  let currentFacingMode = 'user'; // 'user' (front) or 'environment' (back)
  let cameraMode = 'photo'; // 'photo' or 'video'
  let mediaRecorder = null;
  let recordedChunks = [];
  let isRecording = false;
  let recordStartTime = null;
  let recTimerInterval = null;

  // -------------------------------------------------------------------------
  // Synthesized Minecraft Pop sound on upload
  // -------------------------------------------------------------------------
  function playMinecraftPop() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(1050, now + 0.08);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {}
  }

  // Shutter click sound
  function playShutterSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // White noise burst for shutter click
      const bufferSize = ctx.sampleRate * 0.06;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(now);
    } catch (e) {}
  }

  // -------------------------------------------------------------------------
  // Detect if device is mobile (for fallback to native capture)
  // -------------------------------------------------------------------------
  function isMobileDevice() {
    return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || ('ontouchstart' in window && navigator.maxTouchPoints > 2);
  }

  // -------------------------------------------------------------------------
  // Fetch System & Storage Status
  // -------------------------------------------------------------------------
  function loadSystemStatus() {
    fetch('/api/status')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          uploadedCountStat.textContent = data.photosCount || 0;
          sessionCountBadge.textContent = data.photosCount || 0;

          if (data.googleDrive && data.googleDrive.configured) {
            storageStatusStat.innerHTML = '<span style="color:var(--mc-emerald)">⚡ DRIVE SYNCED</span>';
          } else {
            storageStatusStat.innerHTML = '<span style="color:var(--mc-gold)">⚡ LOCAL REALM</span>';
          }
        }
      })
      .catch((err) => {
        console.error('Status fetch error:', err);
        storageStatusStat.textContent = 'LOCAL REALM';
      });
  }

  // -------------------------------------------------------------------------
  // Render Uploaded Photos Grid
  // -------------------------------------------------------------------------
  function loadExistingPhotos() {
    fetch('/api/photos?limit=50')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.photos)) {
          sessionPhotos = data.photos;
          renderPhotographerGrid();
        }
      })
      .catch(console.error);
  }

  function renderPhotographerGrid() {
    photographerGalleryGrid.innerHTML = '';
    uploadedCountStat.textContent = sessionPhotos.length;
    sessionCountBadge.textContent = sessionPhotos.length;

    sessionPhotos.forEach((photo) => {
      const card = document.createElement('div');
      card.className = 'gallery-card';
      card.id = `photocard_${photo.id}`;

      const isVideo = photo.mimeType && photo.mimeType.startsWith('video/');

      if (isVideo) {
        const video = document.createElement('video');
        video.className = 'gallery-card__img';
        video.src = photo.url;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = 'metadata';
        video.addEventListener('mouseenter', () => video.play());
        video.addEventListener('mouseleave', () => { video.pause(); video.currentTime = 0; });
        card.appendChild(video);

        // Video badge
        const badge = document.createElement('div');
        badge.className = 'video-badge';
        badge.textContent = '🎥 VIDEO';
        card.appendChild(badge);
      } else {
        const img = document.createElement('img');
        img.className = 'gallery-card__img';
        img.src = photo.url;
        img.alt = photo.originalName || 'Photo';
        card.appendChild(img);
      }

      const overlay = document.createElement('div');
      overlay.className = 'gallery-card__overlay';
      overlay.style.justifyContent = 'space-between';

      const time = document.createElement('span');
      time.className = 'gallery-card__time';
      time.textContent = new Date(photo.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Delete action button
      const deleteBtn = document.createElement('button');
      deleteBtn.innerHTML = '🗑️';
      deleteBtn.title = 'Remove Shot';
      deleteBtn.style.cssText = 'background:#aa0000;border:2px solid #000;padding:3px 6px;cursor:pointer;color:#fff;font-size:0.75rem;';
      deleteBtn.onclick = function (e) {
        e.stopPropagation();
        if (confirm('Delete this from the live spectator feed?')) {
          deletePhoto(photo.id);
        }
      };

      overlay.appendChild(time);
      overlay.appendChild(deleteBtn);

      card.appendChild(overlay);
      photographerGalleryGrid.appendChild(card);
    });
  }

  function deletePhoto(id) {
    fetch(`/api/photos/${id}`, { method: 'DELETE' })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          sessionPhotos = sessionPhotos.filter((p) => p.id !== id);
          renderPhotographerGrid();
        }
      })
      .catch(console.error);
  }

  // -------------------------------------------------------------------------
  // File Upload Processing
  // -------------------------------------------------------------------------
  function isMediaFile(file) {
    // Check MIME type first
    if (file.type && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      return true;
    }
    // Fallback: check extension (mobile browsers sometimes have empty/wrong MIME)
    const ext = (file.name || '').split('.').pop().toLowerCase();
    const mediaExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp',
                       'mp4', 'mov', 'avi', 'webm', 'mkv', '3gp', '3gpp', 'flv', 'm4v'];
    return mediaExts.includes(ext);
  }

  function handleFilesSelected(fileList) {
    if (!fileList || fileList.length === 0) return;
    uploadQueue.style.display = 'block';

    Array.from(fileList).forEach((file) => {
      console.log(`📁 File selected: ${file.name}, type: "${file.type}", size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      if (!isMediaFile(file)) {
        console.warn(`⚠️ Skipped non-media file: ${file.name} (type: ${file.type})`);
        return;
      }
      uploadSingleFile(file);
    });
  }

  function uploadSingleFile(file) {
    const queueItem = document.createElement('div');
    queueItem.className = 'queue-item';

    const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|avi|webm|mkv|3gp|3gpp|flv|m4v)$/i.test(file.name);
    let thumb;
    if (isVideo) {
      thumb = document.createElement('video');
      thumb.className = 'queue-item__thumb';
      thumb.src = URL.createObjectURL(file);
      thumb.muted = true;
      thumb.playsInline = true;
      thumb.preload = 'metadata';
    } else {
      thumb = document.createElement('img');
      thumb.className = 'queue-item__thumb';
      thumb.src = URL.createObjectURL(file);
    }

    const details = document.createElement('div');
    details.className = 'queue-item__details';

    const name = document.createElement('div');
    name.className = 'queue-item__name';
    name.textContent = file.name;

    const status = document.createElement('div');
    status.className = 'queue-item__status';
    status.textContent = '⏳ Dispensing to realm…';

    details.appendChild(name);
    details.appendChild(status);
    queueItem.appendChild(thumb);
    queueItem.appendChild(details);
    queueList.insertBefore(queueItem, queueList.firstChild);

    const formData = new FormData();
    formData.append('photo', file);

    fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.photo) {
          playMinecraftPop();
          status.style.color = 'var(--mc-emerald)';
          status.textContent = '🟩 Spawned into Spectator Feed!';
          sessionPhotos.unshift(data.photo);
          renderPhotographerGrid();

          setTimeout(() => {
            queueItem.style.opacity = '0.5';
          }, 6000);
        } else {
          status.style.color = 'var(--mc-redstone)';
          status.textContent = `❌ ${data.error || 'Upload failed'}`;
        }
      })
      .catch((err) => {
        status.style.color = 'var(--mc-redstone)';
        status.textContent = `❌ Error: ${err.message}`;
      });
  }

  // -------------------------------------------------------------------------
  // Live Camera (getUserMedia) — Photo Snap & Video Recording
  // -------------------------------------------------------------------------
  async function openCamera(mode) {
    cameraMode = mode;

    // On mobile, just trigger native capture input as a fallback
    if (isMobileDevice()) {
      if (mode === 'photo') {
        cameraDirectInput.click();
      } else {
        videoDirectInput.click();
      }
      return;
    }

    // Desktop: open getUserMedia viewfinder
    try {
      await startCameraStream();
    } catch (err) {
      console.error('Camera access failed:', err);
      alert('Could not access your camera. Please ensure camera permissions are granted.\n\nError: ' + err.message);
      return;
    }

    // Configure UI for mode
    if (mode === 'photo') {
      cameraModalTitle.textContent = '📸 LIVE VIEWFINDER';
      shutterBtn.style.display = '';
      recordBtn.style.display = 'none';
    } else {
      cameraModalTitle.textContent = '🎥 VIDEO RECORDER';
      shutterBtn.style.display = 'none';
      recordBtn.style.display = '';
      resetRecordButton();
    }

    cameraModal.classList.add('active');
  }

  async function startCameraStream() {
    // Stop any existing stream
    stopCameraStream();

    const constraints = {
      video: {
        facingMode: currentFacingMode,
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: cameraMode === 'video', // audio only for video recording
    };

    cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    cameraPreview.srcObject = cameraStream;
    await cameraPreview.play();
  }

  function stopCameraStream() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      cameraStream = null;
    }
    cameraPreview.srcObject = null;
  }

  function closeCamera() {
    // Stop any ongoing recording
    if (isRecording && mediaRecorder) {
      mediaRecorder.stop();
      isRecording = false;
    }
    clearInterval(recTimerInterval);
    recIndicator.style.display = 'none';
    stopCameraStream();
    cameraModal.classList.remove('active');
  }

  // Flip front/back camera
  async function flipCamera() {
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    try {
      await startCameraStream();
    } catch (err) {
      // If back camera doesn't exist, flip back
      currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
      console.warn('Could not flip camera:', err.message);
    }
  }

  // Take a photo snapshot from the live stream
  function takeSnapshot() {
    if (!cameraStream) return;

    const videoTrack = cameraStream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    const w = settings.width || cameraPreview.videoWidth;
    const h = settings.height || cameraPreview.videoHeight;

    snapshotCanvas.width = w;
    snapshotCanvas.height = h;
    const ctx = snapshotCanvas.getContext('2d');
    ctx.drawImage(cameraPreview, 0, 0, w, h);

    // Flash effect
    cameraPreview.style.filter = 'brightness(3)';
    setTimeout(() => { cameraPreview.style.filter = ''; }, 120);

    playShutterSound();

    snapshotCanvas.toBlob(function (blob) {
      if (!blob) return;
      const file = new File([blob], `camera_snap_${Date.now()}.jpg`, { type: 'image/jpeg' });
      handleFilesSelected([file]);
      closeCamera();
    }, 'image/jpeg', 0.92);
  }

  // Start/stop video recording
  function toggleRecording() {
    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  }

  function startRecording() {
    if (!cameraStream) return;

    recordedChunks = [];

    // Find a supported MIME type
    const mimeTypes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    let mimeType = '';
    for (const mt of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mt)) {
        mimeType = mt;
        break;
      }
    }

    try {
      mediaRecorder = new MediaRecorder(cameraStream, mimeType ? { mimeType } : {});
    } catch (err) {
      alert('Video recording is not supported in this browser.');
      return;
    }

    mediaRecorder.ondataavailable = function (e) {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = function () {
      const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'video/webm' });
      const ext = (mediaRecorder.mimeType || '').includes('mp4') ? 'mp4' : 'webm';
      const file = new File([blob], `camera_video_${Date.now()}.${ext}`, { type: blob.type });
      handleFilesSelected([file]);
      closeCamera();
    };

    mediaRecorder.start(100); // collect data every 100ms
    isRecording = true;

    // Update UI
    recordBtnInner.classList.add('recording');
    recordBtn.title = 'Stop Recording';
    recIndicator.style.display = 'flex';
    recordStartTime = Date.now();
    recTimer.textContent = '00:00';
    recTimerInterval = setInterval(updateRecTimer, 1000);
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    isRecording = false;
    clearInterval(recTimerInterval);
    recIndicator.style.display = 'none';
    resetRecordButton();
  }

  function resetRecordButton() {
    recordBtnInner.classList.remove('recording');
    recordBtn.title = 'Start Recording';
  }

  function updateRecTimer() {
    if (!recordStartTime) return;
    const elapsed = Math.floor((Date.now() - recordStartTime) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    recTimer.textContent = `${mins}:${secs}`;
  }

  // -------------------------------------------------------------------------
  // Camera button event listeners
  // -------------------------------------------------------------------------
  snapCameraBtn.addEventListener('click', function () {
    openCamera('photo');
  });

  recordVideoBtn.addEventListener('click', function () {
    openCamera('video');
  });

  closeCameraModalBtn.addEventListener('click', closeCamera);

  cameraModal.addEventListener('click', function (e) {
    if (e.target === cameraModal) closeCamera();
  });

  flipCameraBtn.addEventListener('click', flipCamera);
  shutterBtn.addEventListener('click', takeSnapshot);
  recordBtn.addEventListener('click', toggleRecording);

  // -------------------------------------------------------------------------
  // Event Listeners for file inputs (mobile fallback + gallery + dropzone)
  // -------------------------------------------------------------------------
  multiFileInput.addEventListener('change', function () {
    handleFilesSelected(multiFileInput.files);
    multiFileInput.value = '';
  });

  cameraDirectInput.addEventListener('change', function () {
    handleFilesSelected(cameraDirectInput.files);
    cameraDirectInput.value = '';
  });

  videoDirectInput.addEventListener('change', function () {
    handleFilesSelected(videoDirectInput.files);
    videoDirectInput.value = '';
  });

  galleryPickerInput.addEventListener('change', function () {
    handleFilesSelected(galleryPickerInput.files);
    galleryPickerInput.value = '';
  });

  dropzoneArea.addEventListener('dragover', function (e) {
    e.preventDefault();
    dropzoneArea.classList.add('dragover');
  });

  dropzoneArea.addEventListener('dragleave', function () {
    dropzoneArea.classList.remove('dragover');
  });

  dropzoneArea.addEventListener('drop', function (e) {
    e.preventDefault();
    dropzoneArea.classList.remove('dragover');
    if (e.dataTransfer && e.dataTransfer.files) {
      handleFilesSelected(e.dataTransfer.files);
    }
  });

  // -------------------------------------------------------------------------
  // QR Code Modal
  // -------------------------------------------------------------------------
  openQrBtn.addEventListener('click', function () {
    fetch('/api/qr')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.qrDataUrl) {
          modalQrImg.src = d.qrDataUrl;
        }
      })
      .catch(console.error);
    qrModal.classList.add('active');
  });

  closeQrModalBtn.addEventListener('click', function () {
    qrModal.classList.remove('active');
  });

  qrModal.addEventListener('click', function (e) {
    if (e.target === qrModal) qrModal.classList.remove('active');
  });

  copyGuestUrlBtn.addEventListener('click', function () {
    const guestUrl = window.location.origin + '/guest.html';
    navigator.clipboard.writeText(guestUrl).then(function () {
      const orig = copyGuestUrlBtn.innerHTML;
      copyGuestUrlBtn.innerHTML = '<span>✅</span> COPIED!';
      setTimeout(function () {
        copyGuestUrlBtn.innerHTML = orig;
      }, 2000);
    });
  });

  // -------------------------------------------------------------------------
  // Socket.IO
  // -------------------------------------------------------------------------
  const socket = io();

  socket.on('guests-count', function (count) {
    activeGuestsStat.textContent = count;
  });

  loadSystemStatus();
  loadExistingPhotos();
})();
