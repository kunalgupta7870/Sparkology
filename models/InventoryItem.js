const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Item name is required'], 
    trim: true 
  },
  sku: { 
    type: String, 
    trim: true,
    unique: true,
    required: [true, 'SKU is required']
  },
  category: {
    type: String,
    enum: ['stationery', 'electronics', 'sports', 'furniture', 'books', 'uniforms', 'lab_equipment', 'other'],
    required: [true, 'Category is required']
  },
  description: { 
    type: String,
    trim: true 
  },
  quantity: { 
    type: Number, 
    required: [true, 'Quantity is required'],
    min: [0, 'Quantity cannot be negative'],
    default: 0 
  },
  unit: {
    type: String,
    enum: ['pieces', 'sets', 'boxes', 'pairs', 'kg', 'meters', 'other'],
    required: [true, 'Unit is required']
  },
  minQuantity: {
    type: Number,
    default: 10,
    min: 0
  },
  location: {
    building: String,
    room: String,
    shelf: String
  },
  supplier: {
    name: String,
    contact: String,
    email: String
  },
  price: {
    costPrice: { type: Number, min: 0 },
    sellingPrice: { type: Number, min: 0 }
  },
  transactions: [{
    type: {
      type: String,
      enum: ['in', 'out'],
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    },
    reason: String,
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  images: [{
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  schoolId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'School', 
    required: true 
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  lastUpdatedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  status: {
    type: String,
    enum: ['in_stock', 'low_stock', 'out_of_stock'],
    default: 'in_stock'
  }
}, { 
  timestamps: true 
});

// Indexes for faster queries
inventorySchema.index({ schoolId: 1, sku: 1 });
inventorySchema.index({ schoolId: 1, category: 1 });
inventorySchema.index({ schoolId: 1, status: 1 });

// Update status based on quantity and minQuantity
inventorySchema.pre('save', function(next) {
  if (this.quantity <= 0) {
    this.status = 'out_of_stock';
  } else if (this.quantity <= this.minQuantity) {
    this.status = 'low_stock';
  } else {
    this.status = 'in_stock';
  }
  next();
});

// Virtual for total value
inventorySchema.virtual('totalValue').get(function() {
  if (!this.price || !this.price.costPrice) return 0;
  return this.price.costPrice * this.quantity;
});

inventorySchema.set('toJSON', { virtuals: true });
inventorySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('InventoryItem', inventorySchema);
