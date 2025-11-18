# Auth Microservice

Centralized authentication service for the Statex microservices ecosystem. Handles user registration, login, JWT token generation and validation, and user session management.

## Features

- ✅ **User Registration** - Create new user accounts with email and password
- ✅ **Contact-Based Registration** - Register users with contact information (email/phone) without password
- ✅ **User Login** - Authenticate users and generate JWT tokens
- ✅ **Contact-Based Login** - Login for contact-based users (email/phone)
- ✅ **Token Validation** - Validate JWT tokens and return user data
- ✅ **Token Refresh** - Refresh expired access tokens using refresh tokens
- ✅ **User Profile** - Get authenticated user profile
- ✅ **Password Reset** - Request and confirm password reset with email notifications
- ✅ **Password Change** - Change password for authenticated users
- ✅ **Password Security** - bcrypt password hashing
- ✅ **Database Integration** - PostgreSQL storage via shared database-server
- ✅ **Email Notifications** - Password reset emails via notifications-microservice
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

### API Endpoints list

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

```text
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

#### 6. Password Reset Request

Request a password reset link to be sent via email.

**Endpoint**: `POST /auth/password-reset-request`

**Request Body**:

```json
{
  "email": "user@example.com"
}
```

**Response** (200 OK):

```json
{
  "message": "If the email exists, a password reset link has been sent."
}
```

#### 7. Password Reset Confirm

Confirm password reset using the token from the email.

**Endpoint**: `POST /auth/password-reset-confirm`

**Request Body**:

```json
{
  "token": "reset-token-from-email",
  "newPassword": "newsecurepassword123"
}
```

**Response** (200 OK):

```json
{
  "message": "Password reset successfully"
}
```

#### 8. Password Change

Change password for authenticated users.

**Endpoint**: `POST /auth/password-change`

**Headers**:

```text
Authorization: Bearer jwt-access-token
```

**Request Body**:

```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "newsecurepassword123"
}
```

**Response** (200 OK):

```json
{
  "message": "Password changed successfully"
}
```

#### 9. Contact-Based Registration

Register a user with contact information (email/phone) without password.

**Endpoint**: `POST /auth/register-contact`

**Request Body**:

```json
{
  "name": "John Doe",
  "contactInfo": [
    {
      "type": "email",
      "value": "user@example.com",
      "isPrimary": true
    },
    {
      "type": "phone",
      "value": "+420123456789",
      "isPrimary": false
    }
  ],
  "source": "website",
  "sessionId": "optional-session-id"
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "userId": "uuid",
  "sessionId": "session-token",
  "message": "User registered successfully",
  "isNewUser": true,
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "user@example.com",
    "contactInfo": [...],
    "isActive": true,
    "isVerified": false
  }
}
```

#### 10. Contact-Based Login

Login for contact-based users.

**Endpoint**: `POST /auth/login-contact`

**Request Body**:

```json
{
  "type": "email",
  "value": "user@example.com"
}
```

**Response** (200 OK):

```json
{
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "user@example.com",
    "isActive": true
  },
  "sessionId": "session-token"
}
```

#### 11. Health Check

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

# Notifications (Shared) - For password reset emails
NOTIFICATIONS_SERVICE_URL=https://notifications.statex.cz

# Frontend URL - For password reset links
FRONTEND_URL=https://statex.cz

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

### Management Scripts

The project includes management scripts in the `scripts/` directory:

- `scripts/start.sh` - Start the service with Docker Compose
- `scripts/stop.sh` - Stop the service
- `scripts/status.sh` - Check service status and health

Usage:

```bash
# Start service
./scripts/start.sh

# Check status
./scripts/status.sh

