const jwt = require('jsonwebtoken');
const User = require('../../models/User');

const publicUser = (user) => ({
  id: user._id,
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  phone: user.phone,
  companyCode: user.companyCode,
  candidateId: user.candidateId
});

const generateToken = (user) => jwt.sign({
  id: user._id,
  role: user.role,
  companyCode: user.companyCode,
  candidateId: user.candidateId
}, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

const nextCandidateId = () => `CAND-${Date.now().toString(36).toUpperCase()}`;

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    const existing = await User.findOne({ email });
    if (existing && existing.isActive) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const user = existing || new User();
    user.name = name;
    user.email = email;
    user.password = password;
    user.phone = phone;
    user.role = 'member';
    user.companyCode = req.user?.companyCode || req.body.companyCode || 'DASHNEEM';
    user.candidateId = user.candidateId || req.body.candidateId || nextCandidateId();
    user.isActive = true;
    await user.save();

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
    const user = await User.findOne({ email });
    if (!user || !user.isActive || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (!user.companyCode) user.companyCode = 'DASHNEEM';
    user.lastLogin = new Date();
    await user.save();
    const token = generateToken(user);
    res.json({ success: true, token, user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/auth/update-password
exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }
    if (!(await user.matchPassword(currentPassword))) {
      return res.status(401).json({ success: false, message: 'Current password incorrect' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
