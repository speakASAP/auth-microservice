# Auth Microservice

Centralized authentication service for the Statex microservices ecosystem. Handles user registration, login, JWT token generation and validation, and user session management.

## Features

- ✅ **User Registration** - Create new user accounts with email and password
- ✅ **User Login** - Authenticate users and generate JWT tokens
- ✅ **Token Validation** - Validate JWT tokens and return user data
- ✅ **Token Refresh** - Refresh expired access tokens using refresh tokens
- ✅ **User Profile** - Get authenticated user profile
- ✅ **Password Security** - bcrypt password hashing
- ✅ **Database Integration** - PostgreSQL storage via shared database-server
- ✅ **Comprehensive Logging** - Centralized logging via external logging microservice with local fallback

## Technology Stack

- **Framework**: NestJS (TypeScript)
- **Database**: PostgreSQL (via TypeORM, shared database-server)
- **Authentication**: JWT (JSON Web Tokens) with Passport
- **Password Hashing**: bcrypt
- **Logging**: External centralized logging microservice with local file fallback

## API Endpoints

### Base URLs

**Internal Access** (Docker network):

```text
http://auth-microservice:3370
```

**External Access** (via HTTPS):

```text
https://auth.statex.cz
```

**Note**:

- For services on the same Docker network (`nginx-network`), use the internal URL: `http://auth-microservice:3370`
- For external/public access, use: `https://auth.statex.cz`
- The external URL is managed by nginx-microservice with automatic SSL certificate management

### API Endpoints

#### 1. Register User

Create a new user account.

**Endpoint**: `POST /auth/register`

**Request Body**:

```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+420123456789"
}
```

**Response** (200 OK):

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+420123456789",
    "isActive": true,
    "isVerified": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token"
}
```

**Error Response** (409 Conflict):

```json
{
  "statusCode": 409,
  "message": "User with this email already exists"
}
```

#### 2. Login

Authenticate user and get JWT tokens.

**Endpoint**: `POST /auth/login`

**Request Body**:

```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response** (200 OK):

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+420123456789",
    "isActive": true,
    "isVerified": false
  },
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token"
}
```

**Error Response** (401 Unauthorized):

```json
{
  "statusCode": 401,
  "message": "Invalid credentials"
}
```

#### 3. Validate Token

Validate a JWT token and return user data.

**Endpoint**: `POST /auth/validate`

**Request Body**:

```json
{
  "token": "jwt-access-token"
}
```

**Response** (200 OK):

```json
{
  "valid": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isActive": true,
    "isVerified": false
  }
}
```

**Error Response** (401 Unauthorized):

```json
{
  "statusCode": 401,
  "message": "Invalid token"
}
```

#### 4. Refresh Token

Get a new access token using a refresh token.

**Endpoint**: `POST /auth/refresh`

**Request Body**:

```json
{
  "refreshToken": "jwt-refresh-token"
}
```

**Response** (200 OK):

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isActive": true,
    "isVerified": false
  },
  "accessToken": "new-jwt-access-token",
  "refreshToken": "new-jwt-refresh-token"
}
```

**Error Response** (401 Unauthorized):

```json
{
  "statusCode": 401,
  "message": "Invalid refresh token"
}
```

#### 5. Get User Profile

Get the authenticated user's profile (requires JWT token).

**Endpoint**: `GET /auth/profile`

**Headers**:

```
Authorization: Bearer jwt-access-token
```

**Response** (200 OK):

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+420123456789",
    "isActive": true,
    "isVerified": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Response** (401 Unauthorized):

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

#### 6. Health Check

Check if the auth microservice is running and healthy.

**Endpoint**: `GET /health`

**Example Request**:

```bash
curl http://auth-microservice:3370/health
```

**Success Response** (200 OK):

```json
{
  "success": true,
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "auth-microservice"
}
```

## Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Database (Shared)
DB_HOST=db-server-postgres
DB_PORT=5432
DB_USER=dbadmin
DB_PASSWORD=your-database-password
DB_NAME=auth
DB_SYNC=false

# JWT Configuration
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Logging (Shared)
LOGGING_SERVICE_URL=https://logging.statex.cz

