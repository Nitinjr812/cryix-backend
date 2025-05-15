const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Register
router.post('/register', async (req, res) => {
  try { 
    const user = new User(req.body);
    await user.save();
    
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, balance: user.balance });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    // Add password verification in real app
    const user = await User.findOne({ username: req.body.username });
    if (!user) throw new Error('Invalid credentials');
    
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, balance: user.balance });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get user data
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    res.json({ balance: user.balance });
  } catch (err) {
    res.status(401).json({ message: 'Unauthorized' });
  }
});

module.exports = router;