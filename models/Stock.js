const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  productName: { type: String, required: true, unique: true },
  quantity: { type: Number, default: 0 }
}, { timestamps: true });

stockSchema.pre('save', function (next) {
  if (this.quantity < 0) {
    return next(new Error('Stock quantity cannot be negative.'));
  }
  next();
});

module.exports = mongoose.model('Stock', stockSchema);
