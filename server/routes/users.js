const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const User = require('../models/User');
const { protect, adminOnly, managerOrAdmin } = require('../middleware/auth');

router.use(protect);

// GET all users
router.get('/', async (req, res) => {
  try {
    let where = { isActive: true };
    if (req.user.role === 'admin') {
      if (req.query.role) where.role = req.query.role;
    } else {
      where[Op.or] = [{ id: req.user.id }, { role: 'admin' }];
    }
    const users = await User.findAll({
      where,
      attributes: { exclude: ['password'] },
      order: [['name', 'ASC']]
    });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET user by ID
router.get('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.params.id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    const user = await User.findByPk(req.params.id, { attributes: { exclude: ['password'] } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update user
router.put('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.params.id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    const { name, phone, avatar, role } = req.body;
    const update = { name, phone, avatar };
    if (req.user.role === 'admin' && role) update.role = role;
    await User.update(update, { where: { id: req.params.id } });
    const user = await User.findByPk(req.params.id, { attributes: { exclude: ['password'] } });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT reset candidate password (admin only)
router.put('/:id/password', adminOnly, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    await user.update({ password });
    res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT update earnings
router.put('/:id/earnings', managerOrAdmin, async (req, res) => {
  try {
    await User.update({ earnings: req.body.earnings }, { where: { id: req.params.id } });
    const user = await User.findByPk(req.params.id, { attributes: { exclude: ['password'] } });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE / deactivate user
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    await User.update({ isActive: false }, { where: { id: req.params.id } });
    res.json({ success: true, message: 'Candidate disabled' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
