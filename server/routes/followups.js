const express = require('express');
const router = express.Router();
const {
  getFollowups, getTodayFollowups, getMissedFollowups,
  createFollowup, completeFollowup, rescheduleFollowup, getFollowupStats
} = require('../controllers/followup');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', getFollowups);
router.get('/today', getTodayFollowups);
router.get('/missed', getMissedFollowups);
router.get('/stats', getFollowupStats);
router.post('/', createFollowup);
router.put('/:id/complete', completeFollowup);
router.put('/:id/reschedule', rescheduleFollowup);

module.exports = router;
