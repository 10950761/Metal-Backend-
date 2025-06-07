const Purchase = require("../models/Purchases");
const Stock = require("../models/Stock");

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

    let stock = await Stock.findOne({ productName: trimmedProductName, user: req.user._id });

    if (stock) {
      stock.quantity += quantity;
      await stock.save();
    } else {
      stock = new Stock({ productName: trimmedProductName, quantity, user: req.user._id });
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

const getPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(purchases);
  } catch (error) {
    console.error("Error fetching purchases:", error);
    res.status(500).json({ message: "Failed to fetch purchases" });
  }
};

const deletePurchase = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) return res.status(404).json({ error: "Purchase not found" });

    const trimmedProductName = purchase.productName.trim();

    // 1. Get the corresponding stock item
    const stock = await Stock.findOne({
      productName: trimmedProductName,
      user: req.user._id,
    });

    if (stock) {
      // 2. Subtract purchase quantity, prevent negative result
      const updatedQuantity = Math.max(stock.quantity - purchase.productQuantity, 0);

      // 3. If quantity becomes 0, clear lastUpdated
      stock.quantity = updatedQuantity;
      stock.lastUpdated = updatedQuantity === 0 ? null : new Date();
      await stock.save();
    }

    // 4. Delete the purchase
    await Purchase.findByIdAndDelete(req.params.id);

    res.json({ message: "Purchase deleted and stock updated" });
  } catch (err) {
    console.error("Error deleting purchase:", err);
    res.status(500).json({ error: err.message });
  }
};

const updatePurchase = async (req, res) => {
  try {
    const existingPurchase = await Purchase.findById(req.params.id);
    if (!existingPurchase)
      return res.status(404).json({ error: "Purchase not found" });

    const updatedQuantity = parseFloat(req.body.productQuantity);
    const trimmedProductName = req.body.productName.trim();

    if (!trimmedProductName || isNaN(updatedQuantity) || updatedQuantity <= 0) {
      return res
        .status(400)
        .json({ message: "Invalid updated product name or quantity." });
    }

    await Stock.updateOne(
      { productName: existingPurchase.productName.trim(), user: req.user._id },
      { $inc: { quantity: -existingPurchase.productQuantity } }
    );

    const updatedPurchase = await Purchase.findByIdAndUpdate(
      req.params.id,
      { ...req.body, productName: trimmedProductName, productQuantity: updatedQuantity },
      { new: true }
    );

    await Stock.updateOne(
      { productName: trimmedProductName, user: req.user._id },
      { $inc: { quantity: updatedPurchase.productQuantity } },
      { upsert: true }
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
  updatePurchase,
};
