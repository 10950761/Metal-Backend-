const Stock = require("../models/Stock");

exports.getStock = async (req, res) => {
  try {
    const stocks = await Stock.find({ user: req.user._id }).sort({
      productName: 1,
    });
    console.log('First stock item:', JSON.stringify(stocks[0], null, 2));
    res.status(200).json(stocks);
  } catch (error) {
    console.error("Error fetching stock:", error);
    res.status(500).json({ message: "Failed to fetch stock" });
  }
};

exports.bulkUpsertStock = async (req, res) => {
  try {
    const products = req.body.products;
    const userId = req.user._id;

    const ops = products.map(product => ({
      updateOne: {
        filter: { 
          productName: product.name.trim(), 
          user: userId 
        },
        update: {
          $set: {
            quantity: product.quantity,
            unitPrice: product.unitPrice,
            supplierCompany: product.supplierCompany?.trim() || "N/A", 
            lastUpdated: new Date()
          },
          $setOnInsert: {
            createdAt: new Date(),
            user: userId,
            productName: product.name.trim(),
            supplierCompany: product.supplierCompany || "N/A"
          }
        },
        upsert: true
      }
    }));

    await Stock.bulkWrite(ops);
    res.status(200).json({ message: "Stock updated successfully" });
  } catch (err) {
    console.error("Bulk upsert error:", err);
    res.status(500).json({ message: "Update failed" });
  }
};