# Service Configuration
PORT=3370
NODE_ENV=production
CORS_ORIGIN=*
```

## Running the Service

### Development

```bash
# Install dependencies
npm install

# Start in development mode
npm run start:dev
```

### Production with Docker

```bash
# Build and start service
docker compose up -d

# View logs
docker compose logs -f auth-service

# Stop service
docker compose down

# Restart service
docker compose restart auth-service
```

## Integration Guide

### For Services Using the Auth Microservice

To integrate your service with the auth microservice, you need to:

#### 1. Network Configuration

Ensure your service is on the same Docker network (`nginx-network`):

```yaml
# In your service's docker-compose.yml
networks:
  - nginx-network

networks:
  nginx-network:
    external: true
    name: nginx-network
```

#### 2. Service Configuration

Set the auth service URL in your service's environment variables:

```env
AUTH_SERVICE_URL=http://auth-microservice:3370
# or for external access:
AUTH_SERVICE_URL=https://auth.statex.cz
```

#### 3. Use Auth Service via HTTP

**TypeScript/JavaScript (Node.js)**:

```typescript
import axios from 'axios';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-microservice:3370';

// Register user
async function register(email: string, password: string) {
  const response = await axios.post(`${AUTH_SERVICE_URL}/auth/register`, {
    email,
    password,
  });
  return response.data;
}

// Login
async function login(email: string, password: string) {
  const response = await axios.post(`${AUTH_SERVICE_URL}/auth/login`, {
    email,
    password,
  });
  return response.data;
}

// Validate token
async function validateToken(token: string) {
  const response = await axios.post(`${AUTH_SERVICE_URL}/auth/validate`, {
    token,
  });
  return response.data;
}
```

**Python**:

```python
import httpx

AUTH_SERVICE_URL = os.getenv('AUTH_SERVICE_URL', 'http://auth-microservice:3370')

# Register user
async def register(email: str, password: str):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{AUTH_SERVICE_URL}/auth/register",
            json={"email": email, "password": password}
        )
        return response.json()

# Login
async def login(email: str, password: str):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{AUTH_SERVICE_URL}/auth/login",
            json={"email": email, "password": password}
        )
        return response.json()

# Validate token
async def validate_token(token: str):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{AUTH_SERVICE_URL}/auth/validate",
            json={"token": token}
        )
        return response.json()
```

## Database Schema

The service uses the following User entity:

```typescript
{
  id: string (UUID, primary key)
  email: string (unique)
  password: string (bcrypt hashed)
  firstName: string (optional)
  lastName: string (optional)
  phone: string (optional)
  isActive: boolean (default: true)
  isVerified: boolean (default: false)
  createdAt: Date
  updatedAt: Date
}
```

## Security Features

- **Password Hashing**: All passwords are hashed using bcrypt with salt rounds of 10
- **JWT Tokens**: 
  - Access tokens (default: 7 days)
  - Refresh tokens (default: 30 days)
- **Token Validation**: All tokens are validated before use
- **User Status Check**: Inactive users cannot login or use tokens
- **Input Validation**: All inputs are validated using class-validator

## Logging

The service logs all authentication events to the centralized logging microservice:

- User registration attempts (successful and failed)
- User login attempts (successful and failed)
- Token validation requests
- Token refresh requests
- Error events

Logs are also written to local files as a fallback mechanism.

## Deployment

### Production Server

1. Clone repository to production server:

```bash
ssh statex
cd /home/statex
git clone git@github.com:speakASAP/auth-microservice.git
cd auth-microservice
```

2. Create `.env` file with production values

3. Build and start containers:

```bash
docker compose up -d --build
```

4. Register with nginx-microservice:

```bash
# Create nginx config
cd /home/statex/nginx-microservice
# Add configuration for auth.statex.cz
# Run SSL certificate generation
```

5. Verify health endpoint:

```bash
curl https://auth.statex.cz/health
```

## Status

✅ **Complete** - All features implemented and ready for production deployment.

## Related Services

- **database-server**: Shared PostgreSQL database
- **logging-microservice**: Centralized logging service
- **notifications-microservice**: Notification service (for password reset emails, etc.)

---

**Last Updated**: 2025-11-16  
**Maintained by**: Statex Development Team

