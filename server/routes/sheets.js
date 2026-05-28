const express = require('express');
const router = express.Router();
const { syncGoogleSheet, getSheetPreview, importFromRows } = require('../utils/googleSheets');
const { protect, managerOrAdmin } = require('../middleware/auth');

router.use(protect);

// POST /api/sheets/sync - manually trigger sync
router.post('/sync', managerOrAdmin, async (req, res) => {
  try {
    const result = await syncGoogleSheet(req.body.sheetId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/sheets/preview - preview sheet data before import
router.get('/preview', managerOrAdmin, async (req, res) => {
  try {
    const { sheetId } = req.query;
    const data = await getSheetPreview(sheetId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/sheets/upload-csv - import leads from parsed CSV data
router.post('/upload-csv', managerOrAdmin, async (req, res) => {
  try {
    const { headers, rows } = req.body;
    if (!headers || !rows || rows.length === 0)
      return res.status(400).json({ success: false, message: 'No data provided' });
    const result = await importFromRows(headers, rows);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
