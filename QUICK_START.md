# Quick Start Guide

Get Caseflow up and running in 5 minutes.

## Prerequisites

- Node.js (v14+)
- MongoDB (v4.4+)
- npm

## Installation Steps

### 1. Clone and Install

```bash
git clone <repository-url>
cd caseflow
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` if needed:
```
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/caseflow
APP_NAME=Caseflow
```

### 3. Start MongoDB

Choose one option:

**Option A: Local MongoDB**
```bash
sudo service mongod start
```

**Option B: Docker**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 4. Start the Server

**Development mode (auto-restart on changes):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

### 5. Verify Installation

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "success": true,
  "message": "Caseflow API is running",
  "timestamp": "2024-01-07T12:00:00.000Z",
  "environment": "development"
}
```

## Test the API

### Create Your First User

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "role": "consultant"
  }'
```

Save the returned `id` - you'll need it for creating cases and tasks.

### Create Your First Case

```bash
curl -X POST http://localhost:3000/api/cases \
  -H "Content-Type: application/json" \
  -d '{
    "caseNumber": "CASE-001",
    "title": "My First Case",
    "priority": "medium",
    "client": {
      "name": "Test Client",
      "email": "client@example.com"
    },
    "createdBy": "YOUR_USER_ID"
  }'
```

### Create Your First Task

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My First Task",
    "priority": "medium",
    "status": "pending",
    "assignedTo": "YOUR_USER_ID",
    "createdBy": "YOUR_USER_ID"
  }'
```

## Next Steps

1. **Read the Documentation**
   - [README.md](README.md) - Full API documentation
   - [API_TESTING_GUIDE.md](API_TESTING_GUIDE.md) - More API examples
   - [ARCHITECTURE.md](ARCHITECTURE.md) - Design decisions

2. **Explore the API**
   - Visit http://localhost:3000/api for endpoint list
   - Try filtering: `GET /api/tasks?status=pending`
   - Try pagination: `GET /api/cases?page=1&limit=10`

3. **View the Data**
   - Use MongoDB Compass to view the database
   - Or use mongo shell: `mongo caseflow`

## Common Issues

### MongoDB Connection Error

**Problem:** `Error connecting to MongoDB`

**Solutions:**
- Check if MongoDB is running: `sudo service mongod status`
- Verify connection string in `.env`
- Try: `mongodb://127.0.0.1:27017/caseflow` instead of `localhost`

### Port Already in Use

**Problem:** `Port 3000 is already in use`

**Solutions:**
- Change PORT in `.env`
- Or kill the process: `lsof -ti:3000 | xargs kill`

### Module Not Found

**Problem:** `Cannot find module 'express'`

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
```

## Development Tips

### Auto-Restart on Changes
```bash
npm run dev  # Uses nodemon
```

### View Logs
- All requests are logged with timestamps
- Error details shown in development mode
- Check console output for debugging

### Test with Postman
- Import endpoints manually
- Or use curl examples from API_TESTING_GUIDE.md

### MongoDB GUI Tools
- **MongoDB Compass** - Official GUI
- **Studio 3T** - Advanced features
- **Robo 3T** - Lightweight option

## Project Structure

```
caseflow/
├── src/
│   ├── config/       # Database and app configuration
│   ├── models/       # Mongoose schemas
│   ├── controllers/  # Business logic
│   ├── routes/       # API endpoints
│   ├── middleware/   # Error handling, logging
│   └── server.js     # Main entry point
├── .env              # Your configuration (not in git)
├── .env.example      # Template configuration
├── package.json      # Dependencies and scripts
└── README.md         # Full documentation
```

## Available Scripts

```bash
npm start     # Start server
npm run dev   # Start with auto-restart
```

## API Endpoints Quick Reference

### Users
- `GET /api/users` - List all users
- `POST /api/users` - Create user
- `GET /api/users/:id` - Get user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Deactivate user

### Cases
- `GET /api/cases` - List all cases
- `POST /api/cases` - Create case
- `GET /api/cases/:id` - Get case with tasks
- `PUT /api/cases/:id` - Update case
- `DELETE /api/cases/:id` - Delete case
- `POST /api/cases/:id/notes` - Add note

### Tasks
- `GET /api/tasks` - List all tasks
- `POST /api/tasks` - Create task
- `GET /api/tasks/:id` - Get task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Statistics
- `GET /api/tasks/stats` - Task statistics
- `GET /api/cases/stats` - Case statistics

## Support

For issues or questions:
1. Check the documentation files
2. Review error logs in console
3. Verify MongoDB connection
4. Check that all dependencies are installed

## Success Indicators

You know everything is working when:
- ✅ Server starts without errors
- ✅ Health check returns 200
- ✅ You can create users, cases, and tasks
- ✅ MongoDB contains your data
- ✅ Queries and filters work

Happy coding! 🚀
