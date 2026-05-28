# LeadPro — MERN Lead Management System

A full-stack Lead Management System built with MongoDB, Express, React, and Node.js.

## Features

- **Dashboard** — Live stats, growth charts, today's followups, missed alerts, team performance
- **Lead Management** — Full CRUD, filters, pagination, status tracking, priority
- **Google Sheets Import** — Auto-sync leads from Google Sheets every 5 minutes
- **Followup System** — Daily followup list, missed alerts, reschedule, complete with outcome
- **Today's Calling List** — Quick-call UI with one-click outcome marking
- **Team Management** — 5-member team support, assign leads, track performance & earnings
- **Webinar Tracking** — Create webinars, mark attendance (seen/not seen) with green indicator
- **Notifications** — Missed followup alerts, lead assignment alerts, real-time bell icon
- **Role-Based Access** — Admin / Manager / Member roles

## Tech Stack

- **Backend**: Node.js, Express.js, MongoDB (Mongoose), JWT Auth, node-cron
- **Frontend**: React 18, Vite, React Router v6, Chart.js, React Hot Toast
- **Integration**: Google Sheets API (googleapis)

## Setup

### 1. Install Dependencies

```bash
# Root
npm install

# Server
cd server
npm install

# Client
cd ../client
npm install
```

### 2. Configure Environment

Edit `server/.env`:
```
PORT=5000
MONGO_URI=mongodb://localhost:27017/lead_management
JWT_SECRET=your_secret_key
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-sa@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GOOGLE_SHEET_ID=your_sheet_id
USE_IN_MEMORY_DB=true
SEED_DEMO_DATA=true
```

### 3. Google Sheets Setup

1. Go to Google Cloud Console → Create a Service Account
2. Download JSON key → copy email and private_key to `.env`
3. Share your Google Sheet with the service account email (Viewer access)
4. Copy the Sheet ID from the URL

### 4. Run

```bash
# Terminal 1 — Backend
cd server
npm run dev

# Terminal 2 — Frontend
cd client
npm run dev
```

Open: **http://localhost:5173**

## Production / Live Deployment

The app can now run as a single production service:

```bash
npm install --prefix server
npm install --prefix client
npm run build --prefix client
npm start --prefix server
```

That starts Express and serves both the API and the built React app from one process.

### Required production environment

```env
PORT=5000
NODE_ENV=production
MONGO_URI=mongodb+srv://...
JWT_SECRET=replace_this_with_a_strong_secret
CLIENT_URL=https://your-live-domain.example
USE_IN_MEMORY_DB=false
SEED_DEMO_DATA=false
```

Notes:
- `MONGO_URI` is required in production.
- Demo seed data is skipped in production unless `SEED_DEMO_DATA=true`.
- Google Sheets sync stays disabled until all three Google env vars are set.
- A sample `render.yaml` is included for Render deployment.

### 5. Create First Admin User

Call the API:
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@company.com","password":"admin123","role":"admin"}'
```

## Project Structure

```
LEAD MANAGEMENT SYSTEM/
├── server/
│   ├── config/db.js
│   ├── models/         User, Lead, Followup, Webinar, Notification
│   ├── controllers/    authController, leadController, followupController, dashboardController, webinarController
│   ├── routes/         auth, leads, followups, users, dashboard, webinars, sheets
│   ├── middleware/     auth.js (JWT protect, role guards)
│   ├── utils/          googleSheets.js
│   └── server.js
└── client/
    └── src/
        ├── context/    AuthContext
        ├── services/   api.js (Axios)
        ├── pages/      Dashboard, Leads, Followups, CallingList, Team, Webinars, Login
        ├── components/ Layout, Sidebar, Header
        └── index.css   Full design system
```

## Google Sheets Column Format

Expected columns (flexible naming):
| Name | Phone | Email | City | State | Product | Notes |
|------|-------|-------|------|-------|---------|-------|
| John | 9876543210 | john@email.com | Mumbai | Maharashtra | Course A | Hot lead |

## Lead Statuses
`new → contacted → interested → nurturing → converted` or `not_interested / lost`

## Webinar Statuses
`not_invited → invited → registered → attended / missed`
