const express = require('express');
const router = express.Router();

const { getStock } = require('../controllers/stockController');

router.get('/', getStock);

module.exports = router;
