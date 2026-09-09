(function () {
  'use strict';

  // Elements
  const dropzoneArea = document.getElementById('dropzoneArea');
  const multiFileInput = document.getElementById('multiFileInput');
  const cameraDirectInput = document.getElementById('cameraDirectInput');
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

  let sessionPhotos = [];

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

      const img = document.createElement('img');
      img.className = 'gallery-card__img';
      img.src = photo.url;
      img.alt = photo.originalName || 'Photo';

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
        if (confirm('Delete this photo from the live spectator feed?')) {
          deletePhoto(photo.id);
        }
      };

      overlay.appendChild(time);
      overlay.appendChild(deleteBtn);

      card.appendChild(img);
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
  function handleFilesSelected(fileList) {
    if (!fileList || fileList.length === 0) return;
    uploadQueue.style.display = 'block';

    Array.from(fileList).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      uploadSingleFile(file);
    });
  }

  function uploadSingleFile(file) {
    const queueItem = document.createElement('div');
    queueItem.className = 'queue-item';

    const thumb = document.createElement('img');
    thumb.className = 'queue-item__thumb';
    thumb.src = URL.createObjectURL(file);

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
  // Event Listeners for inputs
  // -------------------------------------------------------------------------
  multiFileInput.addEventListener('change', function () {
    handleFilesSelected(multiFileInput.files);
    multiFileInput.value = '';
  });

  cameraDirectInput.addEventListener('change', function () {
    handleFilesSelected(cameraDirectInput.files);
    cameraDirectInput.value = '';
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
