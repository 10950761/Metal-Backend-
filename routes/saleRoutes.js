const express = require('express');
const router = express.Router();
const { createSale, getSales, deleteSale,updateSale  } = require('../controllers/saleController');
const protect = require('../middleware/authMiddleware');

router.post('/', protect, createSale);
router.get('/', protect, getSales);
router.delete('/:id', protect, deleteSale);
router.put('/:id', protect, updateSale);

module.exports = router;
