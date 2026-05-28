const mongoose = require('mongoose');
const Lead = require('../../models/Lead');
const Followup = require('../../models/Followup');
const User = require('../../models/User');
const Notification = require('../../models/Notification');
const Message = require('../../models/Message');
const moment = require('moment');

// GET /api/dashboard/stats
exports.getStats = async (req, res) => {
  try {
    const isAdmin = req.user.role !== 'member';
    const userFilter = isAdmin ? {} : { assignedTo: req.user._id };

    const today = moment().startOf('day').toDate();
    const tomorrow = moment().endOf('day').toDate();
    const monthStart = moment().startOf('month').toDate();
    const weekStart = moment().startOf('week').toDate();

    const [
      totalLeads, newLeads, interestedLeads, convertedLeads,
      todayFollowups, pendingFollowups, missedFollowups,
      monthLeads, weekLeads, notSeenWebinar, unreadMessages
    ] = await Promise.all([
      Lead.countDocuments({ ...userFilter, isActive: true }),
      Lead.countDocuments({ ...userFilter, isActive: true, status: 'new' }),
      Lead.countDocuments({ ...userFilter, isActive: true, status: 'interested' }),
      Lead.countDocuments({ ...userFilter, isActive: true, status: 'converted' }),
      Followup.countDocuments({ ...(isAdmin ? {} : { assignedTo: req.user._id }), scheduledDate: { $gte: today, $lte: tomorrow } }),
      Followup.countDocuments({ ...(isAdmin ? {} : { assignedTo: req.user._id }), status: 'pending', scheduledDate: { $gte: today, $lte: tomorrow } }),
      Followup.countDocuments({ ...(isAdmin ? {} : { assignedTo: req.user._id }), status: 'missed' }),
      Lead.countDocuments({ ...userFilter, isActive: true, createdAt: { $gte: monthStart } }),
      Lead.countDocuments({ ...userFilter, isActive: true, createdAt: { $gte: weekStart } }),
      Lead.countDocuments({
        ...userFilter,
        isActive: true,
        webinarStatus: { $in: ['not_invited', 'missed', 'invited'] }
      }),
      Message.countDocuments({ to: req.user._id, isRead: false })
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
    const targetUser = isAdmin && userId ? userId : req.user._id;
    const filter = isAdmin && !userId ? {} : { assignedTo: targetUser };

    let dateFormat, groupBy, days;
    if (period === 'week') { dateFormat = '%Y-%m-%d'; days = 7; }
    else if (period === 'month') { dateFormat = '%Y-%m-%d'; days = 30; }
    else { dateFormat = '%Y-%m'; days = 365; }

    const startDate = moment().subtract(days, 'days').startOf('day').toDate();

    const [leadsData, followupsData, conversionsData] = await Promise.all([
      Lead.aggregate([
        { $match: { ...filter, isActive: true, createdAt: { $gte: startDate } } },
        { $group: { _id: { $dateToString: { format: dateFormat, date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      Followup.aggregate([
        { $match: { ...(isAdmin && !userId ? {} : { assignedTo: typeof targetUser === 'string' ? new mongoose.Types.ObjectId(targetUser) : targetUser }), status: 'completed', completedAt: { $gte: startDate } } },
        { $group: { _id: { $dateToString: { format: dateFormat, date: '$completedAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      Lead.aggregate([
        { $match: { ...filter, isActive: true, status: 'converted', updatedAt: { $gte: startDate } } },
        { $group: { _id: { $dateToString: { format: dateFormat, date: '$updatedAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ])
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
    const monthStart = moment().startOf('month').toDate();
    const members = await User.find({ isActive: true, role: 'member' }).select('name email avatar stats role');

    const performance = await Promise.all(members.map(async (member) => {
      const [totalLeads, converted, followupsToday, completedToday, missed] = await Promise.all([
        Lead.countDocuments({ assignedTo: member._id, isActive: true }),
        Lead.countDocuments({ assignedTo: member._id, status: 'converted' }),
        Followup.countDocuments({
          assignedTo: member._id,
          scheduledDate: { $gte: moment().startOf('day').toDate(), $lte: moment().endOf('day').toDate() }
        }),
        Followup.countDocuments({
          assignedTo: member._id,
          status: 'completed',
          completedAt: { $gte: moment().startOf('day').toDate() }
        }),
        Followup.countDocuments({ assignedTo: member._id, status: 'missed' })
      ]);

      return {
        _id: member._id, name: member.name, email: member.email,
        avatar: member.avatar, role: member.role,
        totalLeads, converted, followupsToday, completedToday, missed,
        conversionRate: totalLeads > 0 ? ((converted / totalLeads) * 100).toFixed(1) : 0,
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
    const notifications = await Notification.find({ user: req.user._id })
      .populate('relatedLead', 'name phone')
      .sort({ createdAt: -1 })
      .limit(20);
    const unreadCount = await Notification.countDocuments({ user: req.user._id, isRead: false });
    res.json({ success: true, notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/dashboard/notifications/read
exports.markNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true, readAt: new Date() });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/dashboard/lead-status-chart
exports.getLeadStatusChart = async (req, res) => {
  try {
    const isAdmin = req.user.role !== 'member';
    const filter = isAdmin ? { isActive: true } : { isActive: true, assignedTo: req.user._id };
    const data = await Lead.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
