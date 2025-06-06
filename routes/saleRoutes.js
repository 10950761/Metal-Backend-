const express = require('express');
const router = express.Router();
const { createSale, getSales, deleteSale,updateSale  } = require('../controllers/saleController');


router.post('/', createSale);
router.get('/', getSales);
router.delete('/:id', deleteSale);
router.put('/:id', updateSale);


module.exports = router;
