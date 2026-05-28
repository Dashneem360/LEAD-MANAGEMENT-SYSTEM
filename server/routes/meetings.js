const express = require('express');
const router = express.Router();
const Meeting = require('../models/Meeting');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

router.use(protect);

// GET /api/meetings
router.get('/', async (req, res) => {
  try {
    const meetings = await Meeting.find({
      $or: [{ organizer: req.user._id }, { participants: req.user._id }]
    })
      .populate('organizer', 'name avatar')
      .populate('participants', 'name avatar')
      .sort({ scheduledAt: -1 });
    res.json({ success: true, meetings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/meetings
router.post('/', async (req, res) => {
  try {
    const participantIds = Array.isArray(req.body.participants) ? req.body.participants : [];
    const participants = await User.find({ _id: { $in: participantIds }, isActive: true }).select('_id');
    const activeParticipantIds = participants.map((participant) => participant._id);

    const meeting = await Meeting.create({
      ...req.body,
      participants: activeParticipantIds,
      organizer: req.user._id
    });

    const scheduledAt = new Date(meeting.scheduledAt).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata'
    });
    const meetingText = [
      `Meeting scheduled: ${meeting.title}`,
      `Date: ${scheduledAt}`,
      `Duration: ${meeting.duration} minutes`,
      meeting.meetingLink ? `Link: ${meeting.meetingLink}` : 'Link: To be shared',
      meeting.notes ? `Notes: ${meeting.notes}` : ''
    ].filter(Boolean).join('\n');

    await Promise.all(activeParticipantIds.map((participantId) => Promise.all([
      Notification.create({
        user: participantId,
        type: 'system',
        title: 'Meeting Scheduled',
        message: `${req.user.name} scheduled "${meeting.title}" for ${scheduledAt}`
      }),
      Message.create({
        from: req.user._id,
        to: participantId,
        type: 'text',
        content: meetingText
      })
    ])));

    await meeting.populate('organizer participants', 'name avatar');
    res.status(201).json({ success: true, meeting });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/meetings/:id
router.put('/:id', async (req, res) => {
  try {
    const meeting = await Meeting.findOneAndUpdate(
      { _id: req.params.id, organizer: req.user._id },
      req.body, { new: true }
    ).populate('organizer participants', 'name avatar');
    if (!meeting) return res.status(404).json({ success: false, message: 'Meeting not found' });
    res.json({ success: true, meeting });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/meetings/:id
router.delete('/:id', async (req, res) => {
  try {
    await Meeting.findOneAndDelete({ _id: req.params.id, organizer: req.user._id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
