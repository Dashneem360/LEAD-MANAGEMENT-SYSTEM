const { Op } = require('sequelize');
const moment = require('moment');
const { Webinar, Lead, User, Message, WebinarAttendee, WebinarCandidate } = require('../../models');
const wa = require('../../utils/whatsappClient');

const normalizeLeadIds = (body) => {
  const ids = body.leads || body.leadIds || body.selectedLeads || [];
  return Array.isArray(ids) ? ids.filter(Boolean) : [];
};

const notifyCandidates = async (webinar, fromUserId) => {
  const candidates = await WebinarCandidate.findAll({ where: { webinarId: webinar.id }, raw: true });
  if (!candidates.length) return;
  const url = webinar.zoomLink || webinar.youtubeLink || webinar.link || 'Link will be shared soon';
  const content = `Webinar: ${webinar.title}\nDate: ${moment(webinar.scheduledAt).format('DD MMM YYYY, hh:mm A')}\nURL: ${url}`;
  await Promise.all(candidates.map(c => Message.create({ fromId: fromUserId, toId: c.userId, type: 'text', content })));
};

const applyLeadInvites = async (webinarId, leadIds, userId) => {
  if (!leadIds.length) return;
  for (const leadId of leadIds) {
    await WebinarAttendee.findOrCreate({
      where: { webinarId, leadId },
      defaults: { status: 'invited', markedById: userId, markedAt: new Date() }
    });
  }
  const totalInvited = await WebinarAttendee.count({ where: { webinarId } });
  await Webinar.update({ totalInvited }, { where: { id: webinarId } });
};

const WEBINAR_INCLUDE = [
  { model: User, as: 'createdBy', attributes: ['id', 'name'] },
  { model: User, as: 'candidates', attributes: ['id', 'name', 'email', 'phone'] },
  {
    model: WebinarAttendee, as: 'attendees',
    include: [
      { model: Lead, as: 'lead', attributes: ['id', 'name', 'phone'] },
      { model: User, as: 'markedBy', attributes: ['id', 'name'] }
    ]
  }
];

