// userController.js 
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); 
const { OAuth2Client } = require('google-auth-library');
const dotenv = require('dotenv');
dotenv.config();


const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1d' });
};

exports.register = async (req, res) => {
  const { username, email, password, confirmpassword } = req.body;

  if (!username || !email || !password || !confirmpassword) {
    return res.status(400).json({ message: 'Please fill all fields' });
  }

  if (password !== confirmpassword) {
    return res.status(400).json({ message: 'Passwords do not match' });
  }

  try {
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }

    const user = await User.create({ username, email, password });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.login = async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Please fill all fields' });
  }

  try {
    const user = await User.findOne({ username, email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.googleLogin = async (req, res) => {
  const { token } = req.body;

  console.log('Google login attempt with token:', token ? 'Token received' : 'No token');

  if (!token) {
    return res.status(400).json({ 
      success: false, 
      message: 'Token missing' 
    });
  }

  try {
    // Verify the Google token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID, 
    });

    const payload = ticket.getPayload();
    const { email, name, sub: googleId, email_verified } = payload;

    console.log('Google token verified for email:', email);

    if (!email_verified) {
      return res.status(403).json({ 
        success: false, 
        message: 'Email not verified with Google' 
      });
    }

    // Check if user already exists
    let user = await User.findOne({ 
      $or: [{ email }, { googleId }] 
    });

    if (user) {
      console.log('Existing user found:', user.email);
      
      // Update googleId if it's missing
      if (!user.googleId) {
        user.googleId = googleId;
        user.authMethod = 'google';
        await user.save();
      }
    } else {
      console.log('Creating new user for:', email);
      
      // Generate unique username
      let username = name || email.split('@')[0];
      const existingUsername = await User.findOne({ username });
      
      if (existingUsername) {
        username = `${username}_${Date.now()}`;  // Make it unique
      }

      // Create new user with Google data
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(googleId + process.env.JWT_SECRET, salt);
      
      user = await User.create({
        username,
        email,
        password: hashedPassword,
        googleId,
        authMethod: 'google'
      });

      console.log('New user created:', user.email);
    }

    const jwtToken = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Google login successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        authMethod: user.authMethod
      },
      token: jwtToken
    });

  } catch (error) {
    console.error('Google auth error:', error);
    
    // More specific error handling
    if (error.message.includes('Token used too early')) {
      return res.status(400).json({ 
        success: false,
        message: 'Token timing error. Please try again.',
        error: 'TOKEN_TIMING_ERROR'
      });
    }
    
    if (error.message.includes('Invalid token')) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid Google token',
        error: 'INVALID_TOKEN'
      });
    }

    return res.status(500).json({ 
      success: false,
      message: 'Authentication failed',
      error: error.message 
    });
  }
};