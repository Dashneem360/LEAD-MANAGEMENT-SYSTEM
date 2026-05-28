const mongoose = require('mongoose');
const moment = require('moment');
const Followup = require('../../models/Followup');
const Lead = require('../../models/Lead');
const User = require('../../models/User');
const Notification = require('../../models/Notification');

const appError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const parsePositiveInt = (value, fallback, max) => {
  const parsed = parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return max ? Math.min(parsed, max) : parsed;
};

const getDayRange = (date) => {
  const parsed = moment(date);
  if (!parsed.isValid()) return null;
  return {
    start: parsed.startOf('day').toDate(),
    end: parsed.endOf('day').toDate()
  };
};

const getUserMatch = (user) => (user.role === 'member' ? { assignedTo: user._id } : {});

const ensureMemberOwnsFollowup = (user, followup) => {
  if (user.role !== 'member') return;
  if (followup.assignedTo?.toString() !== user._id.toString()) {
    throw appError(403, 'Not authorized for this followup');
  }
};

const populateFollowupList = (query) => query
  .populate('lead', 'name phone email status priority webinarStatus')
  .populate('assignedTo', 'name avatar')
  .populate('assignedBy', 'name');

const markMissedFollowups = async (user, beforeDate = new Date()) => {
  const matchUser = getUserMatch(user);
  await Followup.updateMany(
    { ...matchUser, scheduledDate: { $lt: beforeDate }, status: 'pending' },
    { status: 'missed' }
  );
};

