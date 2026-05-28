const followupService = require('./service');

const sendError = (res, err) => {
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message
  });
};

exports.getFollowups = async (req, res) => {
  try {
    const data = await followupService.getFollowups(req.user, req.query);
    res.json({ success: true, ...data });
  } catch (err) {
    sendError(res, err);
  }
};

exports.getTodayFollowups = async (req, res) => {
  try {
    const data = await followupService.getTodayFollowups(req.user);
    res.json({ success: true, ...data });
  } catch (err) {
    sendError(res, err);
  }
};

exports.getMissedFollowups = async (req, res) => {
  try {
    const data = await followupService.getMissedFollowups(req.user);
    res.json({ success: true, ...data });
  } catch (err) {
    sendError(res, err);
  }
};

exports.createFollowup = async (req, res) => {
  try {
    const followup = await followupService.createFollowup(req.user, req.body);
    res.status(201).json({ success: true, followup });
  } catch (err) {
    sendError(res, err);
  }
};

exports.completeFollowup = async (req, res) => {
  try {
    const followup = await followupService.completeFollowup(req.user, req.params.id, req.body);
    res.json({ success: true, followup });
  } catch (err) {
    sendError(res, err);
  }
};

exports.rescheduleFollowup = async (req, res) => {
  try {
    const followup = await followupService.rescheduleFollowup(req.user, req.params.id, req.body);
    res.json({ success: true, followup });
  } catch (err) {
    sendError(res, err);
  }
};

exports.getFollowupStats = async (req, res) => {
  try {
    const data = await followupService.getFollowupStats(req.user);
    res.json({ success: true, ...data });
  } catch (err) {
    sendError(res, err);
  }
};
