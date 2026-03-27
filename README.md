# Trip5

iOS app for booking rides between Irbid and Amman, Jordan.

## GitHub & Cursor on Mac

1. **Create a repository** on GitHub (e.g. `trip5`). Do **not** upload `.env` files; they stay local.
2. **On this PC**, from the repo folder:
   ```bash
   git add -A
   git commit -m "Sync Trip5 monorepo"
   git remote set-url origin https://github.com/BrightMindsTech/trip5.git
   git push -u origin main
   ```
   If you still use `BrightMindsTech/trip5-backend` and want the **full** app there, you can keep that remote URL—just know the repo name may say “backend” while it holds everything.
3. **On your Mac**: install [Cursor](https://cursor.com), then **File → Open Folder** and clone:
   ```bash
   git clone https://github.com/BrightMindsTech/trip5.git
   cd YOUR_REPO
   ```
4. **Env files** (copy examples, then fill in real keys—never commit `.env`):
   ```bash
   cp trip5-expo/.env.example trip5-expo/.env
   cp backend/.env.example backend/.env
   ```
5. **Expo app**:
   ```bash
   cd trip5-expo && npm install && npm start
   ```
6. **Backend** (local): `cd backend && npm install && npm start` — or deploy and set `EXPO_PUBLIC_API_BASE_URL` in `trip5-expo/.env`.

---

## Two Projects

| Project | Purpose |
|---------|---------|
| **Trip5/** (SwiftUI) | Native iOS app – build with Xcode, run on simulator/device |
| **trip5-expo/** | Expo/React Native app – run in **Expo Go** on your iPhone for quick testing |

Both use the same backend and have the same features.

---

## SwiftUI App (Trip5/)

### 1. Open Project (on Mac)

1. Open `Trip5.xcodeproj` in Xcode
2. Select the Trip5 target → Signing & Capabilities → choose your Team
3. Build and run (Cmd+R)

### 2. Backend Setup

1. Deploy the backend (e.g. to Render: Web Service, Root Directory `backend`, Start `npm start`). See `backend/README.md`.
2. In the host’s dashboard (Render/Vercel), add WhatsApp env vars: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_RECIPIENT_PHONE`.
3. Update `Config.apiBaseURL` in `Trip5/Models/Config.swift` with your backend URL (e.g. `https://trip5-backend.onrender.com`).

### 3. Update API URL

After deploying the backend, set `Config.apiBaseURL` in `Trip5/Models/Config.swift` to your backend URL.

## Expo App (trip5-expo/) – Test on Expo Go

```bash
cd trip5-expo
npm start
```

Then scan the QR code with your iPhone (Expo Go app). See [trip5-expo/README.md](trip5-expo/README.md) for details.

---

## Project Structure

```
trip5/
├── Trip5/                    # SwiftUI iOS app
│   ├── Trip5App.swift
│   ├── Models/
│   ├── Views/
│   ├── ViewModels/
│   ├── Services/
│   ├── Localization/
│   ├── en.lproj/
│   ├── ar.lproj/
│   └── Info.plist
├── trip5-expo/               # Expo app (Expo Go)
├── backend/                  # Node API (Render / Vercel), sends orders via WhatsApp
│   ├── api/orders.js
│   ├── server.js
│   └── package.json
└── README.md
```

## Order recipients

Configured via backend environment variables (e.g. on Render):
- `WHATSAPP_RECIPIENT_PHONE`: main number (e.g. 962771234567)
- `WHATSAPP_RECIPIENT_PHONE_2`: optional second number
