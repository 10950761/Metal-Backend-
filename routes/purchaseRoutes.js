const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');
const protect = require('../middleware/authMiddleware');

router.post('/', protect, purchaseController.createPurchase);
router.get('/', protect, purchaseController.getPurchases);
router.delete('/:id', protect, purchaseController.deletePurchase);
router.put('/:id', protect, purchaseController.updatePurchase);
router.delete('/old', protect, purchaseController.deleteOldPurchases);
router.patch('/:id', protect, purchaseController.softDeletePurchase);

module.exports = router;
