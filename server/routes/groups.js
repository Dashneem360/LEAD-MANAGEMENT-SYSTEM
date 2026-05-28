const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const Group = require('../models/Group');
const GroupMessage = require('../models/GroupMessage');

router.use(protect);

// GET /api/groups — list groups the current user belongs to
router.get('/', async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id })
      .populate('members', 'name email avatar')
      .populate('createdBy', 'name')
      .sort({ lastMessageAt: -1, createdAt: -1 });
    res.json({ success: true, groups });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/groups — create a group (admin only)
router.post('/', adminOnly, async (req, res) => {
  try {
    const { name, memberIds } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Group name is required' });
    const members = [...new Set([...(memberIds || []), String(req.user._id)])];
    const group = await Group.create({ name: name.trim(), members, createdBy: req.user._id });
    await group.populate('members', 'name email avatar');
    await group.populate('createdBy', 'name');
    res.status(201).json({ success: true, group });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/groups/:id — delete group (admin/creator only)
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    if (String(group.createdBy) !== String(req.user._id))
      return res.status(403).json({ success: false, message: 'Only creator can delete this group' });
    await GroupMessage.deleteMany({ group: group._id });
    await group.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/groups/:id/messages — get messages for a group
router.get('/:id/messages', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    const isMember = group.members.some(m => String(m) === String(req.user._id));
    if (!isMember) return res.status(403).json({ success: false, message: 'Not a member of this group' });

    const messages = await GroupMessage.find({ group: req.params.id })
      .populate('from', 'name avatar')
      .sort({ createdAt: 1 })
      .limit(200);

    // Mark all unread messages as read by this user
    await GroupMessage.updateMany(
      { group: req.params.id, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );

    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/groups/:id/messages — send a message to a group
router.post('/:id/messages', async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    const isMember = group.members.some(m => String(m) === String(req.user._id));
    if (!isMember) return res.status(403).json({ success: false, message: 'Not a member of this group' });

    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ success: false, message: 'Message content required' });

    const message = await GroupMessage.create({
      group: group._id,
      from: req.user._id,
      content: content.trim(),
      readBy: [req.user._id]
    });
    await message.populate('from', 'name avatar');

    // Update group's last message preview
    await Group.findByIdAndUpdate(group._id, {
      lastMessage: content.trim().slice(0, 80),
      lastMessageAt: new Date()
    });

    res.status(201).json({ success: true, message });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
