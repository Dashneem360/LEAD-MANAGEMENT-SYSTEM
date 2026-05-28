const express = require('express');
const router = express.Router();
const {
  getStats, getGrowthChart, getTeamPerformance,
  getNotifications, markNotificationsRead, getLeadStatusChart
} = require('../controllers/dashboard');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/stats', getStats);
router.get('/growth-chart', getGrowthChart);
router.get('/team-performance', getTeamPerformance);
router.get('/lead-status-chart', getLeadStatusChart);
router.get('/notifications', getNotifications);
router.put('/notifications/read', markNotificationsRead);

module.exports = router;
