const dotenv = require('dotenv');
dotenv.config(); // must run before any model/sequelize imports

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const connectDB = require('./config/db.config');
const { syncGoogleSheet } = require('./utils/googleSheets');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const clientDistPath = path.resolve(__dirname, '../client/dist');
const hasClientBuild = fs.existsSync(path.join(clientDistPath, 'index.html'));
const allowedOrigins = [process.env.CLIENT_URL].filter(Boolean);

// Middleware
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (!isProduction || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return cb(null, true);
    }
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded voice notes
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/followups', require('./routes/followups'));
app.use('/api/users', require('./routes/users'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/sheets', require('./routes/sheets'));
app.use('/api/webinars', require('./routes/webinars'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/meetings', require('./routes/meetings'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Lead Management API is running' });
});

// Auto-sync Google Sheet every N minutes
const hasGoogleSheetConfig = Boolean(
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
  process.env.GOOGLE_PRIVATE_KEY &&
  process.env.GOOGLE_SHEET_ID
);

if (hasGoogleSheetConfig) {
  const syncInterval = process.env.SHEET_SYNC_INTERVAL || 5;
  cron.schedule(`*/${syncInterval} * * * *`, async () => {
    console.log(`[CRON] Auto-syncing Google Sheet at ${new Date().toLocaleString()}`);
    try {
      await syncGoogleSheet();
      console.log('[CRON] Sheet sync completed');
    } catch (err) {
      console.error('[CRON] Sheet sync failed:', err.message);
    }
  });
} else {
  console.log('Google Sheets sync disabled: missing GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, or GOOGLE_SHEET_ID');
}

if (hasClientBuild) {
  app.use(express.static(clientDistPath));
  app.get(/^\/(?!api|uploads).*/, (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    if (hasClientBuild) {
      console.log(`Serving client build from ${clientDistPath}`);
    }
  });
});
