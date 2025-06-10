const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

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
    console.error(error);
    res.status(500).json({ message: 'Server error' });
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
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.googleLogin = async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, message: 'Token missing' });
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const { email, name, sub: googleId, email_verified } = ticket.getPayload();

    if (!email_verified) {
      return res.status(403).json({ success: false, message: 'Email not verified' });
    }

    let user = await User.findOne({ 
      $or: [{ email }, { googleId }] 
    });

    if (!user) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(googleId, salt);
      
      user = await User.create({
        username: name || email.split('@')[0],
        email,
        password: hashedPassword,
        googleId,
        authMethod: 'google'
      });
    }

    return res.json({
      success: true,
      message: 'Google login successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      },
      token: generateToken(user._id)
    });

  } catch (error) {
    console.error('Google auth error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Authentication failed',
      error: error.message 
    });
  }
};