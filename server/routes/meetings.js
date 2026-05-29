const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Meeting, Message, Notification, User, MeetingParticipant } = require('../models');
const { protect } = require('../middleware/auth');

const MEETING_INCLUDE = [
  { model: User, as: 'organizer', attributes: ['id', 'name', 'avatar'] },
  { model: User, as: 'participants', attributes: ['id', 'name', 'avatar'] }
];

router.use(protect);

// GET /api/meetings
router.get('/', async (req, res) => {
  try {
    const orgIds = await Meeting.findAll({ where: { organizerId: req.user.id }, attributes: ['id'], raw: true }).then(r => r.map(m => m.id));
    const partIds = await MeetingParticipant.findAll({ where: { userId: req.user.id }, attributes: ['meetingId'], raw: true }).then(r => r.map(m => m.meetingId));
    const allIds = [...new Set([...orgIds, ...partIds])];

    const meetings = await Meeting.findAll({
      where: { id: { [Op.in]: allIds.length ? allIds : ['00000000-0000-0000-0000-000000000000'] } },
      include: MEETING_INCLUDE,
      order: [['scheduledAt', 'DESC']]
    });
    res.json({ success: true, meetings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/meetings
router.post('/', async (req, res) => {
  try {
    const participantIds = Array.isArray(req.body.participants) ? req.body.participants : [];
    const activeUsers = await User.findAll({ where: { id: { [Op.in]: participantIds }, isActive: true }, attributes: ['id'] });
    const activeIds = activeUsers.map(u => u.id);

    const { participants, ...meetingData } = req.body;
    const meeting = await Meeting.create({ ...meetingData, organizerId: req.user.id });
    if (activeIds.length) {
      await MeetingParticipant.bulkCreate(activeIds.map(uid => ({ meetingId: meeting.id, userId: uid })), { ignoreDuplicates: true });
    }

    const scheduledAt = new Date(meeting.scheduledAt).toLocaleString('en-IN', {
      dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata'
    });
    const meetingText = [
      `Meeting scheduled: ${meeting.title}`,
      `Date: ${scheduledAt}`,
      `Duration: ${meeting.duration} minutes`,
      meeting.meetingLink ? `Link: ${meeting.meetingLink}` : 'Link: To be shared',
      meeting.notes ? `Notes: ${meeting.notes}` : ''
    ].filter(Boolean).join('\n');

    await Promise.all(activeIds.map(uid => Promise.all([
      Notification.create({
        userId: uid,
        type: 'system',
        title: 'Meeting Scheduled',
        message: `${req.user.name} scheduled "${meeting.title}" for ${scheduledAt}`
      }),
      Message.create({ fromId: req.user.id, toId: uid, type: 'text', content: meetingText })
    ])));

    const populated = await Meeting.findByPk(meeting.id, { include: MEETING_INCLUDE });
    res.status(201).json({ success: true, meeting: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/meetings/:id
router.put('/:id', async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ where: { id: req.params.id, organizerId: req.user.id } });
    if (!meeting) return res.status(404).json({ success: false, message: 'Meeting not found' });
    const { participants, ...updateData } = req.body;
    await meeting.update(updateData);
    const updated = await Meeting.findByPk(meeting.id, { include: MEETING_INCLUDE });
    res.json({ success: true, meeting: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/meetings/:id
router.delete('/:id', async (req, res) => {
  try {
    await MeetingParticipant.destroy({ where: { meetingId: req.params.id } });
    await Meeting.destroy({ where: { id: req.params.id, organizerId: req.user.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
