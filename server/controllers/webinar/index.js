const Webinar = require('../../models/Webinar');
const Lead = require('../../models/Lead');
const Notification = require('../../models/Notification');
const Message = require('../../models/Message');
const wa = require('../../utils/whatsappClient');
const moment = require('moment');

const notifyCandidates = async (webinar, fromUserId) => {
  const ids = (webinar.candidates || []).map((id) => id.toString());
  if (!ids.length) return;
  const url = webinar.zoomLink || webinar.youtubeLink || webinar.link || 'Link will be shared soon';
  const content = `Webinar: ${webinar.title}\nDate: ${moment(webinar.scheduledAt).format('DD MMM YYYY, hh:mm A')}\nURL: ${url}`;
  await Promise.all(ids.map((to) => Message.create({
    from: fromUserId,
    to,
    type: 'text',
    content
  })));
};

const normalizeLeadIds = (body) => {
  const ids = body.leads || body.leadIds || body.selectedLeads || [];
  return Array.isArray(ids) ? ids.filter(Boolean) : [];
};

const applyLeadInvites = (webinar, leadIds, userId) => {
  if (!leadIds.length) return;
  const existing = new Set((webinar.attendees || []).map((attendee) => attendee.lead?.toString()).filter(Boolean));
  leadIds.forEach((leadId) => {
    if (existing.has(leadId.toString())) return;
    webinar.attendees.push({
      lead: leadId,
      status: 'invited',
      markedBy: userId,
      markedAt: new Date()
    });
    existing.add(leadId.toString());
  });
  webinar.totalInvited = webinar.attendees.length;
};

// GET /api/webinars
exports.getWebinars = async (req, res) => {
  try {
    const webinars = await Webinar.find()
      .populate('createdBy', 'name')
      .populate('candidates', 'name email phone')
      .populate('attendees.lead', 'name phone')
      .populate('attendees.markedBy', 'name')
      .sort({ scheduledAt: -1 });

    // Attach notSeenCount to each webinar
    const attendedLeadIds = new Set();
    const result = await Promise.all(webinars.map(async (w) => {
      const attendedIds = w.attendees.filter(a => a.status === 'attended').map(a => a.lead?._id?.toString());
      const notSeen = await Lead.countDocuments({
        isActive: true,
        _id: { $nin: attendedIds }
      });
      const obj = w.toObject();
      obj.notSeenCount = notSeen;
      return obj;
    }));

    res.json({ success: true, webinars: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/webinars
exports.createWebinar = async (req, res) => {
  try {
    const leadIds = normalizeLeadIds(req.body);
    const webinar = new Webinar({ ...req.body, createdBy: req.user._id });
    applyLeadInvites(webinar, leadIds, req.user._id);
    await webinar.save();
    if (leadIds.length) await Lead.updateMany({ _id: { $in: leadIds } }, { webinarStatus: 'invited' });
    await notifyCandidates(webinar, req.user._id);
    res.status(201).json({ success: true, webinar });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/webinars/:id/mark-attendance
exports.markAttendance = async (req, res) => {
  try {
    const { leadId, status } = req.body;
    const webinar = await Webinar.findById(req.params.id);
    if (!webinar) return res.status(404).json({ success: false, message: 'Webinar not found' });

    const existing = webinar.attendees.find(a => a.lead?.toString() === leadId);
    if (existing) {
      existing.status = status;
      existing.markedBy = req.user._id;
      existing.markedAt = new Date();
    } else {
      webinar.attendees.push({ lead: leadId, status, markedBy: req.user._id, markedAt: new Date() });
    }

    webinar.totalAttended = webinar.attendees.filter(a => a.status === 'attended').length;
    await webinar.save();

    const webinarStatus = status === 'attended' ? 'attended' : status === 'registered' ? 'registered' : 'invited';
    await Lead.findByIdAndUpdate(leadId, { webinarStatus, webinarSeenAt: status === 'attended' ? new Date() : undefined });

    res.json({ success: true, webinar });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/webinars/:id/send-invites — send WhatsApp invite to not-attended leads
exports.sendWebinarInvites = async (req, res) => {
  try {
    const webinar = await Webinar.findById(req.params.id);
    if (!webinar) return res.status(404).json({ success: false, message: 'Webinar not found' });

    const attendedIds = webinar.attendees.filter(a => a.status === 'attended').map(a => a.lead?.toString()).filter(Boolean);
    const leads = await Lead.find({ isActive: true, _id: { $nin: attendedIds }, phone: { $exists: true, $ne: '' } });

    if (!wa.isReady()) {
      return res.status(400).json({ success: false, message: 'WhatsApp not connected. Please connect WhatsApp first.' });
    }

    const youtubeLink = webinar.youtubeLink || webinar.link || '';
    const zoomLink = webinar.zoomLink || webinar.link || '';
    const dateStr = moment(webinar.scheduledAt).format('DD MMM YYYY, hh:mm A');

    let sent = 0, failed = 0;
    for (const lead of leads) {
      try {
        let msg = `🎓 *${webinar.title}*\n\n`;
        msg += `📅 Date: ${dateStr}\n`;
        msg += `⏱️ Duration: ${webinar.duration} minutes\n\n`;
        if (youtubeLink) msg += `🔴 YouTube: ${youtubeLink}\n`;
        if (zoomLink && zoomLink !== youtubeLink) msg += `🎥 Zoom: ${zoomLink}\n`;
        msg += `\nDon't miss it! See you there 🚀`;

        await wa.sendText(lead.phone, msg);
        sent++;

        // Mark as invited in attendees
        const existing = webinar.attendees.find(a => a.lead?.toString() === lead._id.toString());
        if (!existing) {
          webinar.attendees.push({ lead: lead._id, status: 'invited', markedBy: req.user._id, markedAt: new Date() });
        }
        await Lead.findByIdAndUpdate(lead._id, { webinarStatus: 'invited' });

        await new Promise(r => setTimeout(r, 1200));
      } catch { failed++; }
    }

    webinar.totalInvited = webinar.attendees.length;
    await webinar.save();

    res.json({ success: true, sent, failed, total: leads.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/webinars/not-seen-leads — leads who haven't attended any webinar
exports.getNotSeenLeads = async (req, res) => {
  try {
    const leads = await Lead.find({
      isActive: true,
      webinarStatus: { $in: ['not_invited', 'missed', 'invited'] }
    }).select('name phone email city webinarStatus').limit(200);

    res.json({ success: true, leads, count: leads.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/webinars/:id
exports.updateWebinar = async (req, res) => {
  try {
    const leadIds = normalizeLeadIds(req.body);
    const webinar = await Webinar.findById(req.params.id);
    if (!webinar) return res.status(404).json({ success: false, message: 'Webinar not found' });
    Object.assign(webinar, req.body);
    applyLeadInvites(webinar, leadIds, req.user._id);
    await webinar.save();
    if (leadIds.length) await Lead.updateMany({ _id: { $in: leadIds } }, { webinarStatus: 'invited' });
    if (webinar) await notifyCandidates(webinar, req.user._id);
    res.json({ success: true, webinar });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/webinars/:id
exports.deleteWebinar = async (req, res) => {
  try {
    await Webinar.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Webinar deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
