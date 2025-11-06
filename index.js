const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
// const rateLimit = require('express-rate-limit'); // Disabled for file uploads
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Load environment variables
dotenv.config({ path: './config.env' });

// Import routes
const authRoutes = require('./routes/auth');
const schoolRoutes = require('./routes/schools');
const userRoutes = require('./routes/users');
const courseRoutes = require('./routes/courses');
const productRoutes = require('./routes/products');
const schoolProductRoutes = require('./routes/schoolProducts');
const billingRoutes = require('./routes/billing');
const adRoutes = require('./routes/ads');
const photoRoutes = require('./routes/photos');
const promoCodeRoutes = require('./routes/promoCodes');
const teacherRoutes = require('./routes/teachers');
const classRoutes = require('./routes/classes');
const subjectRoutes = require('./routes/subjects');
const studentRoutes = require('./routes/students');
const parentRoutes = require('./routes/parents');
const scheduleRoutes = require('./routes/schedules');
const teacherAttendanceRoutes = require('./routes/teacherAttendance');
const attendanceRoutes = require('./routes/attendance');
const messageRoutes = require('./routes/messages');
const assignmentRoutes = require('./routes/assignments');
const notificationRoutes = require('./routes/notifications');
const subjectCourseRoutes = require('./routes/subjectCourses');
const transportRouteRoutes = require('./routes/transportRoutes');
const vehicleRoutes = require('./routes/vehicles');
const driverRoutes = require('./routes/drivers');
const studentTransportRoutes = require('./routes/studentTransports');
const examRoutes = require('./routes/exams');
const feeCategoryRoutes = require('./routes/feeCategories');
const feeStructureRoutes = require('./routes/feeStructures');
const feeCollectionRoutes = require('./routes/feeCollections');
const feeReceiptRoutes = require('./routes/feeReceipts');
const salaryRoutes = require('./routes/salaries');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');
const quizRoutes = require('./routes/quizzes');
const adminQuizRoutes = require('./routes/adminQuizzes');
const doubtRoutes = require('./routes/doubts');
const meetingRoutes = require('./routes/meetings');
const bookRoutes = require('./routes/books');
const bookBorrowingRoutes = require('./routes/bookBorrowings');
const coCurricularRoutes = require('./routes/coCurricular');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const { verifyToken } = require('./middleware/auth');

// Import socket handlers
const socketHandler = require('./socket/socketHandler');

// Import setSocketIO functions from controllers
const { setSocketIO: setMessageSocketIO } = require('./controllers/messageController');
const { setSocketIO: setAssignmentSocketIO } = require('./controllers/assignmentController');
const { setSocketIO: setNoteSocketIO } = require('./controllers/noteController');
const { setSocketIO: setQuizSocketIO } = require('./controllers/quizController');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      // Get allowed origins from environment variable
      const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:4000';
      const allowedOrigins = allowedOriginsEnv.split(',').map(origin => origin.trim());
      
      // Allow requests with no origin (like mobile apps)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

// Security middleware - Configured for file uploads
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
}));
app.use(compression());

// Serve static files (uploaded documents)
  app.use('/uploads', express.static('/var/www/Sparkology/uploads'));
// Rate limiting - DISABLED for file uploads
// const limiter = rateLimit({
//   windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
//   max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000'), // limit each IP to 1000 requests per windowMs
//   message: {
//     error: 'Too many requests from this IP, please try again later.',
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
// });
// app.use('/api/', limiter);

// CORS configuration
const corsOptions = {
  origin: '*', // Allow all origins for file uploads
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Access-Control-Request-Method', 'Access-Control-Request-Headers'],
  optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
  preflightContinue: false,
};

app.use(cors(corsOptions));

// Handle preflight OPTIONS requests explicitly
app.options('*', cors(corsOptions));

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`🔍 ${req.method} ${req.url}`);
  console.log('   Headers:', req.headers);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('   Body:', req.body);
  }
  next();
});

// Body parsing middleware - Increased limits for large video uploads
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Increase server timeout for large file uploads
app.use((req, res, next) => {
  // Set timeout to 30 minutes for file uploads
  req.setTimeout(30 * 60 * 1000);
  res.setTimeout(30 * 60 * 1000);
  next();
});

