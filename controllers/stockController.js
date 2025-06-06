const Stock = require('../models/Stock');

exports.getStock = async (req, res) => {
  try {
    const stocks = await Stock.find().sort({ productName: 1 });
    res.status(200).json(stocks);
  } catch (error) {
    console.error('Error fetching stock:', error);
    res.status(500).json({ message: 'Failed to fetch stock' });
  }
};
