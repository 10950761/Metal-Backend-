const mongoose = require('mongoose');
const Purchase = require("../models/Purchases");
const Stock = require("../models/Stock");

// CREATE PURCHASE
const createPurchase = async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
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

      // Input validation
      const trimmedProductName = productName?.toString().trim();
      if (!trimmedProductName) {
        throw new Error("Product name is required and cannot be empty.");
      }

      const quantity = parseFloat(productQuantity);
      const unitPrice = parseFloat(price);
      if (isNaN(quantity) || quantity <= 0 || isNaN(unitPrice) || unitPrice <= 0) {
        throw new Error("Quantity and price must be positive numbers.");
      }

      // Create purchase record
      const newPurchase = new Purchase({
        supplierName: supplierName?.trim(),
        supplierLocation: supplierLocation?.trim(),
        supplierCompany: supplierCompany?.trim(),
        date,
        time,
        productName: trimmedProductName,
        productQuantity: quantity,
        price: unitPrice,
        notes: notes?.trim(),
        user: req.user._id,
      });

      await newPurchase.save({ session });

      // Stock update operation
      const filter = { 
        productName: trimmedProductName, 
        user: req.user._id 
      };
      
      // First try to find existing stock
      let existingStock = await Stock.findOne(filter).session(session);
      const now = new Date();

      if (existingStock) {
        // Update existing stock
        const newQuantity = existingStock.quantity + quantity;
        const newTotalValue = existingStock.totalValue + (quantity * unitPrice);
        const newUnitPrice = newTotalValue / newQuantity;

        existingStock = await Stock.findOneAndUpdate(
          filter,
          {
            $set: {
              quantity: newQuantity,
              unitPrice: newUnitPrice,
              totalValue: newTotalValue,
              lastUpdated: now
            },
            $push: {
              priceHistory: {
                date: now,
                price: unitPrice,
                type: 'purchase',
                referenceId: newPurchase._id
              }
            }
          },
          { new: true, session }
        );
      } else {
        // Create new stock entry
        existingStock = await Stock.create([{
          productName: trimmedProductName,
          user: req.user._id,
          supplierCompany: supplierCompany?.trim() || 'N/A',
          quantity: quantity,
          unitPrice: unitPrice,
          totalValue: quantity * unitPrice,
          lastUpdated: now,
          priceHistory: [{
            date: now,
            price: unitPrice,
            type: 'purchase',
            referenceId: newPurchase._id
          }]
        }], { session });
        existingStock = existingStock[0];
      }

      return res.status(201).json({
        success: true,
        message: "Purchase and stock recorded successfully",
        purchase: newPurchase,
        stock: existingStock
      });
    });
  } catch (error) {
    console.error("Error in createPurchase:", error);
    
    let statusCode = 500;
    let errorMessage = "Internal server error";
    
    if (error.message.includes("Product name is required") || 
        error.message.includes("must be positive numbers")) {
      statusCode = 400;
      errorMessage = error.message;
    } else if (error.code === 11000) {
      statusCode = 409;
      errorMessage = "Duplicate product entry detected. Please try again.";
    }

    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: error.message
    });
  } finally {
    session.endSession();
  }
};
// DELETE PURCHASE
const deletePurchase = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) return res.status(404).json({ error: "Purchase not found" });

    // This will properly decrease unit price
    const updatedStock = await Stock.reversePurchase(purchase._id, req.user._id);
    
    await Purchase.findByIdAndDelete(req.params.id);

    res.json({
      message: "Purchase deleted and stock updated",
      stock: updatedStock
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE PURCHASE
const updatePurchase = async (req, res) => {
  try {
    const existingPurchase = await Purchase.findById(req.params.id);
    if (!existingPurchase) {
      return res.status(404).json({ error: "Purchase not found" });
    }

    const updatedQuantity = parseFloat(req.body.productQuantity);
    const updatedPrice = parseFloat(req.body.price);
    const trimmedProductName = req.body.productName.trim();

    if (!trimmedProductName || isNaN(updatedQuantity) || updatedQuantity <= 0 || 
        isNaN(updatedPrice) || updatedPrice <= 0) {
      return res.status(400).json({
        message: "Invalid product name, quantity or price.",
      });
    }

    // First reverse the original purchase
    await Stock.handleSale(
      existingPurchase.productName.trim(),
      existingPurchase.productQuantity,
      req.user._id,
      existingPurchase._id
    );

    // Then apply the updated purchase
    const updatedStock = await Stock.handlePurchase(
      trimmedProductName,
      updatedQuantity,
      updatedPrice,
      req.user._id,
      existingPurchase._id
    );

    // Update purchase record
    const updatedPurchase = await Purchase.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        productName: trimmedProductName,
        productQuantity: updatedQuantity,
        price: updatedPrice
      },
      { new: true }
    );

    res.json({
      message: "Purchase updated successfully",
      purchase: updatedPurchase,
      stock: updatedStock
    });
  } catch (err) {
    console.error("Error updating purchase:", err);
    res.status(500).json({ 
      error: err.message || "Failed to update purchase" 
    });
  }
};

// GET PURCHASES
const getPurchases = async (req, res) => {
  try {
    const { history } = req.query;
    
    if (history) {
      // For History - get all purchases
      const purchases = await Purchase.find({ user: req.user._id }).sort({ createdAt: -1 });
      return res.status(200).json(purchases);
    } else {
      // For Recent - get only non-deleted purchases
      const purchases = await Purchase.find({ 
        user: req.user._id,
        deleted: false 
      }).sort({ createdAt: -1 });
      return res.status(200).json(purchases);
    }
  } catch (error) {
    console.error("Error fetching purchases:", error);
    res.status(500).json({ message: "Failed to fetch purchases" });
  }
};



// SOFT DELETE PURCHASE
const softDeletePurchase = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) return res.status(404).json({ error: "Purchase not found" });

    purchase.deleted = true;
    purchase.deletedAt = new Date();
    await purchase.save();

    res.status(200).json({ message: "Purchase marked as deleted" });
  } catch (err) {
    console.error("Error soft deleting purchase:", err);
    res.status(500).json({ error: err.message });
  }
};

// DELETE OLD PURCHASES (permanent)
const deleteOldPurchases = async (req, res) => {
  try {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const result = await Purchase.deleteMany({
      user: req.user._id,
      deleted: true,
      deletedAt: { $lt: threeDaysAgo }
    });

    res.status(200).json({
      message: `Deleted ${result.deletedCount} old purchases`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Error deleting old purchases:', error);
    res.status(500).json({ message: 'Failed to delete old purchases' });
  }
};

module.exports = {
  createPurchase,
  getPurchases,
  deletePurchase,
  updatePurchase,
  deleteOldPurchases,
  softDeletePurchase
};
