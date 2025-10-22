const PromoCode = require('../models/PromoCode');
const Product = require('../models/Product');
const asyncHandler = require('../middleware/asyncHandler');

// @desc    Create a new promo code
// @route   POST /api/promo-codes
// @access  Private (Admin)
const createPromoCode = asyncHandler(async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      maxDiscountAmount,
      minimumOrderAmount,
      targetType,
      targetProducts,
      targetCategories,
      usageLimit,
      validFrom,
      validUntil,
      isActive
    } = req.body;

    const user = req.user;

    // Validate target products if targetType is 'specific'
    if (targetType === 'specific' && targetProducts && targetProducts.length > 0) {
      const existingProducts = await Product.find({ _id: { $in: targetProducts } });
      if (existingProducts.length !== targetProducts.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more target products do not exist'
        });
      }
    }

    // Validate discount value
    if (discountType === 'percentage' && discountValue > 100) {
      return res.status(400).json({
        success: false,
        message: 'Percentage discount cannot exceed 100%'
      });
    }

    // Validate dates
    const validFromDate = validFrom ? new Date(validFrom) : new Date();
    const validUntilDate = new Date(validUntil);
    
    if (validUntilDate <= validFromDate) {
      return res.status(400).json({
        success: false,
        message: 'Valid until date must be after valid from date'
      });
    }

    const promoCodeData = {
      code: code.toUpperCase().trim(),
      description: description || '',
      discountType,
      discountValue,
      maxDiscountAmount: maxDiscountAmount || null,
      minimumOrderAmount: minimumOrderAmount || 0,
      targetType,
      targetProducts: targetType === 'specific' ? targetProducts : [],
      targetCategories: targetType === 'category' ? targetCategories : [],
      usageLimit: usageLimit || null,
      validFrom: validFromDate,
      validUntil: validUntilDate,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: user._id
    };

    const promoCode = await PromoCode.create(promoCodeData);

    res.status(201).json({
      success: true,
      message: 'Promo code created successfully',
      data: promoCode
    });
  } catch (error) {
    console.error('Create promo code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create promo code',
      error: error.message
    });
  }
});

// @desc    Get all promo codes
// @route   GET /api/promo-codes
// @access  Private (Admin)
const getPromoCodes = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 20, search, isActive, targetType, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const user = req.user;

    let query = {};

    // Search functionality
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by active status
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // Filter by target type
    if (targetType && targetType !== 'all') {
      query.targetType = targetType;
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const promoCodes = await PromoCode.find(query)
      .populate('createdBy', 'name email')
      .populate('targetProducts', 'name price category')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await PromoCode.countDocuments(query);

    res.json({
      success: true,
      data: promoCodes,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get promo codes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch promo codes',
      error: error.message
    });
  }
});

// @desc    Get promo code by ID
// @route   GET /api/promo-codes/:id
// @access  Private (Admin)
const getPromoCode = asyncHandler(async (req, res) => {
  try {
    const promoCode = await PromoCode.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('targetProducts', 'name price category')
      .populate('usageHistory.userId', 'name email')
      .populate('usageHistory.productId', 'name price');

    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: 'Promo code not found'
      });
    }

    res.json({
      success: true,
      data: promoCode
    });
  } catch (error) {
    console.error('Get promo code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch promo code',
      error: error.message
    });
  }
});

