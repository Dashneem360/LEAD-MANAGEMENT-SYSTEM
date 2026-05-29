const jwt = require('jsonwebtoken');
const User = require('../../models/User');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findByPk(decoded.id, { attributes: { exclude: ['password'] } });
    if (!req.user) return res.status(401).json({ success: false, message: 'User not found' });
    if (!req.user.isActive) return res.status(401).json({ success: false, message: 'User inactive' });
    if (!req.user.companyCode) req.user.companyCode = 'DASHNEEM';
    req.tokenData = {
      id: decoded.id,
      role: decoded.role,
      companyCode: decoded.companyCode || req.user.companyCode,
      candidateId: decoded.candidateId || req.user.candidateId
    };
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ success: false, message: 'Admin access required' });
};

const managerOrAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'manager')) return next();
  return res.status(403).json({ success: false, message: 'Manager or admin access required' });
};

module.exports = { protect, adminOnly, managerOrAdmin };
