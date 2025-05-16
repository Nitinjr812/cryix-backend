
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    balance: {
        type: Number,
        default: 0
    },
    nextMineTime: {
        type: Date,
        default: Date.now
    },
    referralCode: {
        type: String,
        unique: true
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    referrals: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    miningBonus: {
        type: Number,
        default: 0 // Additional coins per mining operation
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Generate unique referral code before saving
userSchema.pre('save', async function (next) {
    if (!this.referralCode) {
        // Generate a unique referral code based on username and random string
        this.referralCode = this.username.substring(0, 3).toUpperCase() +
            Math.random().toString(36).substring(2, 7).toUpperCase();
    }
    next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;