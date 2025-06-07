const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  productName: { type: String, required: true },
  supplier: String,
  unitPrice: Number,
  quantity: { type: Number, default: 0 },
  lastUpdated: Date,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

stockSchema.pre('save', function (next) {
  if (this.quantity < 0) {
    return next(new Error('Stock quantity cannot be negative.'));
  }
  next();
});

module.exports = mongoose.model('Stock', stockSchema);