// @desc    Update promo code
// @route   PUT /api/promo-codes/:id
// @access  Private (Admin)
const updatePromoCode = asyncHandler(async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      maxDiscountAmount,
      minimumOrderAmount,
      targetType,
      targetProducts,
      targetCategories,
      usageLimit,
      validFrom,
      validUntil,
      isActive
    } = req.body;

    const promoCode = await PromoCode.findById(req.params.id);

    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: 'Promo code not found'
      });
    }

    // Validate target products if targetType is 'specific'
    if (targetType === 'specific' && targetProducts && targetProducts.length > 0) {
      const existingProducts = await Product.find({ _id: { $in: targetProducts } });
      if (existingProducts.length !== targetProducts.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more target products do not exist'
        });
      }
    }

    // Validate discount value
    if (discountType === 'percentage' && discountValue > 100) {
      return res.status(400).json({
        success: false,
        message: 'Percentage discount cannot exceed 100%'
      });
    }

    // Validate dates
    const validFromDate = validFrom ? new Date(validFrom) : promoCode.validFrom;
    const validUntilDate = validUntil ? new Date(validUntil) : promoCode.validUntil;
    
    if (validUntilDate <= validFromDate) {
      return res.status(400).json({
        success: false,
        message: 'Valid until date must be after valid from date'
      });
    }

    // Update fields
    if (code) promoCode.code = code.toUpperCase().trim();
    if (description !== undefined) promoCode.description = description;
    if (discountType) promoCode.discountType = discountType;
    if (discountValue !== undefined) promoCode.discountValue = discountValue;
    if (maxDiscountAmount !== undefined) promoCode.maxDiscountAmount = maxDiscountAmount;
    if (minimumOrderAmount !== undefined) promoCode.minimumOrderAmount = minimumOrderAmount;
    if (targetType) promoCode.targetType = targetType;
    if (targetProducts !== undefined) promoCode.targetProducts = targetType === 'specific' ? targetProducts : [];
    if (targetCategories !== undefined) promoCode.targetCategories = targetType === 'category' ? targetCategories : [];
    if (usageLimit !== undefined) promoCode.usageLimit = usageLimit;
    if (validFrom) promoCode.validFrom = validFromDate;
    if (validUntil) promoCode.validUntil = validUntilDate;
    if (isActive !== undefined) promoCode.isActive = isActive;

    await promoCode.save();

    res.json({
      success: true,
      message: 'Promo code updated successfully',
      data: promoCode
    });
  } catch (error) {
    console.error('Update promo code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update promo code',
      error: error.message
    });
  }
});

// @desc    Delete promo code
// @route   DELETE /api/promo-codes/:id
// @access  Private (Admin)
const deletePromoCode = asyncHandler(async (req, res) => {
  try {
    const promoCode = await PromoCode.findById(req.params.id);

    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: 'Promo code not found'
      });
    }

    // Check if promo code has been used
    if (promoCode.usedCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete promo code that has been used. You can deactivate it instead.'
      });
    }

    await PromoCode.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Promo code deleted successfully'
    });
  } catch (error) {
    console.error('Delete promo code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete promo code',
      error: error.message
    });
  }
});

