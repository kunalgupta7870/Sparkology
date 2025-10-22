const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary with extended timeout for large uploads
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  api_timeout: 600000, // 10 minutes timeout for large uploads
  upload_timeout: 600000, // 10 minutes upload timeout
});

// Configure multer for photo uploads
const photoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'master-portal/photos',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    // Removed eager transformations to speed up uploads
    // Transformations will be applied on-the-fly when accessing images
    resource_type: 'image'
  },
});

// Configure multer for product image uploads
const productImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'master-portal/products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    resource_type: 'image'
  },
});

// Configure multer for video uploads with optimized settings for large files
const videoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'master-portal/videos',
      allowed_formats: ['mp4', 'mov', 'avi', 'mkv', 'webm'],
      resource_type: 'video',
      chunk_size: 20000000, // 20MB chunks for faster large file uploads
      timeout: 600000, // 10 minutes timeout per chunk
      // Removed eager transformations to speed up uploads
      // Thumbnails will be generated on-the-fly when needed
    };
  },
});

// Configure multer for document uploads (PDFs, etc.) - Local Storage
const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = require('path').join(__dirname, '../uploads/documents');
    const fs = require('fs');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = require('path').extname(file.originalname);
    cb(null, 'assignment-' + uniqueSuffix + ext);
  }
});

// Multer upload middleware for photos
const uploadPhoto = multer({
  storage: photoStorage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit for photos
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Multer upload middleware for product images
const uploadProductImage = multer({
  storage: productImageStorage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit for product images
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Multer upload middleware for videos
const uploadVideo = multer({
  storage: videoStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 * 1024, // 5GB limit for long videos (1-2 hours)
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'), false);
    }
  }
});

// Multer upload middleware for documents
const uploadDocument = multer({
  storage: documentStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for documents
    files: 5 // Allow up to 5 files
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype === 'application/pdf' || 
        file.mimetype === 'application/msword' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX, and TXT files are allowed'), false);
    }
  }
});

// Utility functions
const uploadToCloudinary = {
  // Upload photo with custom options
  uploadPhoto: async (filePath, options = {}) => {
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        folder: 'master-portal/photos',
        resource_type: 'image',
        transformation: [
          { width: 1920, height: 1080, crop: 'limit', quality: 'auto' },
          { format: 'auto' }
        ],
        ...options
      });
      return result;
    } catch (error) {
      throw new Error(`Photo upload failed: ${error.message}`);
    }
  },

  // Upload video with custom options
  uploadVideo: async (filePath, options = {}) => {
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        folder: 'master-portal/videos',
        resource_type: 'video',
        chunk_size: 6000000,
        eager: [
          { width: 300, height: 200, crop: 'pad', format: 'jpg' },
          { width: 640, height: 480, crop: 'limit', format: 'mp4' }
        ],
        eager_async: true,
        ...options
      });
      return result;
    } catch (error) {
      throw new Error(`Video upload failed: ${error.message}`);
    }
  },

  // Upload document with custom options
  uploadDocument: async (filePath, options = {}) => {
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        folder: 'master-portal/documents',
        resource_type: 'raw',
        timeout: 600000, // 10 minutes timeout
        ...options
      });
      return result;
    } catch (error) {
      throw new Error(`Document upload failed: ${error.message}`);
    }
  },

  // Upload PDF from buffer (for direct uploads)
  uploadPdfFromBuffer: async (buffer, filename, options = {}) => {
    try {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'master-portal/documents',
            resource_type: 'raw',
            public_id: filename,
            format: 'pdf',
            timeout: 600000,
            ...options
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(buffer);
      });
    } catch (error) {
      throw new Error(`PDF upload failed: ${error.message}`);
    }
  },

  // Delete resource from Cloudinary
  deleteResource: async (publicId, resourceType = 'image') => {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType
      });
      return result;
    } catch (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }
  },

  // Delete document from Cloudinary
  deleteDocument: async (publicId) => {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'raw'
      });
      return result;
    } catch (error) {
      throw new Error(`Document delete failed: ${error.message}`);
    }
  },

  // Generate thumbnail URL
  generateThumbnailUrl: (publicId, width = 300, height = 200) => {
    return cloudinary.url(publicId, {
      width,
      height,
      crop: 'pad',
      format: 'jpg',
      quality: 'auto'
    });
  },

  // Generate video thumbnail URL
  generateVideoThumbnailUrl: (publicId, time = '00:00:01') => {
    return cloudinary.url(publicId, {
      resource_type: 'video',
      start_offset: time,
      width: 300,
      height: 200,
      crop: 'pad',
      format: 'jpg',
      quality: 'auto'
    });
  },

  // Get video duration
  getVideoDuration: async (publicId) => {
    try {
      console.log('   🔍 Cloudinary API: Fetching video resource for:', publicId);
      
      const result = await cloudinary.api.resource(publicId, {
        resource_type: 'video',
        image_metadata: true,
        colors: false,
        faces: false,
        quality_analysis: false,
        accessibility_analysis: false,
        cinemagraph_analysis: false
      });
      
      console.log('   ✅ Cloudinary API response received');
      console.log('   ⏱️ Duration:', result.duration, 'seconds');
      console.log('   📐 Format:', result.format);
      console.log('   📦 Bytes:', result.bytes);
      
      return result.duration || 0; // Duration in seconds
    } catch (error) {
      console.error('   ❌ Error getting video duration from Cloudinary API:', error.message);
      console.error('   📝 Error details:', {
        statusCode: error.http_code,
        message: error.message
      });
      return 0;
    }
  },

  // Transform image URL
  transformImage: (publicId, transformations = {}) => {
    return cloudinary.url(publicId, {
      ...transformations,
      format: 'auto',
      quality: 'auto'
    });
  },

  // Transform video URL
  transformVideo: (publicId, transformations = {}) => {
    return cloudinary.url(publicId, {
      resource_type: 'video',
      ...transformations,
      format: 'auto'
    });
  }
};

// Error handling middleware for multer
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Please upload a smaller file.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Please upload only one file at a time.'
      });
    }
  }
  
  if (error.message === 'Only image files are allowed') {
    return res.status(400).json({
      success: false,
      message: 'Invalid file type. Only image files are allowed.'
    });
  }
  
  if (error.message === 'Only video files are allowed') {
    return res.status(400).json({
      success: false,
      message: 'Invalid file type. Only video files are allowed.'
    });
  }
  
  if (error.message.includes('Only PDF, DOC, DOCX, and TXT files are allowed')) {
    return res.status(400).json({
      success: false,
      message: 'Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.'
    });
  }
  
  next(error);
};

module.exports = {
  cloudinary,
  uploadPhoto,
  uploadProductImage,
  uploadVideo,
  uploadDocument,
  uploadToCloudinary,
  handleUploadError
};
