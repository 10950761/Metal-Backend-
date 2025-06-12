// models/Stock.js
const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  productName: { 
    type: String, 
    required: true,
    trim: true
  },
  supplierCompany: { 
    type: String, 
    required: true,
    trim: true
  },
  quantity: { 
    type: Number, 
    required: true, 
    default: 0,
    min: 0
  },
  unitPrice: { 
    type: Number, 
    required: true, 
    default: 0,
    min: 0
  },
  totalValue: { 
    type: Number, 
    required: true, 
    default: 0,
    min: 0
  },
  lowStockThreshold: { 
    type: Number, 
    required: true,
    default: 10
  },
  lastUpdated: { 
    type: Date, 
    default: Date.now 
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  priceHistory: [{
    date: Date,
    price: Number,
    type: { 
      type: String, 
      enum: ['purchase', 'sale', 'adjustment'] 
    },
    referenceId: mongoose.Schema.Types.ObjectId
  }]
}, { timestamps: true });

// Indexes
stockSchema.index({ productName: 1, user: 1 }, { unique: true });
// models/Stock.js
stockSchema.statics.handlePurchase = async function(productName, quantity, purchasePrice, userId, purchaseId) {
  // Use findOneAndUpdate with upsert to avoid race conditions
  const result = await this.findOneAndUpdate(
    { productName, user: userId },
    {
      $inc: { quantity: quantity },
      $setOnInsert: {
        productName: productName.trim(),
        user: userId,
        supplierCompany: 'N/A',
        unitPrice: purchasePrice,
        totalValue: quantity * purchasePrice
      },
      $set: {
        lastUpdated: Date.now()
      },
      $push: {
        priceHistory: {
          date: new Date(),
          price: purchasePrice,
          type: 'purchase',
          referenceId: purchaseId
        }
      }
    },
    { 
      upsert: true,
      new: true,
      runValidators: true 
    }
  );

  // For upserted documents, we need to calculate weighted average
  if (!result) {
    return this.findOne({ productName, user: userId });
  }

  // Calculate new weighted average for existing items
  const newQuantity = result.quantity + quantity;
  const newTotalValue = result.totalValue + (quantity * purchasePrice);
  const newUnitPrice = newTotalValue / newQuantity;

  return this.findOneAndUpdate(
    { _id: result._id },
    {
      quantity: newQuantity,
      unitPrice: newUnitPrice,
      totalValue: newTotalValue
    },
    { new: true }
  );
};

stockSchema.statics.handleSale = async function(productName, quantity, userId, saleId, session) {
  const stockItem = await this.findOne({ productName, user: userId }).session(session);
  if (!stockItem) throw new Error('Product not found');
  if (stockItem.quantity < quantity) throw new Error('Insufficient stock');

  const newQuantity = stockItem.quantity - quantity;
  const newUnitPrice = Math.max(stockItem.unitPrice * 0.95, 0); 
  const newTotalValue = newUnitPrice * newQuantity;

  return this.findOneAndUpdate(
    { _id: stockItem._id },
    {
      quantity: newQuantity,
      unitPrice: newUnitPrice,
      totalValue: newTotalValue,
      lastUpdated: Date.now(),
      $push: {
        priceHistory: {
          date: new Date(),
          price: newUnitPrice,
          type: 'sale',
          referenceId: saleId
        }
      }
    },
    { new: true, session } 
  );
};

stockSchema.statics.reversePurchase = async function(purchaseId, userId) {
  const purchase = await Purchase.findById(purchaseId);
  if (!purchase) throw new Error('Purchase not found');

  const stockItem = await this.findOne({ 
    productName: purchase.productName, 
    user: userId 
  });
  if (!stockItem) throw new Error('Stock item not found');

  // Calculate reverse weighted average
  const newQuantity = stockItem.quantity - purchase.productQuantity;
  const newTotalValue = stockItem.totalValue - (purchase.productQuantity * purchase.price);
  const newUnitPrice = newQuantity > 0 ? newTotalValue / newQuantity : 0;

  return this.findOneAndUpdate(
    { _id: stockItem._id },
    {
      quantity: newQuantity,
      unitPrice: newUnitPrice,
      totalValue: newTotalValue,
      lastUpdated: Date.now(),
      $push: {
        priceHistory: {
          date: new Date(),
          price: newUnitPrice,
          type: 'adjustment',
          referenceId: purchase._id
        }
      }
    },
    { new: true }
  );
};

// Middleware to auto-calculate total value
stockSchema.pre('save', function(next) {
  this.totalValue = this.quantity * this.unitPrice;
  next();
});

module.exports = mongoose.model('Stock', stockSchema);