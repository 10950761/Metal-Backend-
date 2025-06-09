const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  productName: {
    type: String,
    required: true,
  },
 supplierCompany: { 
   default: "Default Supplier",
  type: String },

  unitPrice: {
    type: Number,
    required: true,
  },
  quantity: {
    type: Number,
    default: 0,
    required: true,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, { timestamps: true });

// ✅ Ensure productName is trimmed and lowercase
stockSchema.index({ productName: 1, user: 1 }, { unique: true });

// ✅ Prevent saving if quantity is negative
stockSchema.pre('save', function (next) {
  if (this.quantity < 0) {
    return next(new Error('Stock quantity cannot be negative.'));
  }
  next();
});

module.exports = mongoose.model('Stock', stockSchema);