// GET /api/webinars
exports.getWebinars = async (req, res) => {
  try {
    const webinars = await Webinar.findAll({ include: WEBINAR_INCLUDE, order: [['scheduledAt', 'DESC']] });

    const result = await Promise.all(webinars.map(async (w) => {
      const obj = w.toJSON();
      const attendedIds = (w.attendees || []).filter(a => a.status === 'attended').map(a => a.leadId);
      obj.notSeenCount = await Lead.count({ where: { isActive: true, id: { [Op.notIn]: attendedIds.length ? attendedIds : ['00000000-0000-0000-0000-000000000000'] } } });
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
    const { leads, leadIds: _l, selectedLeads: _s, candidates, ...webinarData } = req.body;
    const webinar = await Webinar.create({ ...webinarData, createdById: req.user.id });

    if (Array.isArray(candidates) && candidates.length) {
      await WebinarCandidate.bulkCreate(
        candidates.map(uid => ({ webinarId: webinar.id, userId: uid })),
        { ignoreDuplicates: true }
      );
    }
    if (leadIds.length) {
      await applyLeadInvites(webinar.id, leadIds, req.user.id);
      await Lead.update({ webinarStatus: 'invited' }, { where: { id: { [Op.in]: leadIds } } });
    }
    await notifyCandidates(webinar, req.user.id);

    const populated = await Webinar.findByPk(webinar.id, { include: WEBINAR_INCLUDE });
    res.status(201).json({ success: true, webinar: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/webinars/:id/mark-attendance
exports.markAttendance = async (req, res) => {
  try {
    const { leadId, status } = req.body;
    const webinar = await Webinar.findByPk(req.params.id);
    if (!webinar) return res.status(404).json({ success: false, message: 'Webinar not found' });

    const [attendee, created] = await WebinarAttendee.findOrCreate({
      where: { webinarId: req.params.id, leadId },
      defaults: { status, markedById: req.user.id, markedAt: new Date() }
    });
    if (!created) await attendee.update({ status, markedById: req.user.id, markedAt: new Date() });

    const totalAttended = await WebinarAttendee.count({ where: { webinarId: req.params.id, status: 'attended' } });
    await webinar.update({ totalAttended });

    const webinarStatus = status === 'attended' ? 'attended' : status === 'registered' ? 'registered' : 'invited';
    await Lead.update(
      { webinarStatus, ...(status === 'attended' ? { webinarSeenAt: new Date() } : {}) },
      { where: { id: leadId } }
    );

    const updated = await Webinar.findByPk(req.params.id, { include: WEBINAR_INCLUDE });
    res.json({ success: true, webinar: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/webinars/:id/send-invites
exports.sendWebinarInvites = async (req, res) => {
  try {
    const webinar = await Webinar.findByPk(req.params.id);
    if (!webinar) return res.status(404).json({ success: false, message: 'Webinar not found' });

    const attendedRows = await WebinarAttendee.findAll({
      where: { webinarId: req.params.id, status: 'attended' },
      attributes: ['leadId'], raw: true
    });
    const attendedIds = attendedRows.map(r => r.leadId);

    const leads = await Lead.findAll({
      where: {
        isActive: true,
        id: { [Op.notIn]: attendedIds.length ? attendedIds : ['00000000-0000-0000-0000-000000000000'] },
        phone: { [Op.not]: null, [Op.ne]: '' }
      }
    });

    if (!wa.isReady()) {
      return res.status(400).json({ success: false, message: 'WhatsApp not connected. Please connect WhatsApp first.' });
    }

    const dateStr = moment(webinar.scheduledAt).format('DD MMM YYYY, hh:mm A');
    const youtubeLink = webinar.youtubeLink || webinar.link || '';
    const zoomLink = webinar.zoomLink || webinar.link || '';

    let sent = 0, failed = 0;
    for (const lead of leads) {
      try {
        let msg = `🎓 *${webinar.title}*\n\n📅 Date: ${dateStr}\n⏱️ Duration: ${webinar.duration} minutes\n\n`;
        if (youtubeLink) msg += `🔴 YouTube: ${youtubeLink}\n`;
        if (zoomLink && zoomLink !== youtubeLink) msg += `🎥 Zoom: ${zoomLink}\n`;
        msg += `\nDon't miss it! See you there 🚀`;

        await wa.sendText(lead.phone, msg);
        sent++;
        await WebinarAttendee.findOrCreate({
          where: { webinarId: webinar.id, leadId: lead.id },
          defaults: { status: 'invited', markedById: req.user.id, markedAt: new Date() }
        });
        await Lead.update({ webinarStatus: 'invited' }, { where: { id: lead.id } });
        await new Promise(r => setTimeout(r, 1200));
      } catch { failed++; }
    }

    const totalInvited = await WebinarAttendee.count({ where: { webinarId: webinar.id } });
    await webinar.update({ totalInvited });

    res.json({ success: true, sent, failed, total: leads.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/webinars/not-seen-leads
exports.getNotSeenLeads = async (req, res) => {
  try {
    const leads = await Lead.findAll({
      where: { isActive: true, webinarStatus: { [Op.in]: ['not_invited', 'missed', 'invited'] } },
      attributes: ['id', 'name', 'phone', 'email', 'city', 'webinarStatus'],
      limit: 200
    });
    res.json({ success: true, leads, count: leads.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/webinars/:id
exports.updateWebinar = async (req, res) => {
  try {
    const leadIds = normalizeLeadIds(req.body);
    const webinar = await Webinar.findByPk(req.params.id);
    if (!webinar) return res.status(404).json({ success: false, message: 'Webinar not found' });

    const { leads, leadIds: _l, selectedLeads: _s, candidates, attendees, ...updateData } = req.body;
    await webinar.update(updateData);

    if (Array.isArray(candidates)) {
      await WebinarCandidate.destroy({ where: { webinarId: webinar.id } });
      if (candidates.length) {
        await WebinarCandidate.bulkCreate(
          candidates.map(uid => ({ webinarId: webinar.id, userId: uid })),
          { ignoreDuplicates: true }
        );
      }
    }
    if (leadIds.length) {
      await applyLeadInvites(webinar.id, leadIds, req.user.id);
      await Lead.update({ webinarStatus: 'invited' }, { where: { id: { [Op.in]: leadIds } } });
    }
    await notifyCandidates(webinar, req.user.id);

    const updated = await Webinar.findByPk(webinar.id, { include: WEBINAR_INCLUDE });
    res.json({ success: true, webinar: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/webinars/:id
exports.deleteWebinar = async (req, res) => {
  try {
    await WebinarAttendee.destroy({ where: { webinarId: req.params.id } });
    await WebinarCandidate.destroy({ where: { webinarId: req.params.id } });
    await Webinar.destroy({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Webinar deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
