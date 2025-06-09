const Purchase = require("../models/Purchases");
const Stock = require("../models/Stock");

// CREATE PURCHASE
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

    const trimmedProductName = productName.trim();
    const quantity = parseFloat(productQuantity);

    if (!trimmedProductName || isNaN(quantity) || quantity <= 0) {
      return res
        .status(400)
        .json({ message: "Invalid product name or quantity." });
    }

    const newPurchase = new Purchase({
      supplierName,
      supplierLocation,
      supplierCompany,
      date,
      time,
      productName: trimmedProductName,
      productQuantity: quantity,
      price,
      notes,
      user: req.user._id,
    });

    await newPurchase.save();

    let stock = await Stock.findOne({
      productName: trimmedProductName,
      user: req.user._id,
    });

    if (stock) {
      stock.quantity += quantity;
      stock.unitPrice = price;
      stock.supplierCompany = supplierCompany?.trim() || "N/A"; 
      stock.lastUpdated = new Date();
      await stock.save();
    } else {
      stock = new Stock({
        productName: trimmedProductName,
        quantity,
        unitPrice: price,
        supplierCompany: supplierCompany?.trim() || "N/A", 
        user: req.user._id,
        lastUpdated: new Date(),
      });
      await stock.save();
    }

    res.status(201).json({
      message: "Purchase and stock recorded successfully",
      purchase: newPurchase,
    });
  } catch (error) {
    console.error("Error creating purchase:", error);
    res.status(500).json({ message: "Failed to record purchase" });
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


// DELETE PURCHASE
const deletePurchase = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase)
      return res.status(404).json({ error: "Purchase not found" });

    const trimmedProductName = purchase.productName.trim();

    const stock = await Stock.findOne({
      productName: trimmedProductName,
      user: req.user._id,
    });

    if (stock) {
      const updatedQuantity = Math.max(
        stock.quantity - purchase.productQuantity,
        0
      );
      stock.quantity = updatedQuantity;
      stock.lastUpdated = updatedQuantity === 0 ? null : new Date();
      await stock.save();
    }

    await Purchase.findByIdAndDelete(req.params.id);

    res.json({ message: "Purchase deleted and stock updated" });
  } catch (err) {
    console.error("Error deleting purchase:", err);
    res.status(500).json({ error: err.message });
  }
};

// UPDATE PURCHASE
const updatePurchase = async (req, res) => {
  try {
    const existingPurchase = await Purchase.findById(req.params.id);
    if (!existingPurchase)
      return res.status(404).json({ error: "Purchase not found" });

    const updatedQuantity = parseFloat(req.body.productQuantity);
    const trimmedProductName = req.body.productName.trim();

    if (!trimmedProductName || isNaN(updatedQuantity) || updatedQuantity <= 0) {
      return res.status(400).json({
        message: "Invalid updated product name or quantity.",
      });
    }

    // Subtract old quantity
    await Stock.updateOne(
      {
        productName: existingPurchase.productName.trim(),
        user: req.user._id,
      },
      {
        $inc: { quantity: -existingPurchase.productQuantity },
      }
    );

    // Update purchase
    const updatedPurchase = await Purchase.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        productName: trimmedProductName,
        productQuantity: updatedQuantity,
      },
      { new: true }
    );

    // Add new quantity
    await Stock.updateOne(
      { productName: trimmedProductName, user: req.user._id },
      {
        $inc: { quantity: updatedQuantity },
        $set: { unitPrice: req.body.price, lastUpdated: new Date() },
      },
      { upsert: true }
    );

    res.json(updatedPurchase);
  } catch (err) {
    console.error("Error updating purchase:", err);
    res.status(500).json({ error: err.message });
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
