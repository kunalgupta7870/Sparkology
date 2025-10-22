const Order = require('../models/Order');

// @desc    Check if user has purchased a course
// @route   GET /api/courses/:courseId/purchased
// @access  Private
exports.hasPurchasedCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user._id;
    
    console.log(`🔍 Checking if user ${userId} purchased course ${courseId}`);
    
    // Find any successful order containing this course
    const order = await Order.findOne({
      userId,
      'items.courseId': courseId,
      status: { $in: ['pending', 'processing', 'completed', 'delivered'] }
    });
    
    const hasPurchased = !!order;
    
    console.log(`✅ Purchase status for course ${courseId}: ${hasPurchased}`);
    
    res.status(200).json({
      success: true,
      data: {
        hasPurchased,
        orderId: order?._id,
        orderNumber: order?.orderNumber,
        purchaseDate: order?.createdAt
      }
    });
  } catch (error) {
    console.error('Error checking course purchase:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check course purchase',
      message: error.message
    });
  }
};

// @desc    Get all purchased courses for current user
// @route   GET /api/courses/purchases/my-courses
// @access  Private
exports.getMyPurchasedCourses = async (req, res) => {
  try {
    const userId = req.user._id;
    
    console.log(`📚 Getting purchased courses for user ${userId}`);
    
    // Find all successful orders with courses
    const orders = await Order.find({
      userId,
      status: { $in: ['pending', 'processing', 'completed', 'delivered'] }
    }).populate('items.courseId', 'name instructor thumbnail category price duration videos');
    
    // Extract unique courses
    const coursesMap = new Map();
    
    orders.forEach(order => {
      order.items.forEach(item => {
        if (item.courseId && item.type === 'course') {
          const courseId = item.courseId._id.toString();
          if (!coursesMap.has(courseId)) {
            coursesMap.set(courseId, {
              ...item.courseId.toObject(),
              purchaseDate: order.createdAt,
              orderNumber: order.orderNumber
            });
          }
        }
      });
    });
    
    const courses = Array.from(coursesMap.values());
    
    console.log(`✅ Found ${courses.length} purchased courses`);
    
    res.status(200).json({
      success: true,
      data: courses
    });
  } catch (error) {
    console.error('Error getting purchased courses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get purchased courses',
      message: error.message
    });
  }
};

module.exports = exports;

