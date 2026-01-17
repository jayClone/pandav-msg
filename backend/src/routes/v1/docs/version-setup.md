# API Versioning System Setup Guide

## Overview

This document explains how the Pandav MSG API implements professional API versioning to support multiple API versions simultaneously, allowing for smooth migrations and backward compatibility.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Directory Structure](#directory-structure)
3. [Implementation Details](#implementation-details)
4. [Adding New Versions](#adding-new-versions)
5. [Best Practices](#best-practices)
6. [Testing Versions](#testing-versions)

---

## Architecture

### Versioning Strategy

**URL-based Versioning** (RESTful Standard)

```
http://localhost:5000/api/v1/auth/login
                          ↑↑
                    Version identifier
```

**Benefits:**
- ✅ Clear version in URL path
- ✅ Easy to cache and proxy
- ✅ Explicit version control
- ✅ Supports multiple versions simultaneously
- ✅ Browser-friendly for testing

---

## Directory Structure

```
backend/src/
├── routes/
│   ├── index.js                 (Main router - version dispatcher)
│   │
│   ├── v1/                      (Version 1 - Current stable)
│   │   ├── index.js             (V1 route aggregator)
│   │   ├── auth.routes.js       (Auth endpoints)
│   │   ├── health.routes.js     (Health check)
│   │   └── docs/
│   │       └── version-setup.md (This file)
│   │
│   └── v2/                      (Version 2 - Future/Beta)
│       ├── index.js             (V2 route aggregator)
│       ├── auth.routes.js       (Enhanced auth)
│       ├── health.routes.js     (Enhanced health)
│       └── docs/
│           └── changelog.md     (V2 changes)
│
├── controllers/
│   ├── authController.js        (Shared auth logic)
│   └── health.controller.js     (Shared health logic)
│
└── middlewares/
    └── auth.js                  (Shared auth middleware)
```

---

## Implementation Details

### 1. Main Router (`backend/src/routes/index.js`)

Entry point that routes requests to specific API versions:

```javascript
import express from 'express';
import v1Routes from './v1/index.js';
import v2Routes from './v2/index.js';

const router = express.Router();

/**
 * API Versioning
 * v1 - Current stable version (production-ready)
 * v2 - Next generation (beta/development)
 */
router.use('/v1', v1Routes);
router.use('/v2', v2Routes);

export default router;
```

**Usage in app.js:**
```javascript
import apiRoutes from './routes/index.js';

app.use('/api', apiRoutes);
// Now available at: /api/v1/* and /api/v2/*
```

---

### 2. Version-Specific Router (`backend/src/routes/v1/index.js`)

Aggregates all endpoints for a specific version:

```javascript
import express from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';

const router = express.Router();

/**
 * V1 API Routes
 * Base: /api/v1
 */

router.use('/health', healthRoutes);    // /api/v1/health
router.use('/auth', authRoutes);        // /api/v1/auth

export default router;
```

---

### 3. Feature Routes (`backend/src/routes/v1/auth.routes.js`)

Defines endpoints for a specific feature:

```javascript
import express from 'express';
import { register, login, getCurrentUser } from '../../controllers/authController.js';
import { protect } from '../../middlewares/auth.js';

const router = express.Router();

/**
 * @route POST /api/v1/auth/register
 * @desc Register new user
 * @access Public
 * @body {name, email, password}
 * @returns {token, user}
 */
router.post('/register', register);

/**
 * @route POST /api/v1/auth/login
 * @desc Login user
 * @access Public
 * @body {email, password}
 * @returns {token, user}
 */
router.post('/login', login);

/**
 * @route GET /api/v1/auth/current
 * @desc Get current authenticated user
 * @access Private (requires token)
 * @returns {user}
 */
router.get('/current', protect, getCurrentUser);

export default router;
```

---

## Adding New Versions

### Step 1: Create Version Directory

```bash
mkdir -p backend/src/routes/v2
mkdir -p backend/src/routes/v2/docs
```

### Step 2: Create Version Router (`backend/src/routes/v2/index.js`)

```javascript
import express from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';

const router = express.Router();

/**
 * V2 API Routes
 * Base: /api/v2
 * 
 * New Features:
 * - Refresh token endpoint
 * - Enhanced user profile
 * - Rate limiting
 */

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);

export default router;
```

### Step 3: Create Feature Routes

**Enhanced Auth Routes** (`backend/src/routes/v2/auth.routes.js`)

```javascript
import express from 'express';
import { 
  register, 
  login, 
  getCurrentUser,
  refreshToken  // NEW in v2
} from '../../controllers/authController.js';
import { protect } from '../../middlewares/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/current', protect, getCurrentUser);

/**
 * @route POST /api/v2/auth/refresh-token
 * @desc Refresh expired access token
 * @access Public (with refresh token)
 * @body {refreshToken}
 * @returns {token}
 */
router.post('/refresh-token', refreshToken);  // NEW in v2

export default router;
```

### Step 4: Update Main Router (`backend/src/routes/index.js`)

```javascript
import express from 'express';
import v1Routes from './v1/index.js';
import v2Routes from './v2/index.js';  // ✅ Add v2

const router = express.Router();

/**
 * API Versioning
 * v1 - Stable (production)
 * v2 - Beta (new features)
 */
router.use('/v1', v1Routes);
router.use('/v2', v2Routes);  // ✅ New version available

export default router;
```

### Step 5: Update Controllers (if needed)

Add new functions to existing controllers:

```javascript
// authController.js
export const refreshToken = async (req, res) => {
  try {
    // V2 specific logic
    const { refreshToken } = req.body;
    // Verify and generate new token
    res.json({ success: true, token });
  } catch (error) {
    res.status(401).json({ success: false, message: error.message });
  }
};
```

---

## Best Practices

### 1. Backward Compatibility

**DON'T:** Remove endpoints abruptly
```javascript
// ❌ BAD: Breaks v1 clients
router.get('/user', getCurrentUser);  // Changed from /current
```

**DO:** Keep old endpoints in v1, add new in v2
```javascript
// V1 - Keep old endpoint
router.get('/current', protect, getCurrentUser);

// V2 - Add new endpoint
router.get('/user', protect, getCurrentUser);  // Better name
```

### 2. Version Naming Convention

```
v1, v2, v3, ...  (Major versions)

NOT:
v1.0, v1.1, v1.2  (Too granular for URL)
```

### 3. Documentation Per Version

```
routes/
├── v1/
│   ├── docs/
│   │   ├── version-setup.md      (Setup guide)
│   │   ├── endpoints.md          (V1 endpoints)
│   │   └── changelog.md          (V1 changes)
│   └── ...
└── v2/
    ├── docs/
    │   ├── endpoints.md          (V2 endpoints)
    │   ├── migration-guide.md    (V1 → V2)
    │   └── changelog.md          (V2 changes)
    └── ...
```

### 4. Shared vs Versioned Code

**Shared (across versions):**
```javascript
// controllers/ - Business logic
// middlewares/ - Authentication, validation
// models/ - Database schemas
```

**Versioned (per version):**
```javascript
// routes/ - Endpoint definitions
// Response formats
// Deprecated endpoints
```

### 5. API Deprecation Timeline

```
v1 Status: STABLE (production)
├─ Current version
├─ Full support
└─ Maintenance mode: 12 months

v2 Status: BETA (new features)
├─ Parallel to v1
├─ Testing phase
└─ Promote to stable after 3 months

v3 Status: PLANNED (future)
├─ Design phase
└─ Release when v2 is stable
```

---

## Testing Versions

### Test V1 Endpoints

```bash
# Register
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }'

# Login
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'

# Get Current User
curl -X GET http://localhost:5000/api/v1/auth/current \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test V2 Endpoints

```bash
# Login (same as v1)
curl -X POST http://localhost:5000/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'

# Refresh Token (NEW in v2)
curl -X POST http://localhost:5000/api/v2/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

### Automated Testing

**Setup test routes** (`backend/src/tests/v1.test.js`):

```javascript
import { describe, it, expect } from 'bun:test';
import request from 'supertest';
import app from '../app.js';

describe('🧪 API V1 Tests', () => {
  it('POST /api/v1/auth/register', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      });
    
    expect(response.status).toBe(201);
    expect(response.body.token).toBeDefined();
  });
});
```

---

## API Endpoints Reference

### V1 (Current - Stable)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/auth/register` | Register new user | No |
| POST | `/api/v1/auth/login` | Login user | No |
| GET | `/api/v1/auth/current` | Get current user | Yes |
| GET | `/api/v1/health` | Health check | No |

### V2 (Beta - New Features)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v2/auth/register` | Register new user | No |
| POST | `/api/v2/auth/login` | Login user | No |
| GET | `/api/v2/auth/current` | Get current user | Yes |
| POST | `/api/v2/auth/refresh-token` | Refresh token | No |
| GET | `/api/v2/health` | Health check | No |

---

## Frontend Configuration

### Update axios.js for versioning

```javascript
// frontend/src/api/axios.js
const API_VERSION = 'v1';  // Change to 'v2' when ready
const API_BASE_URL = `${import.meta.env.VITE_API_URL}/api/${API_VERSION}`;

const API = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json"
    }
});
```

### Update .env

```env
VITE_API_URL=http://localhost:5000
VITE_API_VERSION=v1
```

---

## Migration Guide (V1 → V2)

### For Frontend Developers

1. **Update .env:**
   ```env
   VITE_API_VERSION=v2
   ```

2. **Update auth.service.js** (if endpoints changed):
   ```javascript
   getCurrentUser: async () => {
       // V2 uses /user instead of /current
       const response = await API.get('/auth/user');
       return response.data;
   }
   ```

3. **Test with both versions** before switching:
   ```javascript
   // Keep fallback for stability
   const getCurrentUser = async () => {
       try {
           return await apiV2.get('/auth/user');
       } catch {
           return await apiV1.get('/auth/current');
       }
   };
   ```

### For Backend Developers

1. **Run migration tests:**
   ```bash
   bun test src/tests/v2.test.js
   ```

2. **Monitor both versions:**
   ```bash
   # Log API version in responses
   res.json({
       success: true,
       apiVersion: 'v2',  // Track version in response
       data: {...}
   });
   ```

3. **Gradual rollout:**
   - Week 1: Deploy v2 alongside v1
   - Week 2-3: Monitor v2 adoption
   - Week 4: Deprecate v1 with warning headers
   - Month 2: Remove v1 (after 12-month notice)

---

## Monitoring & Deprecation

### Add Version Headers

```javascript
// middleware/versionHeader.js
app.use((req, res, next) => {
    const version = req.baseUrl.split('/')[2];  // Extract v1, v2, etc
    res.set('API-Version', version);
    
    if (version === 'v1') {
        res.set('Deprecation', 'true');
        res.set('Sunset', 'Wed, 16 Jan 2027 00:00:00 GMT');
        console.warn(`⚠️ V1 API called - will be removed on 2027-01-16`);
    }
    next();
});
```

### Log Version Usage

```javascript
// Log which versions are being used
app.use((req, res, next) => {
    const version = req.baseUrl.match(/\/v\d+/)?.[0];
    if (version) {
        console.log(`📊 API Usage: ${version} - ${req.method} ${req.path}`);
    }
    next();
});
```

---

## Summary

✅ **Implemented:**
- URL-based versioning (`/api/v1`, `/api/v2`)
- Shared controllers and middleware
- Version-specific routes
- Easy version management
- Clear upgrade path

✅ **Benefits:**
- Supports multiple API versions simultaneously
- Backward compatibility for existing clients
- Smooth migration path
- Clear deprecation timeline
- Professional API management

✅ **Next Steps:**
- Create v2 with new features
- Add API documentation per version
- Implement monitoring
- Plan deprecation timeline
- Provide migration guides

---

**Last Updated:** January 16, 2026  
**Maintained By:** Backend Team  
**Status:** ✅ Production Ready