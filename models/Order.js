const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: false
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: false
  },
  type: {
    type: String,
    enum: ['product', 'course'],
    required: true,
    default: 'product'
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: [0, 'Price cannot be negative']
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
    default: 1
  },
  image: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    trim: true
  },
  subtotal: {
    type: Number,
    required: true,
    min: [0, 'Subtotal cannot be negative']
  }
}, {
  timestamps: true
});

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    trim: true,
    uppercase: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'userModel'
  },
  userModel: {
    type: String,
    required: true,
    enum: ['Student', 'Parent', 'User']
  },
  items: [orderItemSchema],
  billingAddress: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      trim: true
    },
    address: {
      type: String,
      trim: true
    }
  },
  paymentMethod: {
    type: {
      type: String,
      required: true,
      default: 'card'
    },
    name: {
      type: String,
      trim: true
    }
  },
  promoCode: {
    code: {
      type: String,
      trim: true,
      uppercase: true
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed']
    },
    discountValue: {
      type: Number,
      min: [0, 'Discount value cannot be negative']
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: [0, 'Discount amount cannot be negative']
    }
  },
  pricing: {
    subtotal: {
      type: Number,
      required: true,
      min: [0, 'Subtotal cannot be negative']
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative']
    },
    paymentFee: {
      type: Number,
      default: 0,
      min: [0, 'Payment fee cannot be negative']
    },
    total: {
      type: Number,
      required: true,
      min: [0, 'Total cannot be negative']
    }
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'cancelled', 'refunded'],
    default: 'pending',
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
    required: true
  },
  transactionId: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  completedAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  cancellationReason: {
    type: String,
    trim: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for faster queries
orderSchema.index({ userId: 1, userModel: 1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });

// Pre-save middleware to generate order number
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.orderNumber = `ORD-${year}${month}${day}-${random}`;
  }
  next();
});

// Static method to get orders by user
orderSchema.statics.getOrdersByUser = function(userId, userModel, filters = {}) {
  const query = { userId, userModel, ...filters };
  return this.find(query)
    .populate('items.productId', 'name price images category')
    .populate('items.courseId', 'name price thumbnail category instructor')
    .sort({ createdAt: -1 });
};

// Static method to get order by order number
orderSchema.statics.getOrderByNumber = function(orderNumber) {
  return this.findOne({ orderNumber })
    .populate('items.productId', 'name price images category')
    .populate('items.courseId', 'name price thumbnail category instructor');
};

// Instance method to mark as completed
orderSchema.methods.markAsCompleted = function() {
  this.status = 'completed';
  this.paymentStatus = 'paid';
  this.completedAt = new Date();
  return this.save();
};

// Instance method to cancel order
orderSchema.methods.cancelOrder = function(reason) {
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  this.cancellationReason = reason;
  return this.save();
};

module.exports = mongoose.model('Order', orderSchema);

