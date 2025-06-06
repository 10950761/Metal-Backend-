const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');

router.post('/', purchaseController.createPurchase);
router.get('/', purchaseController.getPurchases);
router.delete('/:id', purchaseController.deletePurchase);
router.put('/:id', purchaseController.updatePurchase);

module.exports = router;
