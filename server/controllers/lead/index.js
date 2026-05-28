const Lead = require('../../models/Lead');
const User = require('../../models/User');
const Followup = require('../../models/Followup');
const Notification = require('../../models/Notification');

// GET /api/leads
exports.getLeads = async (req, res) => {
  try {
    const { status, assignedTo, search, source, priority, page = 1, limit = 20, webinarStatus, sortBy, followupFrom, followupTo } = req.query;
    const query = { isActive: true };

    // Members see only their leads
    if (req.user.role === 'member') query.assignedTo = req.user._id;
    else if (assignedTo) query.assignedTo = assignedTo;

    if (status) query.status = status;
    if (source) query.source = source;
    if (priority) query.priority = priority;
    if (webinarStatus) query.webinarStatus = webinarStatus;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (followupFrom || followupTo) {
      query.nextFollowupDate = {};
      if (followupFrom) query.nextFollowupDate.$gte = new Date(followupFrom);
      if (followupTo) query.nextFollowupDate.$lte = new Date(followupTo + 'T23:59:59.999Z');
    }

    const sortMap = {
      'followup_asc':  { nextFollowupDate: 1 },
      'followup_desc': { nextFollowupDate: -1 },
      'created_desc':  { createdAt: -1 },
      'created_asc':   { createdAt: 1 },
      'name_asc':      { name: 1 },
      'deal_desc':     { dealValue: -1 }
    };
    const sort = sortMap[sortBy] || { createdAt: -1 };

    const total = await Lead.countDocuments(query);
    const leads = await Lead.find(query)
      .populate('assignedTo', 'name email avatar')
      .populate('assignedBy', 'name')
      .populate('remarks.addedBy', 'name')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({ success: true, leads, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/leads/:id
exports.getLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('assignedTo', 'name email avatar phone')
      .populate('assignedBy', 'name')
      .populate('remarks.addedBy', 'name avatar');
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    res.json({ success: true, lead });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/leads
exports.createLead = async (req, res) => {
  try {
    const lead = await Lead.create({ ...req.body, assignedBy: req.user._id, source: req.body.source || 'manual' });
    if (lead.assignedTo) {
      await User.findByIdAndUpdate(lead.assignedTo, { $inc: { 'stats.totalLeads': 1 } });
      await Notification.create({
        user: lead.assignedTo, type: 'lead_assigned',
        title: 'New Lead Assigned',
        message: `Lead "${lead.name}" has been assigned to you`,
        relatedLead: lead._id
      });
    }
    const populated = await Lead.findById(lead._id).populate('assignedTo', 'name email avatar');
    res.status(201).json({ success: true, lead: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/leads/:id
exports.updateLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    // Track if status changed to converted
    const wasConverted = lead.status !== 'converted' && req.body.status === 'converted';

    Object.assign(lead, req.body);
    await lead.save();

    if (wasConverted && lead.assignedTo) {
      await User.findByIdAndUpdate(lead.assignedTo, { $inc: { 'stats.convertedLeads': 1 } });
    }

    const updated = await Lead.findById(lead._id).populate('assignedTo', 'name email avatar');
    res.json({ success: true, lead: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/leads/:id
exports.deleteLead = async (req, res) => {
  try {
    await Lead.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Lead deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/leads/:id/remark
exports.addRemark = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    lead.remarks.push({ text: req.body.text, addedBy: req.user._id });
    lead.latestRemark = req.body.text;
    await lead.save();
    const updated = await Lead.findById(lead._id).populate('remarks.addedBy', 'name avatar');
    res.json({ success: true, lead: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/leads/:id/assign
exports.assignLead = async (req, res) => {
  try {
    const { assignedTo } = req.body;
    const lead = await Lead.findByIdAndUpdate(req.params.id, {
      assignedTo, assignedBy: req.user._id, assignedAt: new Date()
    }, { new: true }).populate('assignedTo', 'name email avatar');

    await User.findByIdAndUpdate(assignedTo, { $inc: { 'stats.totalLeads': 1 } });
    await Notification.create({
      user: assignedTo, type: 'lead_assigned',
      title: 'Lead Assigned',
      message: `Lead "${lead.name}" has been assigned to you`,
      relatedLead: lead._id
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
    const lead = await Lead.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('assignedTo', 'name email avatar');
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
        const existing = await Lead.findOne({ phone: row.phone });
        if (existing) {
          Object.assign(existing, row, { lastSyncedAt: new Date(), source: 'google_sheet' });
          await existing.save();
          updated++;
        } else {
          await Lead.create({ ...row, source: 'google_sheet', lastSyncedAt: new Date() });
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

    const query = {
      isActive: true,
      nextFollowupDate: { $gte: today, $lt: tomorrow }
    };
    if (req.user.role === 'member') query.assignedTo = req.user._id;

    const leads = await Lead.find(query)
      .populate('assignedTo', 'name avatar')
      .sort({ priority: -1, nextFollowupDate: 1 });

    res.json({ success: true, leads });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
