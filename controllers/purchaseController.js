const Purchase = require('../models/Purchases');
const Stock = require('../models/Stock');

const createPurchase = async (req, res) => {
  try {
    const {
      supplierName,
      supplierLocation,
      supplierCompany,
      date,
      time,
      productName,
      productQuantity,
      price,
      notes,
    } = req.body;

    const quantity = parseInt(productQuantity);

    if (!productName || isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({ message: 'Invalid product name or quantity.' });
    }

    const newPurchase = new Purchase({
      supplierName,
      supplierLocation,
      supplierCompany,
      date,
      time,
      productName,
      productQuantity: quantity,
      price,
      notes,
    });

    await newPurchase.save();

    let stock = await Stock.findOne({ productName });

    if (stock) {
      stock.quantity += quantity;
      await stock.save();
    } else {
      stock = new Stock({ productName, quantity });
      await stock.save();
    }

    res.status(201).json({ message: 'Purchase and stock recorded successfully', purchase: newPurchase });
  } catch (error) {
    console.error('Error creating purchase:', error);
    res.status(500).json({ message: 'Failed to record purchase' });
  }
};

const getPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find().sort({ createdAt: -1 });
    res.status(200).json(purchases);
  } catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({ message: 'Failed to fetch purchases' });
  }
};

const deletePurchase = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) return res.status(404).json({ error: "Purchase not found" });

    // Subtract from stock
    await Stock.updateOne(
      { productName: purchase.productName },
      { $inc: { quantity: -purchase.productQuantity } }
    );

    await Purchase.findByIdAndDelete(req.params.id);
    res.json({ message: "Purchase deleted and stock updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updatePurchase = async (req, res) => {
  try {
    const existingPurchase = await Purchase.findById(req.params.id);
    if (!existingPurchase) return res.status(404).json({ error: "Purchase not found" });

    const updatedQuantity = parseInt(req.body.productQuantity);
    if (!req.body.productName || isNaN(updatedQuantity) || updatedQuantity <= 0) {
      return res.status(400).json({ message: 'Invalid updated product name or quantity.' });
    }

    // Revert previous stock quantity
    await Stock.updateOne(
      { productName: existingPurchase.productName },
      { $inc: { quantity: -existingPurchase.productQuantity } }
    );

    // Update the purchase
    const updatedPurchase = await Purchase.findByIdAndUpdate(
      req.params.id,
      { ...req.body, productQuantity: updatedQuantity },
      { new: true }
    );

    // Add new stock quantity
    await Stock.updateOne(
      { productName: updatedPurchase.productName },
      { $inc: { quantity: updatedPurchase.productQuantity } }
    );

    res.json(updatedPurchase);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createPurchase,
  getPurchases,
  deletePurchase,
  updatePurchase
};