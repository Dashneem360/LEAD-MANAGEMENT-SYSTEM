const jwt = require('jsonwebtoken');
const User = require('../../models/User');

const publicUser = (user) => ({
  id: user.id,
  _id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  phone: user.phone,
  companyCode: user.companyCode,
  candidateId: user.candidateId
});

const generateToken = (user) => jwt.sign({
  id: user.id,
  role: user.role,
  companyCode: user.companyCode,
  candidateId: user.candidateId
}, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

const nextCandidateId = () => `CAND-${Date.now().toString(36).toUpperCase()}`;

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    const existing = await User.findOne({ where: { email: email?.toLowerCase() } });
    if (existing && existing.isActive) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    let user;
    const userData = {
      name,
      email,
      password,
      phone,
      role: 'member',
      companyCode: req.user?.companyCode || req.body.companyCode || 'DASHNEEM',
      isActive: true
    };

    if (existing) {
      userData.candidateId = existing.candidateId || req.body.candidateId || nextCandidateId();
      await existing.update(userData);
      user = existing;
    } else {
      userData.candidateId = req.body.candidateId || nextCandidateId();
      user = await User.create(userData);
    }

    const token = generateToken(user);
    res.status(201).json({ success: true, token, user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Please provide email and password' });

    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user || !user.isActive || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.companyCode) await user.update({ companyCode: 'DASHNEEM' });
    await user.update({ lastLogin: new Date() });

    const token = generateToken(user);
    res.json({ success: true, token, user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/auth/update-password
exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }
    if (!(await user.matchPassword(currentPassword))) {
      return res.status(401).json({ success: false, message: 'Current password incorrect' });
    }
    await user.update({ password: newPassword });
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
