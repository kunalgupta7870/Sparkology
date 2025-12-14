// Test student creation with the fixed index
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testStudentCreation() {
  try {
    console.log('🧪 Testing student creation with fixed sparse index...\n');

    // Sample student data (without rollNumber to trigger the null value condition)
    const studentData = {
      firstName: 'TestStudent',
      lastName: 'Creation',
      studentName: 'TestStudent Creation', // Also add this field
      email: `teststudent${Date.now()}@school.com`,
      password: 'password123',
      phone: `9876543${String(Math.random()).slice(2, 5)}`,
      dateOfBirth: '2010-05-15',
      gender: 'male', // Must be lowercase
      address: 'Test Address',
      classId: '6933135006780cd31d1831e0',
      parentId: '693307b775c51ca1c93cb74f',
      // NO rollNumber - this is what triggers the E11000 error if index is not sparse
    };

    // Create a form with file (avatar)
    const form = new FormData();
    
    // Add all student fields
    Object.keys(studentData).forEach(key => {
      form.append(key, studentData[key]);
    });

    // Add a dummy avatar file
    const dummyImagePath = path.join(__dirname, 'dummy-avatar.png');
    
    // Create a simple PNG file if it doesn't exist
    if (!fs.existsSync(dummyImagePath)) {
      // Create a minimal PNG (1x1 pixel transparent)
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
        0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, // IDAT chunk
        0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, // IEND chunk
        0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
        0xAE, 0x42, 0x60, 0x82
      ]);
      fs.writeFileSync(dummyImagePath, pngBuffer);
      console.log('✅ Created dummy avatar image');
    }

    form.append('avatar', fs.createReadStream(dummyImagePath), 'avatar.png');

    console.log('📝 Student data:');
    console.log('  - firstName:', studentData.firstName);
    console.log('  - email:', studentData.email);
    console.log('  - rollNumber: undefined (CRITICAL - triggers E11000 if index not sparse)\n');

    // Make the request
    console.log('🚀 Sending POST /api/students request...\n');
    
    const response = await axios.post('http://localhost:5000/api/students', form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5MzMwN2I3NzVjNTFjYTFjOTNjYjc0ZCIsInJvbGUiOiJzY2hvb2xfYWRtaW4iLCJzY2hvb2xJZCI6IjY5MzMwNzhjNzVjNTFjYTFjOTNjYjczMiIsImVtYWlsIjoiZGVtb0BzY2hvb2wuY29tIiwiaWF0IjoxNzY1MDU0NjExLCJleHAiOjE3NjU2NTk0MTF9.tnzX1nRIBojmNWwSPIIhdwYD_HWNlgparhjToYDCYFw'
      },
      timeout: 10000
    });

    console.log('✅ SUCCESS! Student created successfully!\n');
    console.log('📊 Response:');
    console.log('  Status:', response.status);
    console.log('  Student ID:', response.data._id);
    console.log('  Name:', response.data.firstName, response.data.lastName);
    console.log('  Email:', response.data.email);
    console.log('  Roll Number:', response.data.rollNumber || '(null/undefined)');

    // Clean up
    if (fs.existsSync(dummyImagePath)) {
      fs.unlinkSync(dummyImagePath);
    }

    process.exit(0);

  } catch (error) {
    console.log('❌ ERROR during student creation:\n');
    
    if (error.response) {
      console.log('HTTP Status:', error.response.status);
      console.log('Error Message:', error.response.data?.message || error.response.statusText);
      console.log('Full Response:', JSON.stringify(error.response.data, null, 2));
      
      // Check if it's the E11000 error
      if (error.response.data?.message?.includes('E11000')) {
        console.log('\n❌ Still getting E11000 error! Index fix may not be working.');
      }
    } else {
      console.log('Error details:');
      console.log('  Code:', error.code);
      console.log('  Message:', error.message);
      if (error.config) {
        console.log('  URL:', error.config.url);
        console.log('  Method:', error.config.method);
      }
      console.log('  Full error:', error);
    }

    process.exit(1);
  }
}

testStudentCreation();
