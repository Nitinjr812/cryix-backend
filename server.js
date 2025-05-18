const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'nitinisnitinis82828282828337dhbhhnjj@sihcewofobbacbskjnxjskbdjwqbdw'; // Change this to a secure random string in production

// Middleware
app.use(express.json());
app.use(cors({
  origin: '*', // Allow any origin in development - restrict this in production
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Improved MongoDB Connection with options
mongoose.connect('mongodb+srv://nitin:Oio3pg0yQy4UQR8W@cluster0.lgmyvk0.mongodb.net/cryvix', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  // Don't exit process on Vercel - it will restart the function
  // Just log the error and continue
});

// Define User Schema directly in server.js if you don't have a separate model file
// (You can move this to models/user.js if you prefer)
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  balance: { type: Number, default: 0 },
  referralCode: { type: String, unique: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  miningBonus: { type: Number, default: 0 },
  nextMineTime: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

// Generate a unique referral code before saving
userSchema.pre('save', function(next) {
  if (!this.referralCode) {
    // Generate a random 8-character referral code
    this.referralCode = crypto.randomBytes(4).toString('hex');
  }
  next();
});

// Create the User model
const User = mongoose.model('User', userSchema);

// Authentication Middleware
const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authorization token required' });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid authorization token' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ success: false, message: 'Authentication failed' });
  }
};

// Register with referral
app.post('/register', async (req, res) => {
  try {
    console.log('Registration attempt with data:', {
      username: req.body.username,
      email: req.body.email,
      hasPassword: !!req.body.password,
      referralCode: req.body.referralCode
    });

    const { username, email, password, referralCode } = req.body;
    
    // Validate inputs
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or username already exists'
      });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Create new user
    const user = new User({
      username,
      email,
      password: hashedPassword,
      balance: 0,
      miningBonus: 0,
      referrals: [],
      nextMineTime: new Date()
    });
  
    // Process referral if provided
    if (referralCode) {
      console.log('Processing referral code:', referralCode);
      const referrer = await User.findOne({ referralCode });
      
      if (referrer) {
        console.log('Referrer found:', referrer.username);
        // Set referredBy field
        user.referredBy = referrer._id;
        
        // Give the new user a mining bonus
        user.miningBonus = 0.2; // 0.2 additional coins per mining
        
        // Add user to referrer's referrals list
        referrer.referrals.push(user._id);
        
        // Give referrer a reward
        referrer.balance += 5; // 5 coins reward
        
        await referrer.save();
        console.log('Referrer updated successfully');
      } else {
        console.log('No referrer found with code:', referralCode);
      }
    }
    
    console.log('Saving new user');
    await user.save();
    console.log('User saved successfully');
    
    res.status(201).json({
      success: true,
      message: referralCode ? 'User registered successfully with referral bonus!' : 'User registered successfully'
    });
  } catch (error) {
    console.error('Registration error:', error.message);
    console.error('Full error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message // Remove this in production
    });
  }
});

// Login
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }
    
    // Find user
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid username or password'
      });
    }
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Invalid username or password'
      });
    }
    
    // Generate token
    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      message: 'Login successful',
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// Get user data including referrals
app.get('/user', auth, async (req, res) => {
  try {
    // Populate referrals with username and balance
    await req.user.populate({
      path: 'referrals',
      select: 'username balance createdAt'
    });
    
    // Populate referredBy with username
    await req.user.populate({
      path: 'referredBy',
      select: 'username'
    });
    
    const user = {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      balance: req.user.balance,
      nextMineTime: req.user.nextMineTime,
      referralCode: req.user.referralCode,
      referredBy: req.user.referredBy,
      referrals: req.user.referrals,
      miningBonus: req.user.miningBonus,
      createdAt: req.user.createdAt
    };
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('User data fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user data'
    });
  }
});

// Mine coin with 10-second mining process and 12-hour cooldown
app.post('/mine', auth, async (req, res) => {
  try {
    const user = req.user;
    const now = new Date();
    
    // Check if mining is available
    if (now < user.nextMineTime) {
      return res.status(400).json({
        success: false,
        message: 'Mining not available yet. Please wait until the cooldown period ends.'
      });
    }
    
    // Calculate mining reward (1 coin + any bonus from referrals)
    const miningReward = 1 + (user.miningBonus || 0);
    
    // Update user balance
    user.balance += miningReward;
    
    // Set next mine time to 12 hours from now
    user.nextMineTime = new Date(now.getTime() + (12 * 60 * 60 * 1000)); // 12 hours cooldown
    
    await user.save();
    
    res.json({
      success: true,
      message: `Mining successful! You earned ${miningReward} coins. Next mining available in 12 hours.`,
      newBalance: user.balance,
      nextMineTime: user.nextMineTime
    });
  } catch (error) {
    console.error('Mining error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during mining operation'
    });
  }
});

// Get user's team (referrals) details
app.get('/team', auth, async (req, res) => {
  try {
    // Populate referrals with more details
    await req.user.populate({
      path: 'referrals',
      select: 'username balance createdAt'
    });
    
    res.json({
      success: true,
      team: req.user.referrals
    });
  } catch (error) {
    console.error('Team fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching team data'
    });
  }
});

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    status: true,
    message: "Server is running"
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Handle 404s
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});