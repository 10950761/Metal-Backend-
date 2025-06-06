const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const protect = require('../middleware/authMiddleware');

router.post('/register', UserController.register);
router.post('/login', UserController.login);
router.get("/profile", protect, async (req, res) => {
  res.json(req.user); 
});

module.exports = router;
