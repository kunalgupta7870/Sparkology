const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: false // Can be null for courses
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: false // Can be null for products
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
  description: {
    type: String,
    trim: true
  },
  selected: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const cartSchema = new mongoose.Schema({
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
  items: [cartItemSchema],
  totalItems: {
    type: Number,
    default: 0
  },
  totalPrice: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for faster queries
cartSchema.index({ userId: 1, userModel: 1 });

// Virtual for selected items count
cartSchema.virtual('selectedItemsCount').get(function() {
  if (!this.items || !Array.isArray(this.items)) return 0;
  return this.items.filter(item => item.selected).length;
});

// Virtual for selected items total
cartSchema.virtual('selectedItemsTotal').get(function() {
  if (!this.items || !Array.isArray(this.items)) return 0;
  return this.items
    .filter(item => item.selected)
    .reduce((total, item) => total + (item.price * item.quantity), 0);
});

// Method to calculate totals
cartSchema.methods.calculateTotals = function() {
  if (!this.items || !Array.isArray(this.items)) {
    this.items = [];
    this.totalItems = 0;
    this.totalPrice = 0;
    return this;
  }
  this.totalItems = this.items.reduce((total, item) => total + item.quantity, 0);
  this.totalPrice = this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
  return this;
};

// Method to add item to cart
cartSchema.methods.addItem = function(itemData) {
  const { productId, courseId, type, name, price, quantity = 1, image, category, description } = itemData;
  
  // Initialize items array if not exists
  if (!this.items || !Array.isArray(this.items)) {
    this.items = [];
  }
  
  // Check if item already exists
  const existingItemIndex = this.items.findIndex(item => {
    if (type === 'product' && productId) {
      return item.productId && item.productId.toString() === productId.toString();
    } else if (type === 'course' && courseId) {
      return item.courseId && item.courseId.toString() === courseId.toString();
    }
    return false;
  });

  if (existingItemIndex > -1) {
    // Item exists, update quantity (courses always stay at 1)
    if (type === 'product') {
      this.items[existingItemIndex].quantity += quantity;
    }
    // For courses, don't increment quantity
  } else {
    // Add new item
    this.items.push({
      productId: type === 'product' ? productId : null,
      courseId: type === 'course' ? courseId : null,
      type,
      name,
      price,
      quantity: type === 'course' ? 1 : quantity,
      image,
      category,
      description,
      selected: true
    });
  }

  this.calculateTotals();
  return this;
};

// Method to update item quantity
cartSchema.methods.updateQuantity = function(itemId, quantity) {
  if (!this.items || !Array.isArray(this.items)) {
    this.items = [];
    return this;
  }
  
  const item = this.items.id(itemId);
  if (item) {
    if (quantity <= 0) {
      // Remove item if quantity is 0 or less
      this.items.pull(itemId);
    } else {
      item.quantity = quantity;
    }
    this.calculateTotals();
  }
  return this;
};

// Method to remove item
cartSchema.methods.removeItem = function(itemId) {
  if (!this.items || !Array.isArray(this.items)) {
    this.items = [];
    return this;
  }
  
  this.items.pull(itemId);
  this.calculateTotals();
  return this;
};

// Method to toggle item selection
cartSchema.methods.toggleItemSelection = function(itemId) {
  if (!this.items || !Array.isArray(this.items)) {
    this.items = [];
    return this;
  }
  
  const item = this.items.id(itemId);
  if (item) {
    item.selected = !item.selected;
  }
  return this;
};

// Method to clear selected items
cartSchema.methods.clearSelectedItems = function() {
  if (!this.items || !Array.isArray(this.items)) {
    this.items = [];
    return this;
  }
  
  this.items = this.items.filter(item => !item.selected);
  this.calculateTotals();
  return this;
};

// Method to clear all items
cartSchema.methods.clearCart = function() {
  this.items = [];
  this.totalItems = 0;
  this.totalPrice = 0;
  return this;
};

// Static method to get cart by user
cartSchema.statics.getCartByUser = function(userId, userModel) {
  return this.findOne({ userId, userModel })
    .populate('items.productId', 'name price images category stock status')
    .populate('items.courseId', 'name price thumbnail category instructor');
};

// Static method to create or get cart
cartSchema.statics.createOrGetCart = async function(userId, userModel) {
  let cart = await this.findOne({ userId, userModel });
  if (!cart) {
    cart = await this.create({ 
      userId, 
      userModel, 
      items: [],
      totalItems: 0,
      totalPrice: 0
    });
  }
  // Ensure items array exists
  if (!cart.items) {
    cart.items = [];
  }
  return cart;
};

// Pre-save middleware to calculate totals
cartSchema.pre('save', function(next) {
  this.calculateTotals();
  next();
});

module.exports = mongoose.model('Cart', cartSchema);

