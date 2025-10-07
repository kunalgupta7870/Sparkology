const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Item name is required'],
    trim: true,
    maxlength: [200, 'Item name cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Item description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  current: {
    type: Number,
    required: [true, 'Current stock is required'],
    min: [0, 'Current stock cannot be negative'],
    default: 0
  },
  minimum: {
    type: Number,
    default: 10,
    min: [0, 'Minimum stock cannot be negative']
  },
  price: {
    type: Number,
    min: [0, 'Price cannot be negative'],
    default: 0
  },
  category: {
    type: String,
    default: 'Inventory',
    trim: true,
    maxlength: [100, 'Category cannot exceed 100 characters']
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'discontinued'],
    default: 'active',
    required: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
inventorySchema.index({ name: 1 });
inventorySchema.index({ category: 1 });
inventorySchema.index({ status: 1 });

// Virtual for stock status
inventorySchema.virtual('stockStatus').get(function() {
  if (this.current <= 0) return 'out_of_stock';
  if (this.current <= this.minimum) return 'low_stock';
  return 'in_stock';
});

// Pre-save middleware to update lastUpdated
inventorySchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

// Static method to get low stock items
inventorySchema.statics.getLowStockItems = function() {
  return this.find({ 
    $expr: { $lte: ['$current', '$minimum'] },
    status: 'active'
  });
};

// Static method to search items
inventorySchema.statics.searchItems = function(query) {
  return this.find({
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } },
      { category: { $regex: query, $options: 'i' } }
    ],
    status: 'active'
  });
};

// Instance method to update stock
inventorySchema.methods.updateStock = function(quantity, operation = 'add') {
  if (operation === 'add') {
    this.current += quantity;
  } else if (operation === 'subtract') {
    if (this.current < quantity) {
      throw new Error('Insufficient stock');
    }
    this.current -= quantity;
  }
  
  this.lastUpdated = new Date();
  return this.save();
};

module.exports = mongoose.model('Inventory', inventorySchema);
