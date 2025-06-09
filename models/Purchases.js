const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  supplierName: { type: String, required: true },
  supplierLocation: { type: String, required: true },
  supplierCompany: { type: String },
  date: { type: String, required: true }, 
  time: { type: String, required: true },
  productName: { type: String, required: true },
  productQuantity: { type: Number, required: true },
  price: { type: Number, required: true },
  notes: { type: String },
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date }
}, { timestamps: true });


module.exports = mongoose.model('Purchase', purchaseSchema);