# Stop service
./scripts/stop.sh
```

**Note**: These scripts are for local development. Production deployments use the blue/green deployment system via nginx-microservice.

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

### Database Setup

The service requires a PostgreSQL database named `auth` on the shared database-server. The database is automatically created during initial deployment, or can be created manually:

```bash
docker exec db-server-postgres psql -U dbadmin -d postgres -c 'CREATE DATABASE auth;'
```

### Entity Schemas

The service uses the following User entity:

```typescript
{
  id: string (UUID, primary key)
  email: string (unique, nullable for contact-based users)
  password: string (bcrypt hashed, nullable for contact-based users)
  firstName: string (optional)
  lastName: string (optional)
  phone: string (optional)
  name: string (optional, for contact-based users)
  contactInfo: Array<{type: string, value: string, isPrimary?: boolean}> (JSONB, for contact-based users)
  source: string (optional, registration source)
  sessionId: string (optional, session identifier)
  lastActivity: Date (optional)
  isActive: boolean (default: true)
  isVerified: boolean (default: false)
  createdAt: Date
  updatedAt: Date
}
```

The service also uses the following PasswordResetToken entity:

```typescript
{
  id: string (UUID, primary key)
  userId: string (foreign key to User)
  token: string (unique, reset token)
  expiresAt: Date (token expiration)
  used: boolean (default: false)
  createdAt: Date
}
```

## Security Features

- **Password Hashing**: All passwords are hashed using bcrypt with salt rounds of 10
- **JWT Tokens**:
  - Access tokens (default: 7 days, configurable via `JWT_EXPIRES_IN`)
  - Refresh tokens (default: 30 days, configurable via `JWT_REFRESH_EXPIRES_IN`)
- **Token Validation**: All tokens are validated before use
- **User Status Check**: Inactive users cannot login or use tokens
- **Input Validation**: All inputs are validated using class-validator
- **Password Reset Security**:
  - Reset tokens expire after 1 hour
  - Tokens are single-use (marked as used after password reset)
  - Email notifications sent via notifications-microservice
- **Contact-Based Security**:
  - Contact-based users don't require passwords
  - Session tokens for contact-based authentication
  - Support for multiple contact methods (email, phone)

## Logging

The service logs all authentication events to the centralized logging microservice:

- User registration attempts (successful and failed)
- User login attempts (successful and failed)
- Token validation requests
- Token refresh requests
- Error events

Logs are also written to local files as a fallback mechanism.

## Deployment

### Blue/Green Deployment

The auth-microservice uses a zero-downtime blue/green deployment system managed by nginx-microservice. This allows for seamless deployments without service interruption.

#### Deployment Files

- `docker-compose.auth-microservice.blue.yml` - Blue environment configuration
- `docker-compose.auth-microservice.green.yml` - Green environment configuration
- Service registry: `nginx-microservice/service-registry/auth-microservice.json`

#### Deployment Process

The deployment is managed by nginx-microservice's blue/green deployment scripts:

```bash
# On production server
ssh statex
cd /home/statex/nginx-microservice
./scripts/blue-green/deploy.sh auth-microservice
```

The deployment process includes:

1. **Phase 0**: Ensure shared infrastructure (database-server) is running
2. **Phase 1**: Build and start the new color (green/blue) deployment
3. **Phase 2**: Switch traffic to the new deployment
4. **Phase 3**: Monitor health for 5 minutes
5. **Phase 4**: Cleanup old deployment

#### Service Registry Configuration

The service is registered in `nginx-microservice/service-registry/auth-microservice.json`:

```json
{
  "service_name": "auth-microservice",
  "domain": "auth.statex.cz",
  "services": {
    "backend": {
      "container_name_base": "auth-microservice",
      "port": 3370,
      "health_endpoint": "/health",
      "startup_time": 30
    }
  }
}
```

### Production Server Setup

#### Initial Setup

1. Clone repository to production server:

```bash
ssh statex
cd /home/statex
git clone git@github.com:speakASAP/auth-microservice.git
cd auth-microservice
```

2. Create `.env` file with production values (see Environment Variables section)

3. Initialize database:

```bash
# Create auth database on shared database-server
docker exec db-server-postgres psql -U dbadmin -d postgres -c 'CREATE DATABASE auth;'
```

4. Pull latest code and deploy:

```bash
# Pull latest code
cd /home/statex/auth-microservice
git pull

# Pull nginx-microservice updates
cd /home/statex/nginx-microservice
git pull

# Deploy using blue/green deployment
./scripts/blue-green/deploy.sh auth-microservice
```

#### Updating Deployment

For updates, pull the latest code and redeploy:

```bash
ssh statex "cd /home/statex/auth-microservice && git pull && cd ../nginx-microservice && git pull && ./scripts/blue-green/deploy.sh auth-microservice"
```

#### Verification

Verify the service is running:

```bash
# Check health endpoint
curl https://auth.statex.cz/health

# Check container status
docker ps | grep auth-microservice

# Check deployment state
cat /home/statex/nginx-microservice/state/auth-microservice.json | jq .
```

### Local Development

For local development, use the standard docker-compose.yml:

```bash
# Build and start service
docker compose up -d --build

# View logs
docker compose logs -f auth-service

# Stop service
docker compose down

# Restart service
docker compose restart auth-service
```

## Related Services

- **database-server**: Shared PostgreSQL database
- **logging-microservice**: Centralized logging service
- **notifications-microservice**: Notification service (for password reset emails, etc.)

## Integration with Applications

The auth-microservice is used by the following applications:

1. **Crypto-AI-Agent**: Email/password authentication, password reset/change
2. **E-Commerce**: Email/password authentication (via shared `AuthService`)
3. **Statex**: Contact-based registration and email/password authentication

All applications use the same centralized authentication service for consistent security and user management.

---

## Blue/Green Deployment Architecture

The service is deployed using a blue/green deployment strategy:

- **Blue Environment**: Primary deployment (container: `auth-microservice-blue`)
- **Green Environment**: Secondary deployment (container: `auth-microservice-green`)
- **Traffic Routing**: Managed by nginx-microservice with upstream blocks
- **Zero Downtime**: Traffic switches between blue and green seamlessly
- **Automatic Rollback**: Failed deployments automatically rollback to previous color

### Container Naming

- Blue: `auth-microservice-blue` (port 3370)
- Green: `auth-microservice-green` (port 3371, internal 3370)

### Nginx Configuration

The nginx configuration uses upstream blocks for load balancing:

```nginx
upstream auth-microservice {
    server auth-microservice-blue:3370 backup max_fails=3 fail_timeout=30s;
    server auth-microservice-green:3370 weight=100 max_fails=3 fail_timeout=30s;
}
```

The active color has `weight=100`, while the inactive color is marked as `backup`.

---

**Last Updated**: 2025-11-18  
**Maintained by**: Statex Development Team
