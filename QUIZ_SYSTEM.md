# Quiz System Documentation

## Overview
A comprehensive quiz management system that allows teachers to create quizzes with multiple question types, set time limits, and automatically grade submissions. Students can take quizzes and view their results in real-time.

## Files Created

### 1. Model: `backend/models/Quiz.js`
- **Quiz Schema** with the following features:
  - Basic info: name, description, class, subject, teacher, school
  - Questions array with support for:
    - Multiple-choice questions
    - True/false questions
    - Short-answer questions
  - Duration (in minutes)
  - Total marks (auto-calculated from questions)
  - Passing marks threshold
  - Start and end dates
  - Options: allow late submission, shuffle questions, show correct answers
  - Status: draft, active, completed, cancelled
  - Submissions tracking with automatic grading

### 2. Controller: `backend/controllers/quizController.js`
Complete CRUD operations and quiz management:

#### Teacher/Admin Endpoints:
- `getQuizzes()` - Get all quizzes (filtered by teacher if role is teacher)
- `getQuiz()` - Get single quiz details
- `createQuiz()` - Create new quiz
- `updateQuiz()` - Update quiz (only if no submissions yet)
- `deleteQuiz()` - Delete quiz
- `getQuizResults()` - Get quiz results and statistics

#### Student Endpoints:
- `startQuiz()` - Start a quiz (creates in-progress submission)
- `submitQuiz()` - Submit quiz answers (auto-grades and calculates score)
- `getMySubmissions()` - Get student's quiz submission history

### 3. Routes: `backend/routes/quizzes.js`
RESTful API endpoints with validation:

```
GET    /api/quizzes                    - Get all quizzes (Teacher, Admin)
GET    /api/quizzes/my-submissions     - Get student submissions (Student)
GET    /api/quizzes/:id                - Get single quiz (All authenticated)
GET    /api/quizzes/:id/results        - Get quiz results (Teacher, Admin)
POST   /api/quizzes                    - Create quiz (Teacher, Admin)
POST   /api/quizzes/:id/start          - Start quiz (Student)
POST   /api/quizzes/:id/submit         - Submit quiz (Student)
PUT    /api/quizzes/:id                - Update quiz (Teacher, Admin)
DELETE /api/quizzes/:id                - Delete quiz (Teacher, Admin)
```

## Key Features

### 1. Question Types
- **Multiple Choice**: Options with one correct answer
- **True/False**: Boolean questions
- **Short Answer**: Text-based answers with exact match validation

### 2. Automatic Grading
- Quizzes are automatically graded upon submission
- Multiple-choice and true/false questions are graded instantly
- Short-answer questions use case-insensitive exact match
- Calculates total marks, percentage, and pass/fail status

### 3. Time Management
- Start and end dates for quiz availability
- Duration tracking (time limit in minutes)
- Records actual time taken by students
- Optional late submission support

### 4. Real-time Notifications
- WebSocket integration for instant notifications
- Students notified when new quiz is available
- Teachers notified when students submit quizzes

### 5. Security & Access Control
- Role-based access (Teacher, Student, Parent, Admin)
- Students can only access quizzes for their class
- Teachers can only modify their own quizzes
- Parents can view their child's quiz results

### 6. Quiz Statistics
- Submission count
- Average score
- Pass/fail statistics
- Individual student performance tracking

## Usage Examples

### Creating a Quiz (Teacher)
```json
POST /api/quizzes
{
  "name": "Mathematics Quiz 1",
  "description": "Chapter 1-3 revision",
  "classId": "65abc123...",
  "subjectId": "65def456...",
  "questions": [
    {
      "questionText": "What is 2 + 2?",
      "questionType": "multiple-choice",
      "options": [
        { "text": "3", "isCorrect": false },
        { "text": "4", "isCorrect": true },
        { "text": "5", "isCorrect": false }
      ],
      "marks": 2,
      "explanation": "Basic addition"
    },
    {
      "questionText": "Is Earth round?",
      "questionType": "true-false",
      "options": [
        { "text": "True", "isCorrect": true },
        { "text": "False", "isCorrect": false }
      ],
      "marks": 1
    },
    {
      "questionText": "What is the capital of France?",
      "questionType": "short-answer",
      "correctAnswer": "Paris",
      "marks": 2
    }
  ],
  "duration": 30,
  "passingMarks": 3,
  "startDate": "2025-10-20T10:00:00Z",
  "endDate": "2025-10-25T23:59:59Z",
  "status": "active",
  "shuffleQuestions": true,
  "showCorrectAnswers": true
}
```

### Starting a Quiz (Student)
```json
POST /api/quizzes/:id/start
// No body required - creates in-progress submission
```

### Submitting Quiz Answers (Student)
```json
POST /api/quizzes/:id/submit
{
  "answers": [
    {
      "questionId": "65question1...",
      "selectedAnswer": "4"
    },
    {
      "questionId": "65question2...",
      "selectedAnswer": "True"
    },
    {
      "questionId": "65question3...",
      "selectedAnswer": "Paris"
    }
  ]
}
```

### Response After Submission
```json
{
  "success": true,
  "message": "Quiz submitted successfully",
  "data": {
    "totalMarks": 5,
    "percentage": 100,
    "passed": true,
    "timeTaken": 15
  }
}
```

## Model Methods

### Static Methods
- `getQuizzesByTeacher(teacherId, options)` - Get quizzes by teacher with filters
- `getQuizzesByClass(classId, options)` - Get quizzes by class with filters

### Instance Methods
- `startQuiz(studentId)` - Start quiz for a student
- `submitQuiz(studentId, answers)` - Submit and auto-grade quiz
- `getStudentSubmission(studentId)` - Get specific student's submission

### Virtuals
- `submissionCount` - Count of completed submissions
- `averageScore` - Average score across all submissions

## Integration Points

1. **WebSocket Events**:
   - `new_quiz` - Emitted when quiz is created and active
   - `quiz_submitted` - Emitted when student submits quiz

2. **Notifications**:
   - Creates notifications for students when quiz is available
   - Creates notifications for teachers when quiz is submitted

3. **Authentication**:
   - Uses existing `protect` middleware
   - Uses existing `authorize` middleware for role-based access

## Database Indexes
- `{ schoolId: 1, classId: 1 }` - Efficient class-based queries
- `{ teacherId: 1, startDate: 1 }` - Teacher quiz listing
- `{ classId: 1, status: 1 }` - Status filtering
- `{ startDate: 1, endDate: 1 }` - Date range queries

## Validation
- Express-validator rules for all input
- Schema-level validation in Mongoose
- Custom validation for quiz logic (dates, questions, etc.)

## Error Handling
- Proper error messages for all scenarios
- 400 for validation errors
- 403 for authorization errors
- 404 for not found
- 500 for server errors

## Future Enhancements (Optional)
- [ ] Question bank/reusable questions
- [ ] Quiz templates
- [ ] Randomized question selection from pool
- [ ] Image support in questions
- [ ] Essay-type questions with manual grading
- [ ] Quiz analytics and insights
- [ ] Export results to CSV/PDF
- [ ] Partial grading for short answers
- [ ] Question difficulty levels
- [ ] Timed sections within quiz






