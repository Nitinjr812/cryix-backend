const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
 
const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Unauthorized' });
  }
};

// Mine endpoint
router.post('/mine', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId); 
    if (user.lastMined && Date.now() - user.lastMined.getTime() < 12 * 60 * 60 * 1000) {
      return res.status(400).json({ message: 'Mining cooldown active' });
    }
    
    user.balance += 1;
    user.lastMined = new Date();
    await user.save();
    
    res.json({ newBalance: user.balance });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
 
router.get('/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    res.json({ 
      balance: user.balance,
      lastMined: user.lastMined 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;