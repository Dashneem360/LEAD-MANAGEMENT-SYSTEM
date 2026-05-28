const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, adminOnly, managerOrAdmin } = require('../middleware/auth');

router.use(protect);

// GET all users (team members)
router.get('/', async (req, res) => {
  try {
    const query = req.user.role === 'admin'
      ? { isActive: true }
      : { isActive: true, $or: [{ _id: req.user._id }, { role: 'admin' }] };
    if (req.user.role === 'admin' && req.query.role) query.role = req.query.role;
    const users = await User.find(query).select('-password').sort({ name: 1 });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET user by ID
router.get('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.params.id !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update user
router.put('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.params.id !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    const { name, phone, avatar, role } = req.body;
    const update = { name, phone, avatar };
    if (req.user.role === 'admin' && role) update.role = role;
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password');
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT reset candidate password
router.put('/:id/password', adminOnly, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.password = password;
    await user.save();
    res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update earnings
router.put('/:id/earnings', managerOrAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { earnings: req.body.earnings }, { new: true }).select('-password');
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE / deactivate user
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Candidate disabled' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
