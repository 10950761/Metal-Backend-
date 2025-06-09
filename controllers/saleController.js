const Sale = require('../models/Sales');
const Stock = require('../models/Stock');

// Create Sale
const createSale = async (req, res) => {
  try {
    const { customerName, customerNumber, date, time, productName, price, quantity } = req.body;

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
      user: req.user._id 
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
    const { history } = req.query;
    
    if (history) {
      const sales = await Sale.find({
        user: req.user._id
      }).sort({ createdAt: -1 });
      return res.status(200).json(sales);
    } else {
      const sales = await Sale.find({
        user: req.user._id,
        deleted: false
      }).sort({ createdAt: -1 });
      return res.status(200).json(sales);
    }
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch sales.' });
  }
};

// New endpoint for deleting old sales
const deleteOldSales = async (req, res) => {
  try {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const result = await Sale.deleteMany({
      deleted: true,
      deletedAt: { $lt: threeDaysAgo }
    });

    res.status(200).json({
      message: `Deleted ${result.deletedCount} old sales`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete old sales.' });
  }
};


// Delete Sale
  const deleteSale = async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await Sale.findById(id);
    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    if (!sale.deleted) {
      return res.status(403).json({ message: "Cannot delete permanently before soft-deleting." });
    }

    if (!sale.deletedAt) {
      return res.status(403).json({ message: "Deletion timestamp missing." });
    }

    const deletedAt = new Date(sale.deletedAt);
    const now = new Date();
    const diffDays = (now - deletedAt) / (1000 * 60 * 60 * 24);

    if (diffDays < 3) {
      return res.status(403).json({ message: "Cannot delete permanently before 3 days." });
    }

    await Sale.findByIdAndDelete(id);
    res.json({ message: "Sale permanently deleted." });

  } catch (error) {
    console.error('Error deleting sale:', error);
    res.status(500).json({ message: "Error deleting sale" });
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

const softDeleteSale = async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await Sale.findById(id);
    if (!sale) {
      return res.status(404).json({ message: "Sale not found." });
    }

    if (sale.deleted) {
      return res.status(400).json({ message: "Sale already soft-deleted." });
    }

    sale.deleted = true;
    sale.deletedAt = new Date();
    await sale.save();

    res.status(200).json({ message: "Sale soft-deleted." });
  } catch (err) {
    console.error("Soft delete error:", err);
    res.status(500).json({ message: "Failed to soft delete sale." });
  }
};

module.exports = {
  createSale,
  getSales,
  deleteSale,
  updateSale,
  softDeleteSale,
  deleteOldSales
};