const statusCounts = async (match) => {
  const rows = await Followup.aggregate([
    { $match: match },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  const map = rows.reduce((acc, row) => {
    acc[row._id] = row.count;
    return acc;
  }, {});

  return {
    total: Object.values(map).reduce((sum, count) => sum + count, 0),
    pending: map.pending || 0,
    completed: map.completed || 0,
    missed: map.missed || 0,
    rescheduled: map.rescheduled || 0,
    cancelled: map.cancelled || 0
  };
};

exports.getFollowups = async (user, params) => {
  const { date, status, assignedTo } = params;
  const page = parsePositiveInt(params.page, 1);
  const limit = parsePositiveInt(params.limit, 20, 100);
  const query = {};

  if (user.role === 'member') query.assignedTo = user._id;
  else if (assignedTo) {
    if (!isValidObjectId(assignedTo)) throw appError(400, 'Invalid assignedTo user ID');
    query.assignedTo = assignedTo;
  }

  if (status) query.status = status;

  if (date) {
    const range = getDayRange(date);
    if (!range) throw appError(400, 'Invalid date');
    query.scheduledDate = { $gte: range.start, $lte: range.end };
  }

  const total = await Followup.countDocuments(query);
  const followups = await populateFollowupList(
    Followup.find(query)
      .sort({ scheduledDate: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
  );

  return { followups, total, page, pages: Math.ceil(total / limit) };
};

exports.getTodayFollowups = async (user) => {
  const today = moment().startOf('day').toDate();
  const tomorrow = moment().endOf('day').toDate();
  const query = {
    ...getUserMatch(user),
    scheduledDate: { $gte: today, $lte: tomorrow }
  };

  const followups = await populateFollowupList(
    Followup.find(query).sort({ scheduledDate: 1 })
  );
  const stats = {
    total: followups.length,
    completed: followups.filter((f) => f.status === 'completed').length,
    pending: followups.filter((f) => f.status === 'pending').length,
    missed: followups.filter((f) => f.status === 'missed').length
  };

  return { followups, stats };
};

exports.getMissedFollowups = async (user) => {
  const now = new Date();
  await markMissedFollowups(user, now);

  const missed = await populateFollowupList(
    Followup.find({
      ...getUserMatch(user),
      scheduledDate: { $lt: now },
      status: 'missed'
    })
      .sort({ scheduledDate: -1 })
      .limit(50)
  );

  return { followups: missed, count: missed.length };
};

exports.createFollowup = async (user, body) => {
  const { lead: leadId, assignedTo, scheduledDate, type, remark, priority } = body;
  if (!isValidObjectId(leadId)) throw appError(400, 'Invalid lead ID');

  const scheduledAt = moment(scheduledDate);
  if (!scheduledAt.isValid()) throw appError(400, 'Invalid scheduled date');

  const lead = await Lead.findById(leadId);
  if (!lead) throw appError(404, 'Lead not found');

  const assigneeId = assignedTo || lead.assignedTo?.toString() || user._id.toString();
  if (!isValidObjectId(assigneeId)) throw appError(400, 'Invalid assignedTo user ID');

  const assignee = await User.findById(assigneeId);
  if (!assignee) throw appError(404, 'Assigned user not found');
  if (user.role === 'member' && assigneeId !== user._id.toString()) {
    throw appError(403, 'Members can only assign followups to themselves');
  }

  const followup = await Followup.create({
    lead: leadId,
    assignedTo: assigneeId,
    assignedBy: user._id,
    scheduledDate: scheduledAt.toDate(),
    type,
    remark,
    priority
  });

  await Promise.all([
    Lead.findByIdAndUpdate(leadId, {
      nextFollowupDate: scheduledAt.toDate(),
      $inc: { followupCount: 1 }
    }),
    User.findByIdAndUpdate(assigneeId, { $inc: { 'stats.totalFollowups': 1 } }),
    Notification.create({
      user: assigneeId,
      type: 'upcoming_followup',
      title: 'New Followup Scheduled',
      message: `Followup scheduled for ${scheduledAt.format('DD MMM YYYY, hh:mm A')}`,
      relatedFollowup: followup._id
    })
  ]);

  return Followup.findById(followup._id)
    .populate('lead', 'name phone email status')
    .populate('assignedTo', 'name avatar');
};

exports.completeFollowup = async (user, id, body) => {
  const { outcome, remark, duration, nextFollowupDate, nextFollowupType } = body;
  if (!isValidObjectId(id)) throw appError(400, 'Invalid followup ID');

  const followup = await Followup.findById(id);
  if (!followup) throw appError(404, 'Followup not found');
  ensureMemberOwnsFollowup(user, followup);
  if (followup.status === 'completed') throw appError(400, 'Followup is already completed');

  followup.status = 'completed';
  followup.outcome = outcome;
  followup.remark = remark;
  followup.duration = duration || 0;
  followup.completedAt = new Date();
  followup.completedBy = user._id;
  await followup.save();

  const statusMap = {
    interested: 'interested',
    not_interested: 'not_interested',
    nurturing: 'nurturing',
    converted: 'converted'
  };
  const leadUpdate = {
    lastFollowupDate: new Date(),
    latestRemark: remark,
    $inc: { callCount: 1 }
  };
  if (statusMap[outcome]) leadUpdate.status = statusMap[outcome];
  if (remark) leadUpdate.$push = { remarks: { text: remark, addedBy: user._id } };

  let nextScheduledAt = null;
  if (nextFollowupDate) {
    nextScheduledAt = moment(nextFollowupDate);
    if (!nextScheduledAt.isValid()) throw appError(400, 'Invalid next followup date');
    leadUpdate.nextFollowupDate = nextScheduledAt.toDate();
  }

  await Promise.all([
    Lead.findByIdAndUpdate(followup.lead, leadUpdate),
    User.findByIdAndUpdate(user._id, { $inc: { 'stats.completedFollowups': 1 } })
  ]);

  if (nextScheduledAt && followup.assignedTo) {
    await Followup.create({
      lead: followup.lead,
      assignedTo: followup.assignedTo,
      assignedBy: user._id,
      scheduledDate: nextScheduledAt.toDate(),
      type: nextFollowupType || 'call',
      priority: followup.priority
    });
    await Promise.all([
      Lead.findByIdAndUpdate(followup.lead, { $inc: { followupCount: 1 } }),
      User.findByIdAndUpdate(followup.assignedTo, { $inc: { 'stats.totalFollowups': 1 } })
    ]);
  }

  return Followup.findById(followup._id)
    .populate('lead', 'name phone email status')
    .populate('assignedTo', 'name avatar');
};

exports.rescheduleFollowup = async (user, id, body) => {
  const { rescheduledTo, rescheduledReason } = body;
  if (!isValidObjectId(id)) throw appError(400, 'Invalid followup ID');

  const rescheduledAt = moment(rescheduledTo);
  if (!rescheduledAt.isValid()) throw appError(400, 'Invalid rescheduled date');

  const existing = await Followup.findById(id);
  if (!existing) throw appError(404, 'Followup not found');
  ensureMemberOwnsFollowup(user, existing);
  if (existing.status === 'completed') throw appError(400, 'Completed followups cannot be rescheduled');

  existing.status = 'pending';
  existing.rescheduledTo = rescheduledAt.toDate();
  existing.rescheduledReason = rescheduledReason;
  existing.scheduledDate = rescheduledAt.toDate();
  await existing.save();

  const followup = await Followup.findById(existing._id)
    .populate('lead', 'name phone')
    .populate('assignedTo', 'name avatar');

  const leadId = followup.lead?._id || existing.lead;
  if (leadId) await Lead.findByIdAndUpdate(leadId, { nextFollowupDate: rescheduledAt.toDate() });

  return followup;
};

exports.getFollowupStats = async (user) => {
  const today = moment().startOf('day').toDate();
  const tomorrow = moment().endOf('day').toDate();
  const weekStart = moment().startOf('week').toDate();
  const weekEnd = moment().endOf('week').toDate();
  const monthStart = moment().startOf('month').toDate();
  const monthEnd = moment().endOf('month').toDate();
  const matchUser = getUserMatch(user);

  await markMissedFollowups(user, new Date());

  const [all, todayStats, week, month, totalMissed] = await Promise.all([
    statusCounts(matchUser),
    statusCounts({ ...matchUser, scheduledDate: { $gte: today, $lte: tomorrow } }),
    statusCounts({ ...matchUser, scheduledDate: { $gte: weekStart, $lte: weekEnd } }),
    statusCounts({ ...matchUser, scheduledDate: { $gte: monthStart, $lte: monthEnd } }),
    Followup.countDocuments({ ...matchUser, scheduledDate: { $lt: today }, status: 'missed' })
  ]);

  return {
    all,
    today: todayStats,
    week,
    month,
    weekTotal: week.total,
    weekCompleted: week.completed,
    monthTotal: month.total,
    monthCompleted: month.completed,
    totalMissed
  };
};
