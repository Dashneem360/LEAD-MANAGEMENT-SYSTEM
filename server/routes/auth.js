const express = require('express');
const router = express.Router();
const { register, login, getMe, updatePassword } = require('../controllers/auth');
const { protect, adminOnly } = require('../middleware/auth');

router.post('/register', protect, adminOnly, register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/update-password', protect, updatePassword);

module.exports = router;
