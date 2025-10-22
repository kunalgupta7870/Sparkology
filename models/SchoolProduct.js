const mongoose = require('mongoose');

const schoolProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [200, 'Product name cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  price: {
    type: Number,
    required: [true, 'Product price is required'],
    min: [0, 'Price cannot be negative']
  },
  stock: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    min: [0, 'Stock cannot be negative'],
    default: 0
  },
  sku: {
    type: String,
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [50, 'SKU cannot exceed 50 characters']
  },
  supplier: {
    name: {
      type: String,
      trim: true,
      maxlength: [200, 'Supplier name cannot exceed 200 characters']
    },
    contact: {
      type: String,
      trim: true,
      maxlength: [100, 'Supplier contact cannot exceed 100 characters']
    },
    email: {
      type: String,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    }
  },
  images: [{
    url: {
      type: String,
      required: true,
      trim: true
    },
    alt: {
      type: String,
      trim: true
    },
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  specifications: {
    capacity: {
      type: String,
      trim: true
    },
    compatibility: {
      type: String,
      trim: true
    },
    duration: {
      type: String,
      trim: true
    },
    warranty: {
      type: String,
      trim: true
    },
    support: {
      type: String,
      trim: true
    }
  },
  pricing: {
    cost: {
      type: Number,
      min: [0, 'Cost cannot be negative'],
      default: 0
    },
    markup: {
      type: Number,
      min: [0, 'Markup cannot be negative'],
      default: 0
    },
    discount: {
      type: Number,
      min: [0, 'Discount cannot be negative'],
      max: [100, 'Discount cannot exceed 100%'],
      default: 0
    },
    bulkDiscounts: [{
      minQuantity: {
        type: Number,
        required: true,
        min: [1, 'Minimum quantity must be at least 1']
      },
      discountPercent: {
        type: Number,
        required: true,
        min: [0, 'Discount cannot be negative'],
        max: [100, 'Discount cannot exceed 100%']
      }
    }]
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'discontinued'],
    default: 'active',
    required: true
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  features: [{
    type: String,
    trim: true
  }],
  minimumPurchaseQuantity: {
    type: Number,
    default: 1,
    min: [1, 'Minimum purchase quantity must be at least 1']
  },
  purchaseHistory: [{
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true
    },
    schoolName: {
      type: String,
      required: true
    },
    purchaseDate: {
      type: Date,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Purchase quantity must be at least 1']
    },
    price: {
      type: Number,
      required: true,
      min: [0, 'Price cannot be negative']
    },
    totalAmount: {
      type: Number,
      required: true,
      min: [0, 'Total amount cannot be negative']
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled'],
      default: 'active'
    }
  }],
  totalPurchases: {
    type: Number,
    default: 0,
    min: [0, 'Total purchases cannot be negative']
  },
  totalRevenue: {
    type: Number,
    default: 0,
    min: [0, 'Total revenue cannot be negative']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
schoolProductSchema.index({ name: 1 });
schoolProductSchema.index({ sku: 1 });
schoolProductSchema.index({ status: 1 });
schoolProductSchema.index({ tags: 1 });

// Virtual for stock status
schoolProductSchema.virtual('stockStatus').get(function() {
  if (this.stock <= 0) return 'out_of_stock';
  if (this.stock <= 10) return 'low_stock';
  return 'in_stock';
});

// Virtual for current price after discount
schoolProductSchema.virtual('currentPrice').get(function() {
  if (this.pricing.discount > 0) {
    return this.price * (1 - this.pricing.discount / 100);
  }
  return this.price;
});

// Virtual for profit margin
schoolProductSchema.virtual('profitMargin').get(function() {
  if (this.pricing.cost > 0) {
    return ((this.currentPrice - this.pricing.cost) / this.pricing.cost) * 100;
  }
  return 0;
});

// Pre-save middleware to generate SKU if not provided
schoolProductSchema.pre('save', function(next) {
  if (!this.sku) {
    const prefix = 'SP';
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.sku = `${prefix}-${random}`;
  }
  next();
});

// Static method to search products
schoolProductSchema.statics.searchProducts = function(query) {
  const searchQuery = {
    status: 'active',
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } },
      { sku: { $regex: query, $options: 'i' } },
      { tags: { $in: [new RegExp(query, 'i')] } }
    ]
  };
  
  return this.find(searchQuery);
};

// Static method to get active products
schoolProductSchema.statics.getActiveProducts = function() {
  return this.find({ status: 'active' }).sort({ createdAt: -1 });
};

// Instance method to calculate bulk discount price
schoolProductSchema.methods.getBulkPrice = function(quantity) {
  let price = this.currentPrice;
  
  if (this.pricing.bulkDiscounts && this.pricing.bulkDiscounts.length > 0) {
    // Find the applicable bulk discount (highest quantity tier that applies)
    const applicableDiscounts = this.pricing.bulkDiscounts
      .filter(discount => quantity >= discount.minQuantity)
      .sort((a, b) => b.minQuantity - a.minQuantity);
    
    if (applicableDiscounts.length > 0) {
      const discount = applicableDiscounts[0];
      price = price * (1 - discount.discountPercent / 100);
    }
  }
  
  return price;
};

// Instance method to record purchase
schoolProductSchema.methods.recordPurchase = function(schoolId, schoolName, quantity, price) {
  if (this.stock < quantity) {
    throw new Error('Insufficient stock for purchase');
  }
  
  const totalAmount = price * quantity;
  
  // Update stock
  this.stock -= quantity;
  
  // Add to purchase history
  this.purchaseHistory.push({
    schoolId,
    schoolName,
    purchaseDate: new Date(),
    quantity,
    price,
    totalAmount,
    status: 'active'
  });
  
  // Update totals
  this.totalPurchases += quantity;
  this.totalRevenue += totalAmount;
  
  return this.save();
};

// Instance method to check if product is available for purchase
schoolProductSchema.methods.isAvailable = function(quantity = 1) {
  if (this.status !== 'active') return false;
  if (quantity < this.minimumPurchaseQuantity) return false;
  if (this.stock < quantity) return false;
  return true;
};

module.exports = mongoose.model('SchoolProduct', schoolProductSchema);

