# 📸 Realtime Event Photo Sharing System

Upload event photos in real time to Google Drive and display them live to guests via a QR-code-powered web page — no app install needed.

---

## How It Works

1. **Photographer** opens `upload.html` on their phone and captures a photo.
2. The photo is uploaded to the backend, which stores it in a **Google Drive** folder.
3. The backend pushes a **Socket.IO** event to all connected guests.
4. **Guests** scan a printed QR code, land on `guest.html`, and see photos appear live — no refresh required.

---

## Setup Instructions

### 1. Create a Google Cloud Project & Service Account

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or select an existing one).
3. Navigate to **APIs & Services → Library**, search for **Google Drive API**, and **enable** it.
4. Go to **APIs & Services → Credentials → Create Credentials → Service Account**.
5. Give the service account a name (e.g. `photo-uploader`), click **Done**.
6. Click on the newly created service account → **Keys** tab → **Add Key → Create new key → JSON**.
7. Download the JSON key file and save it in the project root as `service-account-key.json`.

### 2. Share the Drive Folder with the Service Account

> ⚠️ **This is a common failure point — do not skip this step.**

1. Open **Google Drive** in your browser.
2. Create a folder for the event (e.g. `Wedding Photos`).
3. Right-click the folder → **Share**.
4. Paste the service account's email address (it looks like `name@project-id.iam.gserviceaccount.com` — you can find it in the JSON key file under `client_email`).
5. Set the permission to **Editor** and click **Send**.

### 3. Get the Drive Folder ID

Open the folder in Google Drive. The URL will look like:

```
https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ
```

The folder ID is the part after `/folders/` — in this example: `1aBcDeFgHiJkLmNoPqRsTuVwXyZ`.

### 4. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and fill in:

| Variable | Value |
|---|---|
| `PORT` | `3000` (or any free port) |
| `GOOGLE_DRIVE_FOLDER_ID` | Your folder ID from step 3 |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | `./service-account-key.json` |
| `PUBLIC_APP_URL` | `http://localhost:3000` (or your ngrok / deployed URL) |

### 5. Install Dependencies

```bash
npm install
```

### 6. Generate the QR Code

```bash
npm run generate-qr
```

This creates `qr-code.png` in the project root — print it for your event!

### 7. Start the Server

```bash
npm start
```

You'll see:

```
═══════════════════════════════════════════════════
  📸  Realtime Photo Sharing Server is LIVE
═══════════════════════════════════════════════════
  🌐  Local:        http://localhost:3000
  📷  Upload page:  http://localhost:3000/upload.html
  👀  Guest page:   http://localhost:3000/guest.html
═══════════════════════════════════════════════════
```

---

## Exposing to the Internet (for real events)

Guests' phones need to reach the server over the internet. Use [ngrok](https://ngrok.com/) for quick tunneling:

```bash
npx ngrok http 3000
```

Copy the generated `https://xxxx.ngrok-free.app` URL, update `PUBLIC_APP_URL` in `.env`, and re-run `npm run generate-qr` to get a QR code with the public URL.

---

## Project Structure

```
realtime-photo-sharing/
├── package.json
├── .env.example
├── .gitignore
├── server.js              # Express + Socket.IO server
├── config/
│   └── googleDrive.js     # Drive API auth, upload, and list helpers
├── routes/
│   └── upload.js          # POST /api/upload route
├── public/
│   ├── guest.html         # Guest live photo viewer
│   ├── guest.js           # Guest-side Socket.IO client
│   ├── upload.html        # Photographer upload page
│   ├── upload.js          # Photographer-side upload logic
│   └── style.css          # Shared styles
├── scripts/
│   └── generateQR.js      # QR code generator script
└── README.md
```

---

## License

MIT
