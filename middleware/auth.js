const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Student = require('../models/Student');
const Parent = require('../models/Parent');

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('🔐 Token decoded:', {
        id: decoded.id,
        role: decoded.role,
        schoolId: decoded.schoolId,
        email: decoded.email
      });
      
      // Get user from token - check both User and Student models based on role
      let user;
      if (decoded.role === 'student') {
        user = await Student.findById(decoded.id).select('-password');
        if (user) {
          user.role = 'student'; // Ensure role is set
        }
      } else if (decoded.role === 'parent') {
        // For parent role, find the parent record directly
        user = await Parent.findById(decoded.id).select('-password');
        if (user) {
          // Parent record already has the correct role and data
          user.role = 'parent';
          
          // If parent doesn't have schoolId, get it from the associated student
          if (!user.schoolId && user.studentId) {
            try {
              const student = await Student.findById(user.studentId).select('schoolId');
              if (student && student.schoolId) {
                user.schoolId = student.schoolId;
              }
            } catch (error) {
              console.log('Error getting schoolId from student:', error);
            }
          }
        }
      } else if (decoded.role) {
        // If role is specified, look in the appropriate model
        user = await User.findById(decoded.id).select('-password');
      } else {
        // If no role in token, check both models (backward compatibility)
        user = await User.findById(decoded.id).select('-password');
        if (!user) {
          user = await Student.findById(decoded.id).select('-password');
          if (user) {
            user.role = 'student'; // Ensure role is set
          }
        }
      }
      
      if (!user) {
        console.log('   ❌ User not found in database');
        console.log('   🔍 Token details:', {
          id: decoded.id,
          role: decoded.role,
          email: decoded.email,
          searchedIn: decoded.role === 'student' ? 'Student model' : decoded.role === 'parent' ? 'Parent model' : 'User model'
        });
        return res.status(401).json({
          success: false,
          error: 'Token is valid but user no longer exists.'
        });
      }

      console.log('🔐 User found:', {
        id: user._id,
        role: user.role,
        schoolId: user.schoolId,
        email: user.email,
        isActive: user.isActive,
        isLocked: user.isLocked
      });

      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          error: 'User account is deactivated.'
        });
      }

      // Check if user is locked
      if (user.isLocked) {
        return res.status(401).json({
          success: false,
          error: 'User account is locked due to multiple failed login attempts.'
        });
      }

      // Debug logging for school admin requests
      if (user.role === 'school_admin') {
        console.log(`🔐 School Admin authenticated: ${user.name} (${user.email})`);
        console.log(`   School ID: ${user.schoolId}`);
        console.log(`   User ID: ${user._id}`);
      }
      
      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token.'
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Server error during authentication.'
    });
  }
};

// Authorize specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    // Flatten roles array to handle both single roles and arrays of roles
    const flattenedRoles = roles.flat();
    
    console.log('🔐 Authorization Check:');
    console.log('   User:', req.user ? {
      id: req.user._id,
      role: req.user.role,
      schoolId: req.user.schoolId,
      email: req.user.email
    } : 'No user');
    console.log('   Required roles:', flattenedRoles);
    console.log('   User role:', req.user?.role);
    console.log('   Role match:', req.user ? flattenedRoles.includes(req.user.role) : false);

    if (!req.user) {
      console.log('   ❌ No user in request');
      return res.status(401).json({
        success: false,
        error: 'Access denied. User not authenticated.'
      });
    }

    if (!flattenedRoles.includes(req.user.role)) {
      console.log('   ❌ Role mismatch');
      return res.status(403).json({
        success: false,
        error: `Access denied. Required role: ${flattenedRoles.join(' or ')}. Your role: ${req.user.role}`
      });
    }

    console.log('   ✅ Authorization passed');
    next();
  };
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Admin privileges required.'
    });
  }
  next();
};

// Check if user is school admin
const isSchoolAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'school_admin') {
    return res.status(403).json({
      success: false,
      error: 'Access denied. School admin privileges required.'
    });
  }
  next();
};

// Check if user owns the resource or is admin
const isOwnerOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Access denied. User not authenticated.'
    });
  }

  // Admin can access everything
  if (req.user.role === 'admin') {
    return next();
  }

  // Check if user owns the resource
  const resourceId = req.params.id || req.params.userId || req.params.schoolId;
  
  if (req.user._id.toString() === resourceId || req.user.schoolId?.toString() === resourceId) {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: 'Access denied. You can only access your own resources.'
  });
};

// Optional authentication - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        let user;
        
        if (decoded.role === 'student') {
          user = await Student.findById(decoded.id).select('-password');
          if (user) {
            user.role = 'student';
          }
        } else if (decoded.role === 'parent') {
          // For parent role, find the parent record directly
          user = await Parent.findById(decoded.id).select('-password');
          if (user) {
            // Parent record already has the correct role and data
            user.role = 'parent';
          }
        } else if (decoded.role) {
          // If role is specified, look in the appropriate model
          user = await User.findById(decoded.id).select('-password');
        } else {
          // If no role in token, check both models (backward compatibility)
          user = await User.findById(decoded.id).select('-password');
          if (!user) {
            user = await Student.findById(decoded.id).select('-password');
            if (user) {
              user.role = 'student';
            }
          }
        }
        
        if (user && user.isActive && !user.isLocked) {
          req.user = user;
        }
      } catch (error) {
        // Token is invalid, but we continue without user
        console.log('Invalid token in optional auth:', error.message);
      }
    }

    next();
  } catch (error) {
    next();
  }
};

// Generate JWT token
const generateToken = (user) => {
  // Determine role based on model type or explicit role
  let role = user.role;
  
  if (!role) {
    // Check model type by constructor name or model name
    const modelName = user.constructor?.modelName || user.modelName || '';
    
    // If no role field, determine based on model type
    if (modelName === 'Student') {
      role = 'student';
    } else if (modelName === 'Parent') {
      role = 'parent';
    } else if (user.rollNumber !== undefined) {
      // Fallback: if rollNumber exists, it's a student
      role = 'student';
    } else if (user.parentType) {
      // Fallback: if parentType exists, it's a parent
      role = 'parent';
    } else {
      role = 'user'; // Default fallback for User model
    }
  }
  
  console.log('🔐 generateToken: Setting role:', {
    userId: user._id,
    email: user.email,
    modelName: user.constructor?.modelName || user.modelName,
    hasRollNumber: user.rollNumber !== undefined,
    explicitRole: user.role,
    finalRole: role
  });
  
  return jwt.sign({ 
    id: user._id,
    role: role,
    schoolId: user.schoolId,
    email: user.email
  }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

// Generate refresh token
const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d',
  });
};

// Verify JWT token (used for WebSocket authentication)
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
};

module.exports = {
  protect,
  authorize,
  isAdmin,
  isSchoolAdmin,
  isOwnerOrAdmin,
  optionalAuth,
  generateToken,
  generateRefreshToken,
  verifyToken
};
