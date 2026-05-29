const { Op } = require('sequelize');
const moment = require('moment');
const sequelize = require('../../config/sequelize');
const { Lead, Followup, User, Notification, Message } = require('../../models');

// GET /api/dashboard/stats
exports.getStats = async (req, res) => {
  try {
    const isAdmin = req.user.role !== 'member';
    const userFilter = isAdmin ? {} : { assignedToId: req.user.id };

    const today = moment().startOf('day').toDate();
    const tomorrow = moment().endOf('day').toDate();
    const monthStart = moment().startOf('month').toDate();
    const weekStart = moment().startOf('week').toDate();
    const fFilter = isAdmin ? {} : { assignedToId: req.user.id };

    const [
      totalLeads, newLeads, interestedLeads, convertedLeads,
      todayFollowups, pendingFollowups, missedFollowups,
      monthLeads, weekLeads, notSeenWebinar, unreadMessages
    ] = await Promise.all([
      Lead.count({ where: { ...userFilter, isActive: true } }),
      Lead.count({ where: { ...userFilter, isActive: true, status: 'new' } }),
      Lead.count({ where: { ...userFilter, isActive: true, status: 'interested' } }),
      Lead.count({ where: { ...userFilter, isActive: true, status: 'converted' } }),
      Followup.count({ where: { ...fFilter, scheduledDate: { [Op.gte]: today, [Op.lte]: tomorrow } } }),
      Followup.count({ where: { ...fFilter, status: 'pending', scheduledDate: { [Op.gte]: today, [Op.lte]: tomorrow } } }),
      Followup.count({ where: { ...fFilter, status: 'missed' } }),
      Lead.count({ where: { ...userFilter, isActive: true, createdAt: { [Op.gte]: monthStart } } }),
      Lead.count({ where: { ...userFilter, isActive: true, createdAt: { [Op.gte]: weekStart } } }),
      Lead.count({ where: { ...userFilter, isActive: true, webinarStatus: { [Op.in]: ['not_invited', 'missed', 'invited'] } } }),
      Message.count({ where: { toId: req.user.id, isRead: false } })
    ]);

    res.json({
      success: true,
      stats: {
        totalLeads, newLeads, interestedLeads, convertedLeads,
        todayFollowups, pendingFollowups, missedFollowups,
        monthLeads, weekLeads, notSeenWebinar, unreadMessages,
        conversionRate: totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/dashboard/growth-chart
exports.getGrowthChart = async (req, res) => {
  try {
    const { period = 'month', userId } = req.query;
    const isAdmin = req.user.role !== 'member';
    const targetUserId = isAdmin && userId ? userId : req.user.id;

    let fmt, days;
    if (period === 'week') { fmt = 'YYYY-MM-DD'; days = 7; }
    else if (period === 'month') { fmt = 'YYYY-MM-DD'; days = 30; }
    else { fmt = 'YYYY-MM'; days = 365; }

    const startDate = moment().subtract(days, 'days').startOf('day').toDate();
    const leadWhere = isAdmin && !userId
      ? { isActive: true, createdAt: { [Op.gte]: startDate } }
      : { isActive: true, assignedToId: targetUserId, createdAt: { [Op.gte]: startDate } };
    const followupWhere = isAdmin && !userId
      ? { status: 'completed', completedAt: { [Op.gte]: startDate } }
      : { assignedToId: targetUserId, status: 'completed', completedAt: { [Op.gte]: startDate } };
    const conversionWhere = { ...leadWhere, status: 'converted', updatedAt: { [Op.gte]: startDate } };
    delete conversionWhere.createdAt;

    const groupDate = (col) => sequelize.fn('TO_CHAR', sequelize.col(col), fmt);

    const [leadsData, followupsData, conversionsData] = await Promise.all([
      Lead.findAll({
        where: leadWhere,
        attributes: [[groupDate('Lead.createdAt'), '_id'], [sequelize.fn('COUNT', sequelize.col('Lead.id')), 'count']],
        group: [groupDate('Lead.createdAt')],
        order: [[groupDate('Lead.createdAt'), 'ASC']],
        raw: true
      }),
      Followup.findAll({
        where: followupWhere,
        attributes: [[groupDate('Followup.completedAt'), '_id'], [sequelize.fn('COUNT', sequelize.col('Followup.id')), 'count']],
        group: [groupDate('Followup.completedAt')],
        order: [[groupDate('Followup.completedAt'), 'ASC']],
        raw: true
      }),
      Lead.findAll({
        where: conversionWhere,
        attributes: [[groupDate('Lead.updatedAt'), '_id'], [sequelize.fn('COUNT', sequelize.col('Lead.id')), 'count']],
        group: [groupDate('Lead.updatedAt')],
        order: [[groupDate('Lead.updatedAt'), 'ASC']],
        raw: true
      })
    ]);

    res.json({ success: true, leadsData, followupsData, conversionsData });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/dashboard/team-performance
exports.getTeamPerformance = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    const members = await User.findAll({
      where: { isActive: true, role: 'member' },
      attributes: ['id', 'name', 'email', 'avatar', 'stats', 'role']
    });

    const performance = await Promise.all(members.map(async (member) => {
      const todayStart = moment().startOf('day').toDate();
      const todayEnd = moment().endOf('day').toDate();
      const [totalLeads, converted, followupsToday, completedToday, missed] = await Promise.all([
        Lead.count({ where: { assignedToId: member.id, isActive: true } }),
        Lead.count({ where: { assignedToId: member.id, status: 'converted' } }),
        Followup.count({ where: { assignedToId: member.id, scheduledDate: { [Op.gte]: todayStart, [Op.lte]: todayEnd } } }),
        Followup.count({ where: { assignedToId: member.id, status: 'completed', completedAt: { [Op.gte]: todayStart } } }),
        Followup.count({ where: { assignedToId: member.id, status: 'missed' } })
      ]);
      return {
        _id: member.id, id: member.id, name: member.name, email: member.email,
        avatar: member.avatar, role: member.role,
        totalLeads, converted, followupsToday, completedToday, missed,
        conversionRate: totalLeads > 0 ? ((converted / totalLeads) * 100).toFixed(1) : 0
      };
    }));

    res.json({ success: true, performance });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/dashboard/notifications
exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { userId: req.user.id },
      include: [{ model: Lead, as: 'relatedLead', attributes: ['id', 'name', 'phone'] }],
      order: [['createdAt', 'DESC']],
      limit: 20
    });
    const unreadCount = await Notification.count({ where: { userId: req.user.id, isRead: false } });
    res.json({ success: true, notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/dashboard/notifications/read
exports.markNotificationsRead = async (req, res) => {
  try {
    await Notification.update(
      { isRead: true, readAt: new Date() },
      { where: { userId: req.user.id, isRead: false } }
    );
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/dashboard/lead-status-chart
exports.getLeadStatusChart = async (req, res) => {
  try {
    const isAdmin = req.user.role !== 'member';
    const where = isAdmin ? { isActive: true } : { isActive: true, assignedToId: req.user.id };
    const rows = await Lead.findAll({
      where,
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('Lead.id')), 'count']],
      group: ['status'],
      raw: true
    });
    const data = rows.map(r => ({ _id: r.status, count: parseInt(r.count) }));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
