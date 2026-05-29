const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { protect, adminOnly } = require('../middleware/auth');
const { Group, GroupMessage, GroupMember, GroupMessageRead, User } = require('../models');

const GROUP_INCLUDE = [
  { model: User, as: 'members', attributes: ['id', 'name', 'email', 'avatar'] },
  { model: User, as: 'createdBy', attributes: ['id', 'name'] }
];

router.use(protect);

// GET /api/groups
router.get('/', async (req, res) => {
  try {
    const memberRows = await GroupMember.findAll({ where: { userId: req.user.id }, attributes: ['groupId'], raw: true });
    const groupIds = memberRows.map(r => r.groupId);

    const groups = await Group.findAll({
      where: { id: { [Op.in]: groupIds.length ? groupIds : ['00000000-0000-0000-0000-000000000000'] } },
      include: GROUP_INCLUDE,
      order: [['lastMessageAt', 'DESC NULLS LAST'], ['createdAt', 'DESC']]
    });
    res.json({ success: true, groups });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/groups (admin only)
router.post('/', adminOnly, async (req, res) => {
  try {
    const { name, memberIds } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Group name is required' });
    const members = [...new Set([...(memberIds || []), String(req.user.id)])];

    const group = await Group.create({ name: name.trim(), createdById: req.user.id });
    await GroupMember.bulkCreate(members.map(uid => ({ groupId: group.id, userId: uid })), { ignoreDuplicates: true });

    const populated = await Group.findByPk(group.id, { include: GROUP_INCLUDE });
    res.status(201).json({ success: true, group: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/groups/:id (admin only)
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    const group = await Group.findByPk(req.params.id);
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    if (group.createdById !== req.user.id)
      return res.status(403).json({ success: false, message: 'Only creator can delete this group' });

    const messages = await GroupMessage.findAll({ where: { groupId: group.id }, attributes: ['id'], raw: true });
    const msgIds = messages.map(m => m.id);
    if (msgIds.length) await GroupMessageRead.destroy({ where: { messageId: { [Op.in]: msgIds } } });
    await GroupMessage.destroy({ where: { groupId: group.id } });
    await GroupMember.destroy({ where: { groupId: group.id } });
    await group.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/groups/:id/messages
router.get('/:id/messages', async (req, res) => {
  try {
    const group = await Group.findByPk(req.params.id, { include: [{ model: User, as: 'members', attributes: ['id'] }] });
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    const isMember = group.members.some(m => m.id === req.user.id);
    if (!isMember) return res.status(403).json({ success: false, message: 'Not a member of this group' });

    const messages = await GroupMessage.findAll({
      where: { groupId: req.params.id },
      include: [{ model: User, as: 'from', attributes: ['id', 'name', 'avatar'] }],
      order: [['createdAt', 'ASC']],
      limit: 200
    });

    // Mark unread messages as read
    const allIds = messages.map(m => m.id);
    if (allIds.length) {
      const alreadyRead = await GroupMessageRead.findAll({
        where: { messageId: { [Op.in]: allIds }, userId: req.user.id },
        attributes: ['messageId'], raw: true
      });
      const readSet = new Set(alreadyRead.map(r => r.messageId));
      const unreadIds = allIds.filter(id => !readSet.has(id));
      if (unreadIds.length) {
        await GroupMessageRead.bulkCreate(
          unreadIds.map(messageId => ({ messageId, userId: req.user.id })),
          { ignoreDuplicates: true }
        );
      }
    }

    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/groups/:id/messages
router.post('/:id/messages', async (req, res) => {
  try {
    const group = await Group.findByPk(req.params.id, { include: [{ model: User, as: 'members', attributes: ['id'] }] });
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    const isMember = group.members.some(m => m.id === req.user.id);
    if (!isMember) return res.status(403).json({ success: false, message: 'Not a member of this group' });

    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ success: false, message: 'Message content required' });

    const gm = await GroupMessage.create({
      groupId: group.id,
      fromId: req.user.id,
      content: content.trim()
    });
    await GroupMessageRead.create({ messageId: gm.id, userId: req.user.id });
    await group.update({ lastMessage: content.trim().slice(0, 80), lastMessageAt: new Date() });

    const message = await GroupMessage.findByPk(gm.id, {
      include: [{ model: User, as: 'from', attributes: ['id', 'name', 'avatar'] }]
    });
    res.status(201).json({ success: true, message });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
