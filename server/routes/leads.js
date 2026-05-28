const express = require('express');
const router = express.Router();
const {
  getLeads, getLead, createLead, updateLead, deleteLead,
  addRemark, assignLead, updateWebinarStatus, bulkImport, getTodayCallingList
} = require('../controllers/lead');
const { protect, managerOrAdmin } = require('../middleware/auth');

router.use(protect);
router.get('/', getLeads);
router.get('/today-calling', getTodayCallingList);
router.get('/:id', getLead);
router.post('/', createLead);
router.post('/bulk-import', managerOrAdmin, bulkImport);
router.put('/:id', updateLead);
router.delete('/:id', managerOrAdmin, deleteLead);
router.post('/:id/remark', addRemark);
router.put('/:id/assign', managerOrAdmin, assignLead);
router.put('/:id/webinar', updateWebinarStatus);

module.exports = router;
