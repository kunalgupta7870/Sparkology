const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Promo code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    minlength: [3, 'Promo code must be at least 3 characters'],
    maxlength: [20, 'Promo code cannot exceed 20 characters'],
    match: [/^[A-Z0-9_-]+$/, 'Promo code can only contain letters, numbers, underscores, and hyphens']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: [true, 'Discount type is required']
  },
  discountValue: {
    type: Number,
    required: [true, 'Discount value is required'],
    min: [0, 'Discount value cannot be negative']
  },
  // For percentage discounts, max value is 100
  // For fixed discounts, this is the amount to subtract
  maxDiscountAmount: {
    type: Number,
    min: [0, 'Max discount amount cannot be negative'],
    default: null // null means no limit
  },
  minimumOrderAmount: {
    type: Number,
    min: [0, 'Minimum order amount cannot be negative'],
    default: 0
  },
  // Product targeting
  targetType: {
    type: String,
    enum: ['all', 'specific', 'category'],
    required: [true, 'Target type is required'],
    default: 'all'
  },
  // If targetType is 'specific', this contains product IDs
  targetProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  // If targetType is 'category', this contains category names
  targetCategories: [{
    type: String,
    trim: true
  }],
  // Usage limits
  usageLimit: {
    type: Number,
    min: [1, 'Usage limit must be at least 1'],
    default: null // null means unlimited
  },
  usedCount: {
    type: Number,
    default: 0,
    min: [0, 'Used count cannot be negative']
  },
  // Validity period
  validFrom: {
    type: Date,
    required: [true, 'Valid from date is required'],
    default: Date.now
  },
  validUntil: {
    type: Date,
    required: [true, 'Valid until date is required']
  },
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  // Created by admin
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required']
  },
  // Usage tracking
  usageHistory: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    originalPrice: {
      type: Number,
      required: true
    },
    discountAmount: {
      type: Number,
      required: true
    },
    finalPrice: {
      type: Number,
      required: true
    },
    usedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
promoCodeSchema.index({ code: 1 });
promoCodeSchema.index({ isActive: 1, validFrom: 1, validUntil: 1 });
promoCodeSchema.index({ targetType: 1, targetProducts: 1 });
promoCodeSchema.index({ targetType: 1, targetCategories: 1 });
promoCodeSchema.index({ createdBy: 1 });
promoCodeSchema.index({ createdAt: -1 });

// Virtual for remaining uses
promoCodeSchema.virtual('remainingUses').get(function() {
  if (this.usageLimit === null) return null;
  return Math.max(0, this.usageLimit - this.usedCount);
});

// Virtual for validity status
promoCodeSchema.virtual('isValid').get(function() {
  const now = new Date();
  return this.isActive && 
         this.validFrom <= now && 
         this.validUntil >= now &&
         (this.usageLimit === null || this.usedCount < this.usageLimit);
});

// Virtual for formatted discount
promoCodeSchema.virtual('formattedDiscount').get(function() {
  if (this.discountType === 'percentage') {
    return `${this.discountValue}%`;
  } else {
    return `$${this.discountValue.toFixed(2)}`;
  }
});

// Pre-save middleware to validate dates
promoCodeSchema.pre('save', function(next) {
  if (this.validUntil <= this.validFrom) {
    return next(new Error('Valid until date must be after valid from date'));
  }
  
  // For percentage discounts, ensure value is not more than 100
  if (this.discountType === 'percentage' && this.discountValue > 100) {
    return next(new Error('Percentage discount cannot exceed 100%'));
  }
  
  next();
});

// Method to check if promo code is applicable to a product
promoCodeSchema.methods.isApplicableToProduct = function(product) {
  if (!this.isValid) return false;
  
  switch (this.targetType) {
    case 'all':
      return true;
    case 'specific':
      return this.targetProducts.some(id => id.toString() === product._id.toString());
    case 'category':
      return this.targetCategories.includes(product.category);
    default:
      return false;
  }
};

// Method to calculate discount for a product
promoCodeSchema.methods.calculateDiscount = function(productPrice) {
  if (!this.isApplicableToProduct(productPrice)) {
    return 0;
  }
  
  let discountAmount = 0;
  
  if (this.discountType === 'percentage') {
    discountAmount = (productPrice * this.discountValue) / 100;
  } else {
    discountAmount = this.discountValue;
  }
  
  // Apply max discount limit if set
  if (this.maxDiscountAmount && discountAmount > this.maxDiscountAmount) {
    discountAmount = this.maxDiscountAmount;
  }
  
  // Ensure discount doesn't exceed product price
  return Math.min(discountAmount, productPrice);
};

// Method to record usage
promoCodeSchema.methods.recordUsage = function(userId, orderId, productId, originalPrice, discountAmount) {
  this.usedCount += 1;
  
  this.usageHistory.push({
    userId,
    orderId,
    productId,
    originalPrice,
    discountAmount,
    finalPrice: originalPrice - discountAmount,
    usedAt: new Date()
  });
  
  return this.save();
};

module.exports = mongoose.model('PromoCode', promoCodeSchema);
