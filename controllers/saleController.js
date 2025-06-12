const Sale = require("../models/Sales");
const Stock = require("../models/Stock");
const Notification = require("../models/Notification");
const User = require("../models/User");
const sendSaleEmail = require('../utils/sendEmail');
const mongoose = require('mongoose')

// CREATE SALE
const createSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { 
      customerName, 
      customerNumber, 
      date, 
      time, 
      productName, 
      price, 
      quantity 
    } = req.body;

    // Input validation
    const trimmedProductName = productName ? productName.trim() : '';
    const saleQuantity = parseFloat(quantity);
    const salePrice = parseFloat(price);

    if (!trimmedProductName || isNaN(saleQuantity) || saleQuantity <= 0 || 
        isNaN(salePrice) || salePrice <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false,
        message: 'Invalid product name, quantity or price.' 
      });
    }

    // Check stock availability
    const stockItem = await Stock.findOne({ 
      productName: trimmedProductName,
      user: req.user._id
    }).session(session);

    if (!stockItem) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ 
        success: false,
        message: 'Product not found in stock.' 
      });
    }

    if (stockItem.quantity < saleQuantity) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Only ${stockItem.quantity} available.`,
        available: stockItem.quantity
      });
    }

    // Create sale record
    const sale = new Sale({
      customerName: customerName?.trim(),
      customerNumber: customerNumber?.trim(),
      date,
      time,
      productName: trimmedProductName,
      price: salePrice,
      quantity: saleQuantity,
      user: req.user._id
    });

    await sale.save({ session });

    // Update stock
    const updatedStock = await Stock.handleSale(
      trimmedProductName,
      saleQuantity,
      req.user._id,
      sale._id,
      session
    );

    // Get user details for notification
    const user = await User.findById(req.user._id).session(session);

    // Create notification
    await Notification.create([{
      user: req.user._id,
      message: `Sale recorded for ${trimmedProductName} (${saleQuantity} @ ${salePrice})`,
      read: false
    }], { session });

    // Update stock price history with sale reference
    await Stock.updateOne(
      { _id: updatedStock._id },
      { $push: { 
        priceHistory: {
          date: new Date(),
          price: updatedStock.unitPrice,
          type: 'sale',
          referenceId: sale._id
        }
      }},
      { session }
    );

    // Commit transaction if all operations succeeded
    await session.commitTransaction();
    session.endSession();

    // Send email (outside transaction)
    try {
     await sendSaleEmail(
  user.email,
  trimmedProductName,
  saleQuantity,
  salePrice,
  customerName,
  customerNumber,
  time,
  date
);
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      // Don't fail the request just because email failed
    }

    return res.status(201).json({ 
      success: true,
      message: 'Sale created and stock updated successfully.', 
      sale,
      stock: updatedStock
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error creating sale:', error);
    return res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to create sale.' 
    });
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      user: req.user._id,
      read: false
    });
    return res.json({ success: true, count });
  } catch (error) {
    console.error('Error getting unread count:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Failed to get unread notifications count' 
    });
  }
};


// Delete Sales
const deleteSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    // Find current stock
    const stockItem = await Stock.findOne({ 
      productName: sale.productName.trim(),
      user: req.user._id
    });

    if (!stockItem) {
      return res.status(404).json({ message: "Product not found in stock" });
    }

    // Restore the quantity without changing unit price
    const updatedStock = await Stock.findOneAndUpdate(
      { _id: stockItem._id },
      {
        $inc: { quantity: sale.quantity },
        $set: { 
          totalValue: (stockItem.quantity + sale.quantity) * stockItem.unitPrice,
          lastUpdated: Date.now()
        },
        $push: {
          priceHistory: {
            date: new Date(),
            price: stockItem.unitPrice, 
            type: 'adjustment',
            referenceId: sale._id
          }
        }
      },
      { new: true }
    );

    await Sale.findByIdAndDelete(req.params.id);

    res.json({ 
      message: "Sale deleted and stock quantity restored",
      stock: updatedStock
    });
  } catch (error) {
    console.error('Error deleting sale:', error);
    res.status(500).json({ 
      message: error.message || "Error deleting sale" 
    });
  }
};
// UPDATE SALE
const updateSale = async (req, res) => {
  try {
    const existingSale = await Sale.findById(req.params.id);
    if (!existingSale) {
      return res.status(404).json({ error: "Sale not found" });
    }

    const updatedQuantity = parseFloat(req.body.quantity);
    const updatedPrice = parseFloat(req.body.price);
    const trimmedProductName = req.body.productName.trim();

    if (!trimmedProductName || isNaN(updatedQuantity) || updatedQuantity <= 0 || 
        isNaN(updatedPrice) || updatedPrice <= 0) {
      return res.status(400).json({ 
        message: 'Invalid product name, quantity or price.' 
      });
    }

    // First reverse the original sale
    await Stock.handlePurchase(
      existingSale.productName.trim(),
      existingSale.quantity,
      existingSale.price,
      req.user._id,
      existingSale._id
    );

    // Check if we have enough stock for the updated sale
    const stockItem = await Stock.findOne({ 
      productName: trimmedProductName,
      user: req.user._id
    });

    if (!stockItem || stockItem.quantity < updatedQuantity) {
      // Rollback - reapply original sale
      await Stock.handleSale(
        existingSale.productName.trim(),
        existingSale.quantity,
        req.user._id,
        existingSale._id
      );
      
      return res.status(400).json({
        message: `Insufficient stock. Only ${stockItem ? stockItem.quantity : 0} available.`,
        available: stockItem ? stockItem.quantity : 0
      });
    }

    // Apply the updated sale
    const updatedStock = await Stock.handleSale(
      trimmedProductName,
      updatedQuantity,
      req.user._id,
      existingSale._id
    );

    // Update sale record
    const updatedSale = await Sale.findByIdAndUpdate(
      req.params.id,
      { 
        ...req.body,
        productName: trimmedProductName,
        quantity: updatedQuantity,
        price: updatedPrice
      },
      { new: true }
    );

    res.json({ 
      message: 'Sale updated and stock adjusted.', 
      sale: updatedSale,
      stock: updatedStock
    });
  } catch (err) {
    console.error('Error updating sale:', err);
    res.status(500).json({ 
      error: err.message || 'Failed to update sale' 
    });
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
  deleteOldSales,
  getUnreadCount,
};
