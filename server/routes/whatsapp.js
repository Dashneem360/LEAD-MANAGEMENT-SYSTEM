const express = require('express');
const router = express.Router();
const wa = require('../utils/whatsappClient');
const { protect, managerOrAdmin } = require('../middleware/auth');

router.use(protect);

router.get('/status', (req, res) => {
  const info = wa.getStatus();
  res.json({ success: true, ...info });
});

router.post('/init', managerOrAdmin, async (req, res) => {
  try {
    await wa.init();
    res.json({ success: true, message: 'WhatsApp initializing — scan the QR code' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/disconnect', managerOrAdmin, async (req, res) => {
  try {
    await wa.disconnect();
    res.json({ success: true, message: 'Disconnected' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/send', async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) return res.status(400).json({ success: false, message: 'Phone and message required' });
    await wa.sendText(phone, message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/send-bulk', managerOrAdmin, async (req, res) => {
  try {
    const { phones, message } = req.body;
    if (!phones?.length || !message) return res.status(400).json({ success: false, message: 'Phones array and message required' });
    let sent = 0, failed = 0;
    for (const phone of phones) {
      try {
        await wa.sendText(phone, message);
        sent++;
        await new Promise(r => setTimeout(r, 1200));
      } catch { failed++; }
    }
    res.json({ success: true, sent, failed });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
