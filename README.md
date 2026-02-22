# Pandav Messaging App

A modern, real-time messaging application built with **React**, **Node.js/Bun**, **Socket.io**, **MongoDB**, and **Redis**. Features include user authentication, friend requests, private messaging, group chats, and online status tracking.

![Status](https://img.shields.io/badge/Status-Development-blue)
![Node](https://img.shields.io/badge/Node-18+-green)
![React](https://img.shields.io/badge/React-18+-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Environment Setup](#-environment-setup)
- [Running the Project](#-running-the-project)
- [API Documentation](#-api-documentation)
- [Database Schema](#-database-schema)
- [Socket.io Events](#-socketio-events)
- [CI/CD Pipeline](#-cicd-pipeline)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### 🔐 Authentication & Users
- User registration with email validation
- JWT-based authentication
- OTP-based email verification
- User profiles with online/offline status
- User search functionality

### 👥 Friend System
- Send/receive friend requests
- Accept/reject requests
- Remove friends
- View friends list
- Friend status checking
- View sent and pending requests

### 💬 Messaging
- Real-time private messaging with Socket.io
- Message history persistence
- Message delete functionality
- Read receipts (real-time)
- Typing indicators
- Message pagination

### 👫 Group Chats
- Create and manage groups
- Add/remove members
- Group messaging
- Real-time notifications
- Group-specific message history

### 🔔 Real-time Features
- Online/offline status broadcast
- Typing indicators
- Read receipts
- Real-time message delivery
- User presence updates

### 🛡️ Security
- Arcjet rate limiting & bot protection
- CORS configuration
- JWT token validation
- Input validation & sanitization
- MongoDB injection prevention
- Password hashing with bcrypt

### 📊 Caching & Performance
- Redis caching for friend lists
- Optimized database queries with indexes
- Pagination support
- Lean queries for memory efficiency

---

## 🛠 Tech Stack

### Backend
| Technology | Purpose |
|-----------|---------|
| **Bun** | JavaScript runtime (faster than Node.js) |
| **Express.js** | REST API framework |
| **MongoDB** | NoSQL database |
| **Mongoose** | MongoDB ODM |
| **Socket.io** | Real-time WebSocket communication |
| **Redis** | Caching & session management |
| **JWT** | Authentication tokens |
| **Bcrypt** | Password hashing |
| **Arcjet** | Rate limiting & security |
| **Nodemailer + Resend** | Email service |

### Frontend
| Technology | Purpose |
|-----------|---------|
| **React 18** | UI library |
| **Vite** | Build tool & dev server |
| **Axios** | HTTP client |
| **TailwindCSS** | Styling |
| **shadcn/ui** | Component library |
| **Socket.io Client** | WebSocket client |
| **React Router** | Client-side routing |
| **Lucide Icons** | Icon library |

### DevOps & CI/CD
| Technology | Purpose |
|-----------|---------|
| **GitHub Actions** | CI/CD pipeline |
| **Docker** | Containerization |
| **Render** | Backend hosting |
| **Vercel** | Frontend hosting |

---

## 📁 Project Structure

```
pandav-msg/
├── backend/              # Node.js/Bun application
│   ├── src/
│   │   ├── app.js       # Express app setup
│   │   ├── server.js    # Server entry point
│   │   ├── config/      # Configuration files (DB, Redis, Logger)
│   │   ├── controllers/ # Route handlers
│   │   ├── models/      # Mongoose schemas
│   │   ├── routes/      # API endpoints
│   │   ├── middlewares/ # Auth, validation, pagination
│   │   ├── services/    # Email, external services
│   │   ├── socket/      # Socket.io handlers
│   │   ├── validators/  # Input validation
│   │   ├── utils/       # Helper functions
│   │   └── tests/       # Unit & integration tests
│   ├── .env            # Environment variables
│   ├── package.json    # Dependencies
│   └── Dockerfile      # Container image
│
├── frontend/            # React application
│   ├── src/
│   │   ├── api/        # API call functions
│   │   ├── components/ # Reusable React components
│   │   ├── pages/      # Page components
│   │   ├── routes/     # Route definitions
│   │   ├── services/   # Business logic
│   │   ├── socket/     # Socket.io client
│   │   ├── context/    # React context (themes)
│   │   ├── hooks/      # Custom React hooks
│   │   └── utils/      # Utility functions
│   ├── .env           # Environment variables
│   ├── package.json   # Dependencies
│   ├── vite.config.js # Vite configuration
│   └── Dockerfile     # Container image
│
├── .github/
│   └── workflows/      # GitHub Actions CI/CD
│
└── README.md          # This file
```

---

## 📦 Prerequisites

### System Requirements
- **Node.js** v18 or higher
- **npm** or **Bun** package manager
- **MongoDB** v6.0+ (local or cloud)
- **Redis** (local or cloud)

### External Services
- **Gmail SMTP** (for email notifications)
- **Arcjet** (optional, for advanced security)

### Accounts Required
- GitHub account (for CI/CD)
- MongoDB Atlas account (or local MongoDB)
- Redis Cloud account (or local Redis)
- Vercel account (for frontend deployment)
- Railway account (for backend deployment)

---

## 🚀 Installation

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/pandav-msg.git
cd pandav-msg
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
bun install
# or with npm
npm install

# Create environment file
cp .env.example .env
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
bun install
# or with npm
npm install

# Create environment file
cp .env.example .env
```

---

## ⚙️ Environment Setup

### Backend Configuration (`.env`)

```env
# Server
NODE_ENV=development
PORT=5000

# Database
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/pandav_chat
MONGO_DB_NAME=pandav_chat

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your_jwt_secret_key_min_32_chars_!@#$%^&*
JWT_EXPIRE=7d

# Email Service (Gmail SMTP)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your_app_password  # Use App Password, not main password
EMAIL_FROM=noreply@pandavmsg.com

# CORS
CLIENT_URL=http://localhost:5173

# API
API_VERSION=v1

# Arcjet (Security)
ARCJET_KEY=your_arcjet_key
```

### Frontend Configuration (`.env`)

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:5000/api/v1
VITE_SOCKET_URL=http://localhost:5000
VITE_ENV=development
```

### Database Setup

**MongoDB Collections Required:**
- `users` - User accounts
- `friends` - Friend relationships
- `messages` - Private messages
- `groups` - Group information
- `otps` - OTP codes

**Indexes will be created automatically** on first server run.

---

## ▶️ Running the Project

### Development Mode

#### Terminal 1: Backend
```bash
cd backend
npm run dev
# Server runs on http://localhost:5000
```

#### Terminal 2: Frontend
```bash
cd frontend
npm run dev
# Frontend runs on http://localhost:5173
```

### Production Build

#### Backend
```bash
cd backend
bun run build
bun start  # or npm start
```

#### Frontend
```bash
cd frontend
bun run build
# Output in dist/ folder
```

### Docker Deployment

```bash
# Build images
docker build -t pandav-backend ./backend
docker build -t pandav-frontend ./frontend

# Run containers
docker run -p 5000:5000 -e NODE_ENV=production pandav-backend
docker run -p 3000:3000 pandav-frontend
```

---

## 📡 API Documentation

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/auth/register` | Register new user |
| `POST` | `/api/v1/auth/login` | Login user |
| `GET` | `/api/v1/auth/current` | Get current user |
| `POST` | `/api/v1/auth/logout` | Logout user |

**Example Register:**
```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

### Friend Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/friends` | Send friend request |
| `PATCH` | `/api/v1/friends/:requestId/accept` | Accept request |
| `DELETE` | `/api/v1/friends/:requestId` | Reject/Cancel request |
| `GET` | `/api/v1/friends` | Get friends list |
| `GET` | `/api/v1/friends/pending` | Get pending requests |
| `GET` | `/api/v1/friends/sent` | Get sent requests |
| `GET` | `/api/v1/friends/summary` | Get all friend data (aggregated) |
| `DELETE` | `/api/v1/friends/:friendId/remove` | Remove friend |

### Message Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/messages` | Send message |
| `GET` | `/api/v1/messages/:userId` | Get message history |
| `DELETE` | `/api/v1/messages/:messageId` | Delete message |

### Group Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/groups` | Create group |
| `GET` | `/api/v1/groups` | Get user's groups |
| `PATCH` | `/api/v1/groups/:groupId` | Update group |
| `DELETE` | `/api/v1/groups/:groupId` | Delete group |
| `POST` | `/api/v1/groups/:groupId/members` | Add member |
| `DELETE` | `/api/v1/groups/:groupId/members/:userId` | Remove member |

### User Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/users` | Get all users |
| `GET` | `/api/v1/users/:userId` | Get user profile |
| `GET` | `/api/v1/users/search?q=query` | Search users |
| `PATCH` | `/api/v1/users/:userId` | Update profile |

---

## 💾 Database Schema

### User Schema
```javascript
{
  _id: ObjectId,
  name: String,
  email: String (unique),
  password: String (hashed),
  avatar: String (URL),
  bio: String,
  isOnline: Boolean,
  lastSeen: Date,
  friends: [ObjectId],  // Includes bidirectional friendships
  createdAt: Date,
  updatedAt: Date
}
```

### Friend Schema
```javascript
{
  _id: ObjectId,
  senderId: ObjectId (ref: User),
  receiverId: ObjectId (ref: User),
  status: "pending" | "accepted" | "blocked",
  createdAt: Date,
  acceptedAt: Date
}
```

### Message Schema
```javascript
{
  _id: ObjectId,
  senderId: ObjectId (ref: User),
  receiverId: ObjectId (ref: User),
  text: String,
  isRead: Boolean,
  readAt: Date,
  deletedAt: Date,
  createdAt: Date
}
```

### Group Schema
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  avatar: String,
  createdBy: ObjectId (ref: User),
  members: [ObjectId],  // ref: User
  admins: [ObjectId],   // ref: User
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🔌 Socket.io Events

### Client → Server Events

```javascript
// Connection
'connect'                    // Establish connection
'disconnect'                 // Close connection

// Messaging
'send:message'              // Send private message
'send:group-message'        // Send group message
'delete:message'            // Delete message

// Friend Status
'user:status'               // Broadcast online status
'typing:start'              // Start typing indicator
'typing:stop'               // Stop typing indicator

// Read Receipts
'message:read'              // Mark message as read
```

### Server → Client Events

```javascript
// Messaging
'message:received'          // Receive private message
'group-message:received'    // Receive group message
'message:deleted'           // Message deletion notification

// Status
'user:online'               // User came online
'user:offline'              // User went offline
'typing:indicator'          // Someone is typing

// Notifications
'read:receipt'              // Message read notification
'friend:request'            // New friend request
'friend:accepted'           // Friend request accepted
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

The project uses GitHub Actions for automated testing and deployment:

```yaml
Triggers:
  - Push to 'development' branch
  - Pull requests to 'development' or 'main' branches

Jobs:
  1. Backend Check
     - Install dependencies
     - Security audit
     - Build check

  2. Frontend Check
     - Install dependencies
     - Security audit
     - Build verification

  3. All Checks Pass
     - Verify all jobs succeeded
```

**Workflow File:** `.github/workflows/ci.yml`

### Running Tests Locally

```bash
# Backend tests
cd backend
bun test

# Frontend tests
cd frontend
npm test
```

---

## 🚀 Deployment

### Frontend Deployment (Vercel)

```bash
# Automatic deployment
Push to 'development' branch → Vercel builds & deploys

# Manual deployment
cd frontend
vercel deploy
```

**Live URL:** https://pandav-msg.vercel.app

### Backend Deployment (Railway)

```bash
# Connect GitHub repository to Railway
# Railway automatically deploys on push to 'development'

# Environment variables in Railway dashboard:
MONGO_URI
REDIS_URL
JWT_SECRET
EMAIL_USER
EMAIL_PASSWORD
```

**Live URL:** Backend API at `https://pandav-msg-api.railway.app/api/v1`

---

## 🤝 Contributing

### Development Workflow

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

2. **Make Changes**
   - Follow existing code style
   - Add tests for new features
   - Update documentation

3. **Commit Changes**
   ```bash
   git add .
   git commit -m "Add amazing feature"
   ```

4. **Push and Create PR**
   ```bash
   git push origin feature/amazing-feature
   ```

### Code Style Guidelines

- **JavaScript/Node.js:** Use ES6+ features, async/await
- **React:** Use functional components and hooks
- **Naming:** camelCase for variables/functions, PascalCase for components
- **Comments:** Add JSDoc comments for functions
- **Testing:** Aim for 80%+ code coverage

### Commit Message Format

```
[type]: description

Types: feat, fix, docs, style, refactor, perf, test, chore
Example: feat: add friend request validation
```

---

## 📚 Additional Documentation

- **Backend Setup Guide:** [backend/docs/setup-guide/socket-io-setup.md](backend/docs/setup-guide/socket-io-setup.md)
- **DB Optimization:** [backend/docs/routes/v1/docs/optimize.md](backend/docs/routes/v1/docs/optimize.md)
- **Frontend Setup:** [frontend/docs/setup-guide/](frontend/docs/setup-guide/)
- **Security Guide:** [backend/docs/security.md](backend/docs/security.md)

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :5000
kill -9 <PID>
```

### MongoDB Connection Error
- Verify `MONGO_URI` is correct
- Check whitelist IP in MongoDB Atlas
- Ensure MongoDB service is running

### Redis Connection Error
- Verify Redis is running: `redis-cli ping`
- Check `REDIS_URL` format
- Ensure Redis port is accessible

### Socket.io Not Connecting
- Check `CLIENT_URL` and `VITE_SOCKET_URL` match
- Verify CORS is enabled
- Check browser console for errors

---

## 👨‍💻 Author

**Your Name / Team**
- GitHub: [@jayClone](https://github.com/jayClone)
- Email: contact@mail.jaychaudhari.me 

---

## 🙏 Acknowledgments

- [Express.js](https://expressjs.com/)
- [Socket.io](https://socket.io/)
- [MongoDB](https://www.mongodb.com/)
- [React](https://react.dev/)
- [TailwindCSS](https://tailwindcss.com/)
- [Bun](https://bun.sh/)

---

## 📞 Support

For issues and questions:
- Open an [Issue](https://github.com/jayClone/pandav-msg/issues)
- Check [Discussions](https://github.com/jayClone/pandav-msg/discussions)

---

**Last Updated:** February 22, 2026  
**Version:** 1.0.0
