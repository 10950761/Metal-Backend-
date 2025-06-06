const Sale = require('../models/Sales');
const Stock = require('../models/Stock');

// Create Sale
const createSale = async (req, res) => {
  try {
    const { customerName, customerNumber, date, time, productName, price, quantity, totalPrice } = req.body;

    const stock = await Stock.findOne({
      productName: { $regex: new RegExp(`^${productName}$`, 'i') }
    });

    if (!stock) {
      return res.status(404).json({ message: 'Product not found in stock.' });
    }

    if (quantity <= 0) {
      return res.status(400).json({ message: 'Quantity must be positive.' });
    }

    if (stock.quantity <= 0) {
      return res.status(400).json({ message: 'Stock is empty. Cannot proceed with sale.' });
    }

    if (stock.quantity < quantity) {
      return res.status(400).json({
        message: `Insufficient stock. Only ${stock.quantity} available.`,
        available: stock.quantity
      });
    }

    // Deduct from stock
    stock.quantity -= quantity;
    await stock.save();

    const sale = new Sale({
      customerName,
      customerNumber,
      date,
      time,
      productName,
      price,
      quantity,
      totalPrice
    });

    await sale.save();

    res.status(201).json({ message: 'Sale created and stock updated successfully.', sale });
  } catch (error) {
    console.error('Error creating sale:', error);
    res.status(500).json({ message: 'Failed to create sale.' });
  }
};

// Get All Sales
const getSales = async (req, res) => {
  try {
    const sales = await Sale.find().sort({ createdAt: -1 });
    res.status(200).json(sales);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch sales.' });
  }
};

// Delete Sale
const deleteSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ error: "Sale not found" });

    // Restore quantity to stock
    await Stock.updateOne(
      { productName: { $regex: new RegExp(`^${sale.productName}$`, 'i') } },
      { $inc: { quantity: sale.quantity } }
    );

    await Sale.findByIdAndDelete(req.params.id);
    res.json({ message: "Sale deleted and stock restored" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update Sale
const updateSale = async (req, res) => {
  try {
    const existingSale = await Sale.findById(req.params.id);
    if (!existingSale) return res.status(404).json({ error: "Sale not found" });

    const updatedQuantity = parseInt(req.body.quantity);
    const updatedProductName = req.body.productName;

    if (!updatedProductName || isNaN(updatedQuantity) || updatedQuantity <= 0) {
      return res.status(400).json({ message: 'Invalid product name or quantity.' });
    }

    // Restore previous quantity to stock
    await Stock.updateOne(
      { productName: { $regex: new RegExp(`^${existingSale.productName}$`, 'i') } },
      { $inc: { quantity: existingSale.quantity } }
    );

    // Check stock availability for new product and quantity
    const stock = await Stock.findOne({
      productName: { $regex: new RegExp(`^${updatedProductName}$`, 'i') }
    });

    if (!stock || stock.quantity < updatedQuantity) {
      // Rollback: re-deduct the original sale quantity to maintain integrity
      await Stock.updateOne(
        { productName: { $regex: new RegExp(`^${existingSale.productName}$`, 'i') } },
        { $inc: { quantity: -existingSale.quantity } }
      );

      return res.status(400).json({
        message: `Insufficient stock. Only ${stock ? stock.quantity : 0} available.`,
        available: stock ? stock.quantity : 0
      });
    }

    // Update sale record
    const updatedSale = await Sale.findByIdAndUpdate(
      req.params.id,
      { ...req.body, quantity: updatedQuantity },
      { new: true }
    );

    // Deduct updated quantity from stock
    await Stock.updateOne(
      { productName: { $regex: new RegExp(`^${updatedSale.productName}$`, 'i') } },
      { $inc: { quantity: -updatedSale.quantity } }
    );

    res.json({ message: 'Sale updated and stock adjusted.', updatedSale });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createSale,
  getSales,
  deleteSale,
  updateSale
};
