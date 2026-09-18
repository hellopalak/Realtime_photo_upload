(function () {
  'use strict';

  // Elements
  const emptyRadar = document.getElementById('emptyRadar');
  const spotlightFrame = document.getElementById('spotlightFrame');
  const spotlightTime = document.getElementById('spotlightTime');
  const spotlightFileName = document.getElementById('spotlightFileName');
  const spotlightFooter = document.getElementById('spotlightFooter');
  const spotlightDownloadBtn = document.getElementById('spotlightDownloadBtn');
  const spotlightExpandBtn = document.getElementById('spotlightExpandBtn');

  const galleryGrid = document.getElementById('galleryGrid');
  const momentsCountBadge = document.getElementById('momentsCountBadge');
  const guestCounter = document.getElementById('guestCounter');
  const liveStatusPill = document.getElementById('liveStatusPill');

  const newPhotoToast = document.getElementById('newPhotoToast');
  const toastThumb = document.getElementById('toastThumb');

  const qrModal = document.getElementById('qrModal');
  const openQrModalBtn = document.getElementById('openQrModalBtn');
  const closeQrModalBtn = document.getElementById('closeQrModalBtn');
  const copyShareLinkBtn = document.getElementById('copyShareLinkBtn');
  const modalQrImg = document.getElementById('modalQrImg');

  const lightboxModal = document.getElementById('lightboxModal');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxDownloadBtn = document.getElementById('lightboxDownloadBtn');
  const closeLightboxBtn = document.getElementById('closeLightboxBtn');
  const fullscreenToggleBtn = document.getElementById('fullscreenToggleBtn');

  let allPhotos = [];
  let toastTimeout = null;

  // -------------------------------------------------------------------------
  // Synthesized Minecraft Item "Pop" / "Orb" sound (Web Audio API)
  // -------------------------------------------------------------------------
  function playMinecraftPop() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Pitch sweep mimicking Minecraft item pickup pop
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(1100, now + 0.08);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {
      // Autoplay or restricted audio context ignored
    }
  }

  // -------------------------------------------------------------------------
  // Date Formatter Helper
  // -------------------------------------------------------------------------
  function formatTime(isoString) {
    if (!isoString) return 'Just now';
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  // -------------------------------------------------------------------------
  // Spotlight updater
  // -------------------------------------------------------------------------
  function updateSpotlight(photo) {
    if (!photo || !photo.url) return;

    emptyRadar.style.display = 'none';
    spotlightFrame.style.display = 'flex';
    spotlightFooter.style.display = 'flex';

    const isVideo = photo.mimeType && photo.mimeType.startsWith('video/');

    // Clear previous media
    spotlightFrame.innerHTML = '';

    if (isVideo) {
      const video = document.createElement('video');
      video.id = 'spotlightVideo';
      video.className = 'spotlight__img';
      video.src = photo.url;
      video.controls = true;
      video.autoplay = true;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.classList.add('fade-enter');
      spotlightFrame.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.id = 'spotlightImg';
      img.className = 'spotlight__img';
      img.src = photo.url;
      img.alt = 'Latest Event Moment';
      img.classList.add('fade-enter');
      spotlightFrame.appendChild(img);
    }

    spotlightTime.textContent = '⏰ ' + formatTime(photo.timestamp);
    spotlightFileName.textContent = photo.originalName || photo.filename || 'item_photo.png';
    spotlightDownloadBtn.href = photo.url;
    spotlightDownloadBtn.setAttribute('download', photo.originalName || 'event-photo.jpg');

    spotlightExpandBtn.onclick = function () {
      openLightbox(photo.url, isVideo);
    };
  }

  // -------------------------------------------------------------------------
  // Render Gallery Grid
  // -------------------------------------------------------------------------
  function renderGallery(photos) {
    galleryGrid.innerHTML = '';
    momentsCountBadge.textContent = photos.length;

    photos.forEach((photo) => {
      const card = createGalleryCard(photo);
      galleryGrid.appendChild(card);
    });
  }

  function createGalleryCard(photo) {
    const card = document.createElement('div');
    card.className = 'gallery-card';
    card.id = `card_${photo.id}`;

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
      img.alt = photo.originalName || 'Event moment';
      img.loading = 'lazy';
      card.appendChild(img);
    }

    const overlay = document.createElement('div');
    overlay.className = 'gallery-card__overlay';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'gallery-card__time';
    timeSpan.textContent = formatTime(photo.timestamp);

    overlay.appendChild(timeSpan);
    card.appendChild(overlay);

    card.addEventListener('click', function () {
      openLightbox(photo.url, isVideo);
    });

    return card;
  }

  // -------------------------------------------------------------------------
  // Add new photo dynamically
  // -------------------------------------------------------------------------
  function handleNewPhoto(photo) {
    if (!photo || !photo.url) return;

    if (allPhotos.some((p) => p.id === photo.id)) return;

    allPhotos.unshift(photo);
    momentsCountBadge.textContent = allPhotos.length;

    updateSpotlight(photo);

    const card = createGalleryCard(photo);
    galleryGrid.insertBefore(card, galleryGrid.firstChild);

    playMinecraftPop();
    showToast(photo);
  }

  function showToast(photo) {
    const isVideo = photo.mimeType && photo.mimeType.startsWith('video/');
    if (isVideo) {
      // Replace the img thumb with a placeholder for videos
      toastThumb.src = '';
      toastThumb.alt = '🎥 Video';
      toastThumb.style.background = 'linear-gradient(135deg, #6c5ce7, #a855f7)';
    } else {
      toastThumb.src = photo.url;
      toastThumb.style.background = '';
    }
    newPhotoToast.querySelector('.new-photo-toast__title').textContent =
      isVideo ? '<Photographer> New video dropped!' : '<Photographer> New photo dropped!';
    newPhotoToast.classList.add('show');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(function () {
      newPhotoToast.classList.remove('show');
    }, 4500);

    newPhotoToast.onclick = function () {
      newPhotoToast.classList.remove('show');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  }

  // -------------------------------------------------------------------------
  // Lightbox Modal
  // -------------------------------------------------------------------------
  function openLightbox(url, isVideo) {
    const container = lightboxModal.querySelector('.lightbox__img-container') || lightboxModal;

    // Remove any previous dynamic video
    const oldVideo = lightboxModal.querySelector('.lightbox__video');
    if (oldVideo) oldVideo.remove();

    if (isVideo) {
      lightboxImg.style.display = 'none';
      const video = document.createElement('video');
      video.className = 'lightbox__img lightbox__video';
      video.src = url;
      video.controls = true;
      video.autoplay = true;
      video.loop = true;
      video.playsInline = true;
      video.style.maxWidth = '90vw';
      video.style.maxHeight = '80vh';
      video.style.borderRadius = '8px';
      lightboxImg.parentNode.insertBefore(video, lightboxImg);
    } else {
      lightboxImg.style.display = '';
      lightboxImg.src = url;
    }

    lightboxDownloadBtn.href = url;
    lightboxModal.classList.add('active');
  }

  function closeLightbox() {
    lightboxModal.classList.remove('active');
    const oldVideo = lightboxModal.querySelector('.lightbox__video');
    if (oldVideo) { oldVideo.pause(); oldVideo.remove(); }
    lightboxImg.style.display = '';
  }

  closeLightboxBtn.addEventListener('click', closeLightbox);
  lightboxModal.addEventListener('click', function (e) {
    if (e.target === lightboxModal) closeLightbox();
  });

  // -------------------------------------------------------------------------
  // QR Share Modal
  // -------------------------------------------------------------------------
  openQrModalBtn.addEventListener('click', function () {
    fetch('/api/qr')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.qrDataUrl) {
          modalQrImg.src = data.qrDataUrl;
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

  copyShareLinkBtn.addEventListener('click', function () {
    navigator.clipboard.writeText(window.location.href).then(function () {
      const originalText = copyShareLinkBtn.innerHTML;
      copyShareLinkBtn.innerHTML = '<span>✅</span> COPIED TO CLIPBOARD!';
      setTimeout(function () {
        copyShareLinkBtn.innerHTML = originalText;
      }, 2000);
    });
  });

  // -------------------------------------------------------------------------
  // Fullscreen toggle
  // -------------------------------------------------------------------------
  fullscreenToggleBtn.addEventListener('click', function () {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.warn);
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  });

  // -------------------------------------------------------------------------
  // Fetch initial data
  // -------------------------------------------------------------------------
  fetch('/api/photos?limit=50')
    .then((res) => res.json())
    .then((data) => {
      if (data.success && Array.isArray(data.photos)) {
        allPhotos = data.photos;
        if (allPhotos.length > 0) {
          updateSpotlight(allPhotos[0]);
          renderGallery(allPhotos);
        }
      }
    })
    .catch((err) => {
      console.error('Failed to load photos:', err);
    });

  // -------------------------------------------------------------------------
  // Socket.IO real-time connection
  // -------------------------------------------------------------------------
  const socket = io();

  socket.on('connect', function () {
    console.log('⛏️ Connected to Minecraft Spectator Stream');
    liveStatusPill.innerHTML = '<span class="live-pill__dot"></span> LIVE';
  });

  socket.on('disconnect', function () {
    console.log('⚠️ Reconnecting to realm…');
    liveStatusPill.innerHTML = '<span style="color:var(--mc-redstone);">●</span> RECONNECTING';
  });

  socket.on('guests-count', function (count) {
    if (guestCounter) guestCounter.textContent = count;
  });

  socket.on('new-photo', function (photo) {
    handleNewPhoto(photo);
  });

  socket.on('photo-deleted', function (data) {
    if (!data || !data.id) return;
    allPhotos = allPhotos.filter((p) => p.id !== data.id);
    momentsCountBadge.textContent = allPhotos.length;
    const el = document.getElementById(`card_${data.id}`);
    if (el) el.remove();
    if (allPhotos.length > 0) {
      updateSpotlight(allPhotos[0]);
    } else {
      emptyRadar.style.display = 'flex';
      spotlightFrame.style.display = 'none';
      spotlightFooter.style.display = 'none';
      spotlightTime.textContent = 'Waiting for photographer…';
    }
  });
})();