// Handle large file uploads (photos and videos for fact of the day)
app.use('/api/photos/upload', (req, res, next) => {
  // Increase limit for photo/video uploads - videos can be large
  req.setTimeout(2 * 60 * 60 * 1000); // 2 hours for large video uploads
  res.setTimeout(2 * 60 * 60 * 1000);
  next();
});

app.use('/api/courses/*/videos/upload', (req, res, next) => {
  // Increase limit for video uploads - 2 hours for very large files
  req.setTimeout(2 * 60 * 60 * 1000); // 2 hours
  res.setTimeout(2 * 60 * 60 * 1000);
  next();
});

app.use('/api/subject-courses/*/videos/upload', (req, res, next) => {
  // Increase limit for video uploads - 2 hours for very large files
  req.setTimeout(2 * 60 * 60 * 1000); // 2 hours
  res.setTimeout(2 * 60 * 60 * 1000);
  next();
});

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Root endpoint for health checks (handles both GET and HEAD)
app.all('/', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Master Portal Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// CORS test endpoint
app.get('/api/cors-test', (req, res) => {
  res.status(200).json({
    message: 'CORS is working!',
    origin: req.headers.origin,
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173,http://localhost:4000'],
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/products', productRoutes);
app.use('/api/school-products', schoolProductRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/promo-codes', promoCodeRoutes);
app.use('/api/ads', adRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/parents', parentRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/teacher-attendance', teacherAttendanceRoutes);
app.use('/api/important-dates', require('./routes/importantDates'));
app.use('/api/messages', messageRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/groups', require('./routes/groups'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/meetings', meetingRoutes);
app.use('/api/subject-courses', subjectCourseRoutes);
app.use('/api/transport-routes', transportRouteRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/student-transports', studentTransportRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/fee-categories', feeCategoryRoutes);
app.use('/api/fee-structures', feeStructureRoutes);
app.use('/api/fee-collections', feeCollectionRoutes);
app.use('/api/fee-receipts', feeReceiptRoutes);
app.use('/api/salaries', salaryRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/admin-quizzes', adminQuizRoutes);
app.use('/api/student-quiz-battle', require('./routes/studentQuizBattle'));
app.use('/api/doubts', doubtRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/book-borrowings', bookBorrowingRoutes);
app.use('/api/co-curricular', coCurricularRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// WebSocket authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      console.log('❌ WebSocket Auth: No token provided');
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = verifyToken(token);
    console.log('🔐 WebSocket Auth: Token decoded:', {
      id: decoded.id,
      role: decoded.role,
      schoolId: decoded.schoolId,
      email: decoded.email
    });

    // Debug: Check if the ID is a valid ObjectId
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(decoded.id)) {
      console.log('❌ WebSocket Auth: Invalid ObjectId in token:', decoded.id);
      return next(new Error('Authentication error: Invalid user ID in token'));
    }

    const User = require('./models/User');
    const Student = require('./models/Student');
    
    let user;
    console.log('🔍 WebSocket Auth: Looking up user with role:', decoded.role, 'and ID:', decoded.id);
    
    if (decoded.role === 'student') {
      console.log('🔍 WebSocket Auth: Looking in Student model...');
      user = await Student.findById(decoded.id).select('-password');
      if (user) {
        user.role = 'student';
        console.log('✅ WebSocket Auth: Student found:', user.name);
      } else {
        console.log('❌ WebSocket Auth: Student not found with ID:', decoded.id);
      }
    } else if (decoded.role === 'parent') {
      // For parent role, find the parent record directly
      console.log('🔍 WebSocket Auth: Looking in Parent model...');
      const Parent = require('./models/Parent');
      user = await Parent.findById(decoded.id).select('-password');
      if (user) {
        console.log('✅ WebSocket Auth: Parent found:', user.name, user.email);
        user.role = 'parent';
        // Parent record already has the correct data
      } else {
        console.log('❌ WebSocket Auth: Parent not found with ID:', decoded.id);
      }
    } else if (decoded.role) {
      // If role is specified, look in the appropriate model
      console.log('🔍 WebSocket Auth: Looking in User model for role:', decoded.role);
      user = await User.findById(decoded.id).select('-password');
      if (user) {
        console.log('✅ WebSocket Auth: User found:', user.name);
      } else {
        console.log('❌ WebSocket Auth: User not found with ID:', decoded.id);
      }
    } else {
      // If no role in token, check both models (backward compatibility)
      console.log('🔍 WebSocket Auth: No role specified, checking both models...');
      user = await User.findById(decoded.id).select('-password');
      if (!user) {
        console.log('🔍 WebSocket Auth: Not found in User model, checking Student model...');
        user = await Student.findById(decoded.id).select('-password');
        if (user) {
          user.role = 'student';
          console.log('✅ WebSocket Auth: Student found (backward compatibility):', user.name);
        } else {
          console.log('❌ WebSocket Auth: Not found in either model with ID:', decoded.id);
        }
      } else {
        console.log('✅ WebSocket Auth: User found (backward compatibility):', user.name);
      }
    }

    if (!user) {
      console.log('❌ WebSocket Auth: User not found in database for ID:', decoded.id);
      return next(new Error('Authentication error: User not found'));
    }

    console.log('✅ WebSocket Auth: User found:', {
      id: user._id,
      role: user.role,
      schoolId: user.schoolId,
      email: user.email,
      isActive: user.isActive,
      isLocked: user.isLocked
    });

    // Check if user is active
    if (!user.isActive) {
      console.log('❌ WebSocket Auth: User account is deactivated');
      return next(new Error('Authentication error: User account is deactivated'));
    }

    // Check if user is locked
    if (user.isLocked) {
      console.log('❌ WebSocket Auth: User account is locked');
      return next(new Error('Authentication error: User account is locked'));
    }

    socket.userId = user._id;
    socket.userRole = user.role;
    socket.schoolId = user.schoolId;
    socket.user = user;
    
    console.log('✅ WebSocket Auth: Authentication successful for user:', user.name);
    next();
  } catch (error) {
    console.log('❌ WebSocket Auth: Authentication failed:', error.message);
    next(new Error('Authentication error: Invalid token'));
  }
});

// Set global.io for use in controllers
global.io = io;

// Inject WebSocket instance into controllers
console.log('🔌 Main Server: Injecting SocketIO into controllers...');
setMessageSocketIO(io);
setAssignmentSocketIO(io);
setNoteSocketIO(io);
setQuizSocketIO(io);
console.log('🔌 Main Server: SocketIO injection completed');

// WebSocket connection handling
io.on('connection', (socket) => {
  socketHandler(io, socket);
});

// Database connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lmsss-portal';
    
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB connected successfully');
    
    // Create default admin user if it doesn't exist
    await createDefaultAdmin();
    
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n🔧 MongoDB Connection Issue:');
      console.log('   MongoDB is not running on your system.');
      console.log('\n📋 Quick Solutions:');
      console.log('   1. Install MongoDB: https://www.mongodb.com/try/download/community');
      console.log('   2. Or use MongoDB Atlas (cloud): https://www.mongodb.com/atlas');
      console.log('   3. Or use Docker: docker run -d -p 27017:27017 mongo');
      console.log('\n🚀 After installing MongoDB, run: npm run dev');
      console.log('   Or create admin user manually: node scripts/createAdmin.js');
    }
    
    console.log('\n⏳ Server will continue running but database features will be unavailable.');
    console.log('   Fix MongoDB connection and restart the server.');
  }
};

// Create default admin user
const createDefaultAdmin = async () => {
  try {
    const User = require('./models/User');
    
    const adminExists = await User.findOne({ role: 'admin' });
    
    if (!adminExists) {
      const adminUser = new User({
        name: 'System Administrator',
        email: 'admin@masterportal.com',
        password: 'admin123', // Let the pre-save middleware handle hashing
        role: 'admin',
        isActive: true,
      });
      
      await adminUser.save();
      console.log('✅ Default admin user created:');
      console.log('   Email: admin@masterportal.com');
      console.log('   Password: admin123');
      console.log('   ⚠️  Please change the default password after first login!');
    }
  } catch (error) {
    console.error('❌ Error creating default admin:', error);
  }
};

// Start server
const startServer = async () => {
  // Try to connect to database (non-blocking)
  connectDB();
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
    console.log(`📚 API Base URL: http://localhost:${PORT}/api`);
    console.log(`🔌 WebSocket Server: ws://localhost:${PORT}`);
    console.log(`\n👤 Default Admin Credentials:`);
    console.log(`   Email: admin@masterportal.com`);
    console.log(`   Password: admin123`);
  });
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err.message);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  mongoose.connection.close(() => {
    console.log('📦 MongoDB connection closed');
    process.exit(0);
  });
});

startServer();

module.exports = app;
