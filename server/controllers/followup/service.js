const { Op } = require('sequelize');
const { literal } = require('sequelize');
const moment = require('moment');
const sequelize = require('../../config/sequelize');
const { Followup, Lead, User, Notification, LeadRemark } = require('../../models');

const appError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isValidId = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id));

const parsePositiveInt = (value, fallback, max) => {
  const parsed = parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return max ? Math.min(parsed, max) : parsed;
};

const getDayRange = (date) => {
  const parsed = moment(date);
  if (!parsed.isValid()) return null;
  return { start: parsed.startOf('day').toDate(), end: parsed.endOf('day').toDate() };
};

const getUserMatch = (user) => (user.role === 'member' ? { assignedToId: user.id } : {});

const ensureMemberOwnsFollowup = (user, followup) => {
  if (user.role !== 'member') return;
  if (followup.assignedToId !== user.id) throw appError(403, 'Not authorized for this followup');
};

const FOLLOWUP_INCLUDE = [
  { model: Lead, as: 'lead', attributes: ['id', 'name', 'phone', 'email', 'status', 'priority', 'webinarStatus'] },
  { model: User, as: 'assignedTo', attributes: ['id', 'name', 'avatar'] },
  { model: User, as: 'assignedBy', attributes: ['id', 'name'] }
];

const markMissedFollowups = async (user, beforeDate = new Date()) => {
  const matchUser = getUserMatch(user);
  await Followup.update(
    { status: 'missed' },
    { where: { ...matchUser, scheduledDate: { [Op.lt]: beforeDate }, status: 'pending' } }
  );
};

const statusCounts = async (match) => {
  const rows = await Followup.findAll({
    where: match,
    attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['status'],
    raw: true
  });
  const map = rows.reduce((acc, row) => { acc[row.status] = parseInt(row.count); return acc; }, {});
  return {
    total: Object.values(map).reduce((sum, c) => sum + c, 0),
    pending: map.pending || 0,
    completed: map.completed || 0,
    missed: map.missed || 0,
    rescheduled: map.rescheduled || 0,
    cancelled: map.cancelled || 0
  };
};

const incrementStat = async (userId, stat, amount = 1) => {
  if (!userId) return;
  const user = await User.findByPk(userId, { attributes: ['id', 'stats'] });
  if (!user) return;
  const stats = { ...(user.stats || {}) };
  stats[stat] = (stats[stat] || 0) + amount;
  await user.update({ stats });
};

exports.getFollowups = async (user, params) => {
  const { date, status, assignedTo } = params;
  const page = parsePositiveInt(params.page, 1);
  const limit = parsePositiveInt(params.limit, 20, 100);
  const where = {};

  if (user.role === 'member') where.assignedToId = user.id;
  else if (assignedTo) {
    if (!isValidId(assignedTo)) throw appError(400, 'Invalid assignedTo user ID');
    where.assignedToId = assignedTo;
  }

  if (status) where.status = status;
  if (date) {
    const range = getDayRange(date);
    if (!range) throw appError(400, 'Invalid date');
    where.scheduledDate = { [Op.gte]: range.start, [Op.lte]: range.end };
  }

  const total = await Followup.count({ where });
  const followups = await Followup.findAll({
    where, include: FOLLOWUP_INCLUDE,
    order: [['scheduledDate', 'ASC']],
    offset: (page - 1) * limit,
    limit
  });

  return { followups, total, page, pages: Math.ceil(total / limit) };
};

exports.getTodayFollowups = async (user) => {
  const today = moment().startOf('day').toDate();
  const tomorrow = moment().endOf('day').toDate();
  const where = { ...getUserMatch(user), scheduledDate: { [Op.gte]: today, [Op.lte]: tomorrow } };

  const followups = await Followup.findAll({ where, include: FOLLOWUP_INCLUDE, order: [['scheduledDate', 'ASC']] });
  const stats = {
    total: followups.length,
    completed: followups.filter(f => f.status === 'completed').length,
    pending: followups.filter(f => f.status === 'pending').length,
    missed: followups.filter(f => f.status === 'missed').length
  };
  return { followups, stats };
};

exports.getMissedFollowups = async (user) => {
  const now = new Date();
  await markMissedFollowups(user, now);

  const followups = await Followup.findAll({
    where: { ...getUserMatch(user), scheduledDate: { [Op.lt]: now }, status: 'missed' },
    include: FOLLOWUP_INCLUDE,
    order: [['scheduledDate', 'DESC']],
    limit: 50
  });
  return { followups, count: followups.length };
};

