const express = require('express');
const router = express.Router();
const { getWebinars, createWebinar, updateWebinar, deleteWebinar, markAttendance, sendWebinarInvites, getNotSeenLeads } = require('../controllers/webinar');
const { protect, managerOrAdmin } = require('../middleware/auth');

router.use(protect);
router.get('/', getWebinars);
router.post('/', managerOrAdmin, createWebinar);
router.put('/:id', managerOrAdmin, updateWebinar);
router.delete('/:id', managerOrAdmin, deleteWebinar);
router.put('/:id/mark-attendance', markAttendance);
router.post('/:id/send-invites', managerOrAdmin, sendWebinarInvites);
router.get('/not-seen-leads', getNotSeenLeads);

module.exports = router;
