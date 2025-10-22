const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
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
  category: {
    type: String,
    required: [true, 'Product category is required'],
    trim: true,
    maxlength: [100, 'Category cannot exceed 100 characters']
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
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: false
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
    weight: {
      type: String,
      trim: true
    },
    dimensions: {
      type: String,
      trim: true
    },
    color: {
      type: String,
      trim: true
    },
    material: {
      type: String,
      trim: true
    },
    warranty: {
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
    }
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
  isDigital: {
    type: Boolean,
    default: false
  },
  downloadUrl: {
    type: String,
    trim: true
  },
  expiryDate: {
    type: Date,
    default: null
  },
  reorderPoint: {
    type: Number,
    default: 5,
    min: [0, 'Reorder point cannot be negative']
  },
  reorderQuantity: {
    type: Number,
    default: 50,
    min: [1, 'Reorder quantity must be at least 1']
  },
  lastRestocked: {
    type: Date,
    default: null
  },
  restockHistory: [{
    date: {
      type: Date,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Restock quantity must be at least 1']
    },
    cost: {
      type: Number,
      min: [0, 'Cost cannot be negative']
    },
    supplier: {
      type: String,
      trim: true
    }
  }],
  salesHistory: [{
    date: {
      type: Date,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Sales quantity must be at least 1']
    },
    price: {
      type: Number,
      required: true,
      min: [0, 'Price cannot be negative']
    },
    customer: {
      type: String,
      trim: true
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
productSchema.index({ name: 1 });
productSchema.index({ sku: 1 });
productSchema.index({ schoolId: 1 });
productSchema.index({ category: 1 });
productSchema.index({ status: 1 });
productSchema.index({ tags: 1 });

// Virtual for stock status
productSchema.virtual('stockStatus').get(function() {
  if (this.stock <= 0) return 'out_of_stock';
  if (this.stock <= this.reorderPoint) return 'reorder_needed';
  return 'in_stock';
});

// Virtual for current price after discount
productSchema.virtual('currentPrice').get(function() {
  if (this.pricing && this.pricing.discount > 0) {
    return this.price * (1 - this.pricing.discount / 100);
  }
  return this.price;
});

// Virtual for profit margin
productSchema.virtual('profitMargin').get(function() {
  if (this.pricing && this.pricing.cost > 0) {
    return ((this.currentPrice - this.pricing.cost) / this.pricing.cost) * 100;
  }
  return 0;
});

// Virtual for total sales
productSchema.virtual('totalSales').get(function() {
  if (!this.salesHistory || !Array.isArray(this.salesHistory)) return 0;
  return this.salesHistory.reduce((total, sale) => total + sale.quantity, 0);
});

// Virtual for total revenue
productSchema.virtual('totalRevenue').get(function() {
  if (!this.salesHistory || !Array.isArray(this.salesHistory)) return 0;
  return this.salesHistory.reduce((total, sale) => total + (sale.quantity * sale.price), 0);
});

// Pre-save middleware to generate SKU if not provided
productSchema.pre('save', function(next) {
  if (!this.sku) {
    const prefix = this.category.substring(0, 3).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.sku = `${prefix}-${random}`;
  }
  next();
});

// Static method to get products by school
productSchema.statics.getProductsBySchool = function(schoolId) {
  return this.find({ schoolId }).populate('schoolId', 'name code');
};

// Static method to get low stock products
productSchema.statics.getLowStockProducts = function(schoolId = null) {
  const query = { $expr: { $lte: ['$stock', '$reorderPoint'] } };
  if (schoolId) query.schoolId = schoolId;
  return this.find(query).populate('schoolId', 'name code');
};

// Static method to get products by category
productSchema.statics.getProductsByCategory = function(category, schoolId = null) {
  const query = { category };
  if (schoolId) query.schoolId = schoolId;
  return this.find(query).populate('schoolId', 'name code');
};

// Static method to search products
productSchema.statics.searchProducts = function(query, schoolId = null) {
  const searchQuery = {
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } },
      { sku: { $regex: query, $options: 'i' } },
      { tags: { $in: [new RegExp(query, 'i')] } }
    ]
  };
  
  if (schoolId) searchQuery.schoolId = schoolId;
  
  return this.find(searchQuery).populate('schoolId', 'name code');
};

// Instance method to update stock
productSchema.methods.updateStock = function(quantity, operation = 'add') {
  if (operation === 'add') {
    this.stock += quantity;
  } else if (operation === 'subtract') {
    if (this.stock < quantity) {
      throw new Error('Insufficient stock');
    }
    this.stock -= quantity;
  }
  
  // Add to restock history if adding stock
  if (operation === 'add' && quantity > 0) {
    this.restockHistory.push({
      date: new Date(),
      quantity: quantity,
      supplier: this.supplier.name || 'Unknown'
    });
    this.lastRestocked = new Date();
  }
  
  return this.save();
};

// Instance method to record sale
productSchema.methods.recordSale = function(quantity, price, customer = 'Unknown') {
  if (this.stock < quantity) {
    throw new Error('Insufficient stock for sale');
  }
  
  this.stock -= quantity;
  this.salesHistory.push({
    date: new Date(),
    quantity: quantity,
    price: price,
    customer: customer
  });
  
  return this.save();
};

// Instance method to check if reorder is needed
productSchema.methods.needsReorder = function() {
  return this.stock <= this.reorderPoint;
};

module.exports = mongoose.model('Product', productSchema);
