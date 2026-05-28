const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Message = require('../models/Message');
const User = require('../models/User');
const wa = require('../utils/whatsappClient');
const { protect } = require('../middleware/auth');

const uploadDir = path.join(process.cwd(), 'uploads', 'voice');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = file.mimetype.includes('ogg') ? '.ogg' : file.mimetype.includes('mp4') ? '.mp4' : '.webm';
    cb(null, `voice_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

router.use(protect);

// GET /api/messages?with=userId  — conversation thread or full inbox
router.get('/', async (req, res) => {
  try {
    const { with: withUser } = req.query;
    const filter = withUser
      ? { $or: [{ from: req.user._id, to: withUser }, { from: withUser, to: req.user._id }] }
      : { $or: [{ from: req.user._id }, { to: req.user._id }] };

    const messages = await Message.find(filter)
      .populate('from', 'name avatar role')
      .populate('to', 'name avatar role')
      .sort({ createdAt: 1 })
      .limit(200);

    if (withUser) {
      await Message.updateMany({ from: withUser, to: req.user._id, isRead: false }, { isRead: true });
    }

    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/messages/unread-count
router.get('/unread-count', async (req, res) => {
  try {
    const count = await Message.countDocuments({ to: req.user._id, isRead: false });
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/messages/send — text message
router.post('/send', async (req, res) => {
  try {
    const { toUserId, content } = req.body;
    if (!toUserId || !content?.trim()) return res.status(400).json({ success: false, message: 'Recipient and content required' });

    const toUser = await User.findById(toUserId);
    if (!toUser) return res.status(404).json({ success: false, message: 'User not found' });

    const msg = await Message.create({ from: req.user._id, to: toUserId, type: 'text', content: content.trim() });

    let whatsappSent = false;
    if (wa.isReady() && toUser.phone) {
      try {
        await wa.sendText(toUser.phone, `📩 *Message from ${req.user.name}:*\n\n${content.trim()}`);
        whatsappSent = true;
        await Message.findByIdAndUpdate(msg._id, { whatsappSent: true });
      } catch { /* fail silently */ }
    }

    await msg.populate('from to', 'name avatar role');
    res.status(201).json({ success: true, message: msg, whatsappSent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/messages/send-voice — voice note upload
router.post('/send-voice', upload.single('audio'), async (req, res) => {
  try {
    const { toUserId } = req.body;
    if (!toUserId || !req.file) return res.status(400).json({ success: false, message: 'Recipient and audio required' });

    const toUser = await User.findById(toUserId);
    if (!toUser) return res.status(404).json({ success: false, message: 'User not found' });

    const audioUrl = `/uploads/voice/${req.file.filename}`;
    const msg = await Message.create({ from: req.user._id, to: toUserId, type: 'voice', audioUrl });

    let whatsappSent = false;
    if (wa.isReady() && toUser.phone) {
      try {
        await wa.sendAudio(toUser.phone, req.file.path);
        whatsappSent = true;
        await Message.findByIdAndUpdate(msg._id, { whatsappSent: true });
      } catch { /* fail silently */ }
    }

    await msg.populate('from to', 'name avatar role');
    res.status(201).json({ success: true, message: msg, whatsappSent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
