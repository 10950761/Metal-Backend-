const express = require('express');
const router = express.Router();

const { getStock, bulkUpsertStock  } = require('../controllers/stockController');
const protect = require('../middleware/authMiddleware');

router.get('/', protect, getStock);
router.post('/bulk', protect, bulkUpsertStock);


module.exports = router;
