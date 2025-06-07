const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, 
  customerName: { type: String, required: true },
  customerNumber: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  productName: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true },
  totalPrice: { type: Number, required: true }
}, { timestamps: true });


module.exports = mongoose.model('Sale', saleSchema);