exports.createFollowup = async (user, body) => {
  const { lead: leadId, assignedTo, scheduledDate, type, remark, priority } = body;
  if (!isValidId(leadId)) throw appError(400, 'Invalid lead ID');

  const scheduledAt = moment(scheduledDate);
  if (!scheduledAt.isValid()) throw appError(400, 'Invalid scheduled date');

  const lead = await Lead.findByPk(leadId);
  if (!lead) throw appError(404, 'Lead not found');

  const assigneeId = assignedTo || lead.assignedToId || user.id;
  if (!isValidId(assigneeId)) throw appError(400, 'Invalid assignedTo user ID');

  const assignee = await User.findByPk(assigneeId);
  if (!assignee) throw appError(404, 'Assigned user not found');
  if (user.role === 'member' && assigneeId !== user.id) {
    throw appError(403, 'Members can only assign followups to themselves');
  }

  const followup = await Followup.create({
    leadId,
    assignedToId: assigneeId,
    assignedById: user.id,
    scheduledDate: scheduledAt.toDate(),
    type,
    remark,
    priority
  });

  await Promise.all([
    Lead.update(
      { nextFollowupDate: scheduledAt.toDate() },
      { where: { id: leadId } }
    ),
    Lead.increment({ followupCount: 1 }, { where: { id: leadId } }),
    incrementStat(assigneeId, 'totalFollowups'),
    Notification.create({
      userId: assigneeId,
      type: 'upcoming_followup',
      title: 'New Followup Scheduled',
      message: `Followup scheduled for ${scheduledAt.format('DD MMM YYYY, hh:mm A')}`,
      relatedFollowupId: followup.id
    })
  ]);

  return Followup.findByPk(followup.id, {
    include: [
      { model: Lead, as: 'lead', attributes: ['id', 'name', 'phone', 'email', 'status'] },
      { model: User, as: 'assignedTo', attributes: ['id', 'name', 'avatar'] }
    ]
  });
};

exports.completeFollowup = async (user, id, body) => {
  const { outcome, remark, duration, nextFollowupDate, nextFollowupType } = body;
  if (!isValidId(id)) throw appError(400, 'Invalid followup ID');

  const followup = await Followup.findByPk(id);
  if (!followup) throw appError(404, 'Followup not found');
  ensureMemberOwnsFollowup(user, followup);
  if (followup.status === 'completed') throw appError(400, 'Followup is already completed');

  await followup.update({
    status: 'completed',
    outcome,
    remark,
    duration: duration || 0,
    completedAt: new Date(),
    completedById: user.id
  });

  const statusMap = { interested: 'interested', not_interested: 'not_interested', nurturing: 'nurturing', converted: 'converted' };
  const leadUpdate = { lastFollowupDate: new Date(), latestRemark: remark };
  if (statusMap[outcome]) leadUpdate.status = statusMap[outcome];

  let nextScheduledAt = null;
  if (nextFollowupDate) {
    nextScheduledAt = moment(nextFollowupDate);
    if (!nextScheduledAt.isValid()) throw appError(400, 'Invalid next followup date');
    leadUpdate.nextFollowupDate = nextScheduledAt.toDate();
  }

  await Promise.all([
    Lead.update(leadUpdate, { where: { id: followup.leadId } }),
    Lead.increment({ callCount: 1 }, { where: { id: followup.leadId } }),
    remark && LeadRemark.create({ leadId: followup.leadId, text: remark, addedById: user.id, addedAt: new Date() }),
    incrementStat(user.id, 'completedFollowups')
  ].filter(Boolean));

  if (nextScheduledAt && followup.assignedToId) {
    const newFollowup = await Followup.create({
      leadId: followup.leadId,
      assignedToId: followup.assignedToId,
      assignedById: user.id,
      scheduledDate: nextScheduledAt.toDate(),
      type: nextFollowupType || 'call',
      priority: followup.priority
    });
    await Promise.all([
      Lead.increment({ followupCount: 1 }, { where: { id: followup.leadId } }),
      incrementStat(followup.assignedToId, 'totalFollowups')
    ]);
  }

  return Followup.findByPk(followup.id, {
    include: [
      { model: Lead, as: 'lead', attributes: ['id', 'name', 'phone', 'email', 'status'] },
      { model: User, as: 'assignedTo', attributes: ['id', 'name', 'avatar'] }
    ]
  });
};

exports.rescheduleFollowup = async (user, id, body) => {
  const { rescheduledTo, rescheduledReason } = body;
  if (!isValidId(id)) throw appError(400, 'Invalid followup ID');

  const rescheduledAt = moment(rescheduledTo);
  if (!rescheduledAt.isValid()) throw appError(400, 'Invalid rescheduled date');

  const existing = await Followup.findByPk(id);
  if (!existing) throw appError(404, 'Followup not found');
  ensureMemberOwnsFollowup(user, existing);
  if (existing.status === 'completed') throw appError(400, 'Completed followups cannot be rescheduled');

  await existing.update({
    status: 'pending',
    rescheduledTo: rescheduledAt.toDate(),
    rescheduledReason,
    scheduledDate: rescheduledAt.toDate()
  });

  const followup = await Followup.findByPk(existing.id, {
    include: [
      { model: Lead, as: 'lead', attributes: ['id', 'name', 'phone'] },
      { model: User, as: 'assignedTo', attributes: ['id', 'name', 'avatar'] }
    ]
  });

  if (existing.leadId) {
    await Lead.update({ nextFollowupDate: rescheduledAt.toDate() }, { where: { id: existing.leadId } });
  }

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
    statusCounts({ ...matchUser, scheduledDate: { [Op.gte]: today, [Op.lte]: tomorrow } }),
    statusCounts({ ...matchUser, scheduledDate: { [Op.gte]: weekStart, [Op.lte]: weekEnd } }),
    statusCounts({ ...matchUser, scheduledDate: { [Op.gte]: monthStart, [Op.lte]: monthEnd } }),
    Followup.count({ where: { ...matchUser, scheduledDate: { [Op.lt]: today }, status: 'missed' } })
  ]);

  return {
    all, today: todayStats, week, month,
    weekTotal: week.total, weekCompleted: week.completed,
    monthTotal: month.total, monthCompleted: month.completed,
    totalMissed
  };
};
