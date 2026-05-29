const { Op } = require('sequelize');
const { Lead, User, Followup, Notification, LeadRemark } = require('../../models');

const LEAD_USER_ATTRS = ['id', 'name', 'email', 'avatar'];
const LEAD_INCLUDE = [
  { model: User, as: 'assignedTo', attributes: LEAD_USER_ATTRS },
  { model: User, as: 'assignedBy', attributes: ['id', 'name'] },
  {
    model: LeadRemark, as: 'remarks',
    include: [{ model: User, as: 'addedBy', attributes: ['id', 'name', 'avatar'] }],
    order: [['addedAt', 'ASC']]
  }
];

const incrementStat = async (userId, stat, amount = 1) => {
  if (!userId) return;
  const user = await User.findByPk(userId, { attributes: ['id', 'stats'] });
  if (!user) return;
  const stats = { ...(user.stats || {}) };
  stats[stat] = (stats[stat] || 0) + amount;
  await user.update({ stats });
};

// GET /api/leads
exports.getLeads = async (req, res) => {
  try {
    const { status, assignedTo, search, source, priority, page = 1, limit = 20, webinarStatus, sortBy, followupFrom, followupTo } = req.query;
    const where = { isActive: true };

    if (req.user.role === 'member') where.assignedToId = req.user.id;
    else if (assignedTo) where.assignedToId = assignedTo;

    if (status) where.status = status;
    if (source) where.source = source;
    if (priority) where.priority = priority;
    if (webinarStatus) where.webinarStatus = webinarStatus;
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }
    if (followupFrom || followupTo) {
      where.nextFollowupDate = {};
      if (followupFrom) where.nextFollowupDate[Op.gte] = new Date(followupFrom);
      if (followupTo) where.nextFollowupDate[Op.lte] = new Date(followupTo + 'T23:59:59.999Z');
    }

    const sortMap = {
      followup_asc:  [['nextFollowupDate', 'ASC']],
      followup_desc: [['nextFollowupDate', 'DESC']],
      created_desc:  [['createdAt', 'DESC']],
      created_asc:   [['createdAt', 'ASC']],
      name_asc:      [['name', 'ASC']],
      deal_desc:     [['dealValue', 'DESC']]
    };
    const order = sortMap[sortBy] || [['createdAt', 'DESC']];

    const total = await Lead.count({ where });
    const leads = await Lead.findAll({
      where,
      include: LEAD_INCLUDE,
      order,
      offset: (page - 1) * parseInt(limit),
      limit: parseInt(limit)
    });

    res.json({ success: true, leads, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/leads/:id
exports.getLead = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id, { include: LEAD_INCLUDE });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    res.json({ success: true, lead });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/leads
exports.createLead = async (req, res) => {
  try {
    const lead = await Lead.create({
      ...req.body,
      assignedById: req.user.id,
      source: req.body.source || 'manual'
    });
    if (lead.assignedToId) {
      await incrementStat(lead.assignedToId, 'totalLeads');
      await Notification.create({
        userId: lead.assignedToId,
        type: 'lead_assigned',
        title: 'New Lead Assigned',
        message: `Lead "${lead.name}" has been assigned to you`,
        relatedLeadId: lead.id
      });
    }
    const populated = await Lead.findByPk(lead.id, {
      include: [{ model: User, as: 'assignedTo', attributes: LEAD_USER_ATTRS }]
    });
    res.status(201).json({ success: true, lead: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/leads/:id
exports.updateLead = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const wasConverted = lead.status !== 'converted' && req.body.status === 'converted';

    // Only update known model fields (exclude nested/virtual)
    const { remarks, assignedTo, assignedBy, ...updateFields } = req.body;
    if (req.body.assignedTo !== undefined) updateFields.assignedToId = req.body.assignedTo;
    await lead.update(updateFields);

    if (wasConverted && lead.assignedToId) {
      await incrementStat(lead.assignedToId, 'convertedLeads');
    }

    const updated = await Lead.findByPk(lead.id, {
      include: [{ model: User, as: 'assignedTo', attributes: LEAD_USER_ATTRS }]
    });
    res.json({ success: true, lead: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/leads/:id
exports.deleteLead = async (req, res) => {
  try {
    await Lead.update({ isActive: false }, { where: { id: req.params.id } });
    res.json({ success: true, message: 'Lead deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/leads/:id/remark
exports.addRemark = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    await LeadRemark.create({ leadId: lead.id, text: req.body.text, addedById: req.user.id, addedAt: new Date() });
    await lead.update({ latestRemark: req.body.text });
    const updated = await Lead.findByPk(lead.id, { include: LEAD_INCLUDE });
    res.json({ success: true, lead: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/leads/:id/assign
exports.assignLead = async (req, res) => {
  try {
    const { assignedTo } = req.body;
    await Lead.update(
      { assignedToId: assignedTo, assignedById: req.user.id, assignedAt: new Date() },
      { where: { id: req.params.id } }
    );
    const lead = await Lead.findByPk(req.params.id, {
      include: [{ model: User, as: 'assignedTo', attributes: LEAD_USER_ATTRS }]
    });
    await incrementStat(assignedTo, 'totalLeads');
    await Notification.create({
      userId: assignedTo,
      type: 'lead_assigned',
      title: 'Lead Assigned',
      message: `Lead "${lead.name}" has been assigned to you`,
      relatedLeadId: lead.id
    });
    res.json({ success: true, lead });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/leads/:id/webinar
exports.updateWebinarStatus = async (req, res) => {
  try {
    const { webinarStatus } = req.body;
    const update = { webinarStatus };
    if (webinarStatus === 'attended') update.webinarSeenAt = new Date();
    await Lead.update(update, { where: { id: req.params.id } });
    const lead = await Lead.findByPk(req.params.id, {
      include: [{ model: User, as: 'assignedTo', attributes: LEAD_USER_ATTRS }]
    });
    res.json({ success: true, lead });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/leads/bulk-import
exports.bulkImport = async (req, res) => {
  try {
    const { leads } = req.body;
    let created = 0, updated = 0, errors = 0;

    for (const row of leads) {
      try {
        const existing = await Lead.findOne({ where: { phone: row.phone } });
        if (existing) {
          const { remarks, assignedTo, assignedBy, ...safeRow } = row;
          await existing.update({ ...safeRow, lastSyncedAt: new Date(), source: 'google_sheet' });
          updated++;
        } else {
          const { remarks, assignedTo, assignedBy, ...safeRow } = row;
          await Lead.create({ ...safeRow, source: 'google_sheet', lastSyncedAt: new Date() });
          created++;
        }
      } catch { errors++; }
    }
    res.json({ success: true, message: `Import complete: ${created} created, ${updated} updated, ${errors} errors` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/leads/today-calling
exports.getTodayCallingList = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const where = {
      isActive: true,
      nextFollowupDate: { [Op.gte]: today, [Op.lt]: tomorrow }
    };
    if (req.user.role === 'member') where.assignedToId = req.user.id;

    const { sequelize } = require('../../config/sequelize');
    const leads = await Lead.findAll({
      where,
      include: [{ model: User, as: 'assignedTo', attributes: ['id', 'name', 'avatar'] }],
      order: [
        [require('sequelize').literal(`CASE "Lead"."priority" WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END`), 'ASC'],
        ['nextFollowupDate', 'ASC']
      ]
    });

    res.json({ success: true, leads });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
