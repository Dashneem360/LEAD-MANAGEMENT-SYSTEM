const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { Message, User } = require('../models');
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

const USER_ATTRS = ['id', 'name', 'avatar', 'role'];
const MSG_INCLUDE = [
  { model: User, as: 'from', attributes: USER_ATTRS },
  { model: User, as: 'to', attributes: USER_ATTRS }
];

router.use(protect);

// GET /api/messages?with=userId
router.get('/', async (req, res) => {
  try {
    const { with: withUser } = req.query;
    const where = withUser
      ? { [Op.or]: [{ fromId: req.user.id, toId: withUser }, { fromId: withUser, toId: req.user.id }] }
      : { [Op.or]: [{ fromId: req.user.id }, { toId: req.user.id }] };

    const messages = await Message.findAll({
      where, include: MSG_INCLUDE,
      order: [['createdAt', 'ASC']],
      limit: 200
    });

    if (withUser) {
      await Message.update({ isRead: true }, { where: { fromId: withUser, toId: req.user.id, isRead: false } });
    }

    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/messages/unread-count
router.get('/unread-count', async (req, res) => {
  try {
    const count = await Message.count({ where: { toId: req.user.id, isRead: false } });
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/messages/send
router.post('/send', async (req, res) => {
  try {
    const { toUserId, content } = req.body;
    if (!toUserId || !content?.trim()) return res.status(400).json({ success: false, message: 'Recipient and content required' });

    const toUser = await User.findByPk(toUserId);
    if (!toUser) return res.status(404).json({ success: false, message: 'User not found' });

    const msg = await Message.create({ fromId: req.user.id, toId: toUserId, type: 'text', content: content.trim() });

    let whatsappSent = false;
    if (wa.isReady() && toUser.phone) {
      try {
        await wa.sendText(toUser.phone, `📩 *Message from ${req.user.name}:*\n\n${content.trim()}`);
        whatsappSent = true;
        await msg.update({ whatsappSent: true });
      } catch { /* fail silently */ }
    }

    const populated = await Message.findByPk(msg.id, { include: MSG_INCLUDE });
    res.status(201).json({ success: true, message: populated, whatsappSent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/messages/send-voice
router.post('/send-voice', upload.single('audio'), async (req, res) => {
  try {
    const { toUserId } = req.body;
    if (!toUserId || !req.file) return res.status(400).json({ success: false, message: 'Recipient and audio required' });

    const toUser = await User.findByPk(toUserId);
    if (!toUser) return res.status(404).json({ success: false, message: 'User not found' });

    const audioUrl = `/uploads/voice/${req.file.filename}`;
    const msg = await Message.create({ fromId: req.user.id, toId: toUserId, type: 'voice', audioUrl });

    let whatsappSent = false;
    if (wa.isReady() && toUser.phone) {
      try {
        await wa.sendAudio(toUser.phone, req.file.path);
        whatsappSent = true;
        await msg.update({ whatsappSent: true });
      } catch { /* fail silently */ }
    }

    const populated = await Message.findByPk(msg.id, { include: MSG_INCLUDE });
    res.status(201).json({ success: true, message: populated, whatsappSent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
