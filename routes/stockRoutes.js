const express = require('express');
const router = express.Router();

const { getStock } = require('../controllers/stockController');
const protect = require('../middleware/authMiddleware');

router.get('/', protect, getStock);

module.exports = router;
