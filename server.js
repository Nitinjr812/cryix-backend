require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();

// Middleware
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI + 'cryvix', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// User Model
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 },
    lastMined: { type: Date },
    referrals: { type: Number, default: 0 }
}));

// Auth Middleware
const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Invalid token' });
    }
};

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, password: hashedPassword });
        await user.save();

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '2d' });
        res.json({ token, balance: user.balance });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) throw new Error('Invalid credentials');

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) throw new Error('Invalid credentials');

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, balance: user.balance });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        res.json({ balance: user.balance });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get('/api/mining/status', authenticate, async (req, res) => {
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

app.post('/api/mining/mine', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.userId);

        if (user.lastMined) {
            const twelveHoursInMs = 12 * 60 * 60 * 1000;
            const nextMineTime = new Date(user.lastMined).getTime() + twelveHoursInMs;

            if (Date.now() < nextMineTime) {
                return res.status(400).json({
                    message: 'Mining cooldown active',
                    nextMine: new Date(nextMineTime)
                });
            }
        }

        user.balance += parseFloat(process.env.MINING_REWARD || '1.0');
        user.lastMined = new Date();
        await user.save();

        res.json({
            newBalance: user.balance,
            lastMined: user.lastMined
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));