// @desc    Validate promo code for a product
// @route   POST /api/promo-codes/validate
// @access  Private
const validatePromoCode = asyncHandler(async (req, res) => {
  try {
    const { code, productId, orderAmount } = req.body;

    if (!code || !productId) {
      return res.status(400).json({
        success: false,
        message: 'Promo code and product ID are required'
      });
    }

    const promoCode = await PromoCode.findOne({ 
      code: code.toUpperCase().trim(),
      isActive: true
    });

    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: 'Invalid promo code'
      });
    }

    // Check if promo code is valid
    if (!promoCode.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Promo code is not valid or has expired'
      });
    }

    // Get product details
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if promo code is applicable to this product
    if (!promoCode.isApplicableToProduct(product)) {
      return res.status(400).json({
        success: false,
        message: 'Promo code is not applicable to this product'
      });
    }

    // Check minimum order amount
    const checkAmount = orderAmount || product.price;
    if (checkAmount < promoCode.minimumOrderAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount of $${promoCode.minimumOrderAmount} required for this promo code`
      });
    }

    // Calculate discount
    const discountAmount = promoCode.calculateDiscount(checkAmount);
    const finalPrice = checkAmount - discountAmount;

    res.json({
      success: true,
      data: {
        promoCode: {
          id: promoCode._id,
          code: promoCode.code,
          description: promoCode.description,
          discountType: promoCode.discountType,
          discountValue: promoCode.discountValue,
          formattedDiscount: promoCode.formattedDiscount
        },
        originalPrice: checkAmount,
        discountAmount,
        finalPrice,
        savings: discountAmount
      }
    });
  } catch (error) {
    console.error('Validate promo code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate promo code',
      error: error.message
    });
  }
});

// @desc    Get promo code statistics
// @route   GET /api/promo-codes/stats
// @access  Private (Admin)
const getPromoCodeStats = asyncHandler(async (req, res) => {
  try {
    const totalPromoCodes = await PromoCode.countDocuments();
    const activePromoCodes = await PromoCode.countDocuments({ isActive: true });
    const expiredPromoCodes = await PromoCode.countDocuments({ 
      validUntil: { $lt: new Date() } 
    });
    const usedPromoCodes = await PromoCode.countDocuments({ usedCount: { $gt: 0 } });

    // Get total discount given
    const totalDiscountResult = await PromoCode.aggregate([
      {
        $group: {
          _id: null,
          totalDiscount: { $sum: { $multiply: ['$usedCount', '$discountValue'] } }
        }
      }
    ]);

    const totalDiscountGiven = totalDiscountResult.length > 0 ? totalDiscountResult[0].totalDiscount : 0;

    res.json({
      success: true,
      data: {
        totalPromoCodes,
        activePromoCodes,
        expiredPromoCodes,
        usedPromoCodes,
        totalDiscountGiven
      }
    });
  } catch (error) {
    console.error('Get promo code stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch promo code statistics',
      error: error.message
    });
  }
});

// @desc    Validate promo code by code (simple validation)
// @route   GET /api/promo-codes/validate/:code
// @access  Private
const validatePromoCodeByCode = asyncHandler(async (req, res) => {
  try {
    const { code } = req.params;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Promo code is required'
      });
    }

    const promoCode = await PromoCode.findOne({ 
      code: code.toUpperCase().trim()
    });

    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: 'Invalid promo code'
      });
    }

    // Check if promo code is active
    if (!promoCode.isActive) {
      return res.status(400).json({
        success: false,
        message: 'This promo code is not active'
      });
    }

    // Check validity dates
    const now = new Date();
    if (promoCode.validFrom && now < new Date(promoCode.validFrom)) {
      return res.status(400).json({
        success: false,
        message: 'This promo code is not yet valid'
      });
    }

    if (promoCode.validUntil && now > new Date(promoCode.validUntil)) {
      return res.status(400).json({
        success: false,
        message: 'This promo code has expired',
        expiryDate: promoCode.validUntil
      });
    }

    // Check usage limit
    if (promoCode.usageLimit && promoCode.usedCount >= promoCode.usageLimit) {
      return res.status(400).json({
        success: false,
        message: 'This promo code has reached its usage limit'
      });
    }

    // Return promo code details
    res.json({
      success: true,
      message: 'Promo code is valid',
      data: {
        _id: promoCode._id,
        code: promoCode.code,
        description: promoCode.description,
        discountType: promoCode.discountType,
        discountValue: promoCode.discountValue,
        maxDiscountAmount: promoCode.maxDiscountAmount,
        minPurchaseAmount: promoCode.minimumOrderAmount,
        targetType: promoCode.targetType,
        usageLimit: promoCode.usageLimit,
        usageCount: promoCode.usedCount,
        expiryDate: promoCode.validUntil,
        isActive: promoCode.isActive
      }
    });
  } catch (error) {
    console.error('Validate promo code by code error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate promo code',
      error: error.message
    });
  }
});

module.exports = {
  createPromoCode,
  getPromoCodes,
  getPromoCode,
  updatePromoCode,
  deletePromoCode,
  validatePromoCode,
  validatePromoCodeByCode,
  getPromoCodeStats
};
