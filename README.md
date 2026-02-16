# Auth Microservice

Centralized authentication service for microservices ecosystems. Handles user registration, login, JWT token generation and validation, and user session management.

## ⚠️ Production-Ready Service

This service is **production-ready** and should **NOT** be modified directly.

- **✅ Allowed**: Use scripts from this service's directory
- **❌ NOT Allowed**: Modify code, configuration, or infrastructure directly
- **⚠️ Permission Required**: If you need to modify something, **ask for permission first**

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

## Web Interface

A web UI is included for potential customers and admins:

- **Landing page** – At `https://${DOMAIN}` (or `http://localhost:3372` when running only the frontend). Describes features and links to the admin panel.
- **Admin panel** – At `https://${DOMAIN}/admin`. Login with any auth-microservice user (email/password). After login you see:
  - **Service status** – Auth backend health and logging service status.
  - **Recent activity** – Recent log entries for `auth-microservice` from the logging service (if `LOGGING_SERVICE_URL` is set).

The frontend is served by the `frontend` container; nginx-microservice routes `/` and `/admin` to it and `/auth/`, `/health` to the backend. Deploy with:

```bash
./scripts/deploy.sh
# or from nginx-microservice: ./scripts/blue-green/deploy-smart.sh auth-microservice
```

**Registry is driven by this repo**: Do not edit `nginx-microservice/service-registry/auth-microservice.json` directly. It is managed by `nginx-microservice/scripts/blue-green/deploy-smart.sh`, which creates it from **docker-compose.blue.yml** / **docker-compose.green.yml** (if missing) and updates it from **nginx/nginx-api-routes.conf**. Deploy via `./scripts/deploy.sh` (which calls deploy-smart.sh).

**Container naming (blue/green)**: `deploy-smart.sh` and `prepare-green-smart.sh` expect container names to end with `-blue` or `-green`; the registry's `container_name_base` is derived by stripping that suffix (see nginx-microservice `scripts/blue-green/utils.sh` and docs e.g. `docs/BLUE_GREEN_DEPLOYMENT.md`). Compose must use `auth-microservice-blue` / `auth-microservice-green` (backend) and `auth-microservice-frontend-blue` / `auth-microservice-frontend-green` (frontend).

SSL uses **Let's Encrypt** (not self-signed): the deploy flow creates a temporary certificate if needed, then requests a real certificate. Ensure `CERTBOT_EMAIL` is set in `nginx-microservice/.env` for first-time certificate request.

The web app lives in `web/` (Express server + static files). Env: `DOMAIN`, `FRONTEND_URL`, `FRONTEND_PORT*`, `LOGGING_SERVICE_URL` (optional, for stats).

**Testing admin panel**: Create a test user with `./scripts/create-test-user.sh` (backend must be running). Set `TEST_EMAIL` and `TEST_PASSWORD` in `.env` (password only in .env, not in docs). Then open `https://${DOMAIN}/admin` (or `http://localhost:3372/admin` when running frontend locally) and sign in with those credentials.

## API Endpoints

## 🔌 Port Configuration

**Port Range**: 33xx (reserved for auth-microservice)

| Service | Host Port (Blue) | Host Port (Green) | Container Port | .env Variable | Description |
| ------- | ---------------- | ----------------- | -------------- | ------------- | ----------- |
| **Auth backend** | `${PORT:-3370}` | `3371` | `${PORT:-3370}` | `PORT` | Authentication API |
| **Web frontend** | `${FRONTEND_PORT_BLUE:-3372}` | `${FRONTEND_PORT_GREEN:-3373}` | `3372` | `FRONTEND_PORT*` | Landing + admin panel |

**Note**:

- All ports are configured in `auth-microservice/.env`. The values shown are defaults.
- Blue and green use different host ports for backend (3370/3371) and frontend (3372/3373); container ports are fixed.
- Ports are exposed on localhost only; external access is via nginx-microservice at `https://${DOMAIN}`.
- **PORT must be 3370** (or unset) so the backend listens on 3370 inside the container; the green health check expects this. Do not set `PORT=3371`.

**Troubleshooting: "Port 3370 is not listening" (e.g. on sgipreal)**  
If green deployment fails with this message, the backend container is running but the app inside is not binding to 3370 (often a startup crash). On the server run: `docker logs auth-microservice-green`. Typical causes: wrong or missing `PORT=3370` in `.env`, DB unreachable (`DB_HOST` / network), missing `JWT_SECRET`, or `NOTIFICATIONS_SERVICE_URL` / `LOGGING_SERVICE_URL` unreachable. Fix `.env` and ensure required services are reachable from that host, then redeploy.

### Base URLs

**Internal Access** (Docker network):

```text
http://auth-microservice:${PORT:-3370}
```

**External Access** (via HTTPS):

```text
https://${DOMAIN}
```

**Note**:

- For services on the same Docker network (`nginx-network`), use the internal URL: `http://auth-microservice:${PORT:-3370}` (port configured in `auth-microservice/.env`)
- For external/public access, use: `https://${DOMAIN}` (domain configured in `DOMAIN` environment variable)
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
# Port configured in auth-microservice/.env: PORT (default: 3370)
curl http://auth-microservice:${PORT:-3370}/health
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
LOGGING_SERVICE_URL=

# Notifications (Shared) - For password reset emails
NOTIFICATIONS_SERVICE_URL=

# Service Domain - Used by nginx-microservice for auto-registry (required for correct domain detection)
DOMAIN=

# Frontend URL - For password reset links
FRONTEND_URL=

# Logs Volume Path - Path for storing logs (default: ./logs)
LOGS_VOLUME_PATH=

# Service Configuration
PORT=3370  # Configured in auth-microservice/.env (default: 3370)
NODE_ENV=production
CORS_ORIGIN=https://auth.statex.cz,https://logging.statex.cz,https://notifications.statex.cz,https://database-server.statex.cz  # comma-separated for admin logins from other domains
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

This guide provides comprehensive instructions for integrating the auth-microservice into other services and applications.

### Overview

The auth-microservice provides centralized authentication for your microservices ecosystem. It supports:

- **Email/Password Authentication**: Traditional login with email and password
- **Contact-Based Authentication**: Registration and login without passwords (email/phone)
- **JWT Token Management**: Access and refresh token generation, validation, and refresh
- **Password Management**: Password reset, change, and secure storage
- **User Profile Management**: User data retrieval and management

### Integration Approaches

There are two main approaches to integrate with the auth-microservice:

1. **HTTP Client Integration**: Make HTTP requests directly to auth endpoints
2. **JWT Validation Middleware**: Validate JWT tokens in your application middleware/guards

### Prerequisites

Before integrating, ensure:

- Your service/application can make HTTP requests (internal Docker network or external HTTPS)
- You have access to the `nginx-network` Docker network (for internal services)
- You understand JWT token structure and handling
- You have appropriate error handling in place

---

### Step 1: Network Configuration

For services running in Docker containers, ensure your service is on the same Docker network (`nginx-network`):

```yaml
# In your service's docker-compose.yml
services:
  your-service:
    # ... other configuration
    networks:
      - nginx-network

networks:
  nginx-network:
    external: true
    name: nginx-network
```

**Note**: For applications running outside Docker or in different environments, use the external HTTPS URL instead.

---

### Step 2: Environment Variables Configuration

Add the following environment variables to your service/application:

```env
# Auth Service URL
# For internal Docker network access:
AUTH_SERVICE_URL=http://auth-microservice:3370
# For external HTTPS access:
AUTH_SERVICE_URL=https://auth.statex.cz

# JWT Configuration (if validating tokens locally)
# IMPORTANT: Must match the JWT_SECRET in auth-microservice/.env
JWT_SECRET=your-shared-jwt-secret-key
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
```

**Security Note**: The `JWT_SECRET` must be the same across all services that validate tokens. Store it securely and never commit it to version control.

---

### Step 3: HTTP Client Integration

#### TypeScript/JavaScript (Node.js/NestJS)

**Basic HTTP Client Setup**:

```typescript
import axios, { AxiosInstance, AxiosError } from 'axios';

class AuthServiceClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.AUTH_SERVICE_URL || 'http://auth-microservice:3370';
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Register a new user
   */
  async register(data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  }) {
    try {
      const response = await this.client.post('/auth/register', data);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw this.handleError(error);
      }
      throw error;
    }
  }

  /**
   * Login user and get JWT tokens
   */
  async login(email: string, password: string) {
    try {
      const response = await this.client.post('/auth/login', { email, password });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw this.handleError(error);
      }
      throw error;
    }
  }

  /**
   * Validate JWT token
   */
  async validateToken(token: string) {
    try {
      const response = await this.client.post('/auth/validate', { token });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw this.handleError(error);
      }
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string) {
    try {
      const response = await this.client.post('/auth/refresh', { refreshToken });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw this.handleError(error);
      }
      throw error;
    }
  }

  /**
   * Get user profile (requires JWT token in Authorization header)
   */
  async getProfile(accessToken: string) {
    try {
      const response = await this.client.get('/auth/profile', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw this.handleError(error);
      }
      throw error;
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string) {
    try {
      const response = await this.client.post('/auth/password-reset-request', { email });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw this.handleError(error);
      }
      throw error;
    }
  }

  /**
   * Confirm password reset
   */
  async confirmPasswordReset(token: string, newPassword: string) {
    try {
      const response = await this.client.post('/auth/password-reset-confirm', {
        token,
        newPassword,
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw this.handleError(error);
      }
      throw error;
    }
  }

  /**
   * Change password (requires JWT token)
   */
  async changePassword(accessToken: string, currentPassword: string, newPassword: string) {
    try {
      const response = await this.client.post(
        '/auth/password-change',
        { currentPassword, newPassword },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw this.handleError(error);
      }
      throw error;
    }
  }

  /**
   * Register contact-based user (no password)
   */
  async registerContact(data: {
    name: string;
    contactInfo: Array<{ type: 'email' | 'phone'; value: string; isPrimary?: boolean }>;
    source?: string;
    sessionId?: string;
  }) {
    try {
      const response = await this.client.post('/auth/register-contact', data);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw this.handleError(error);
      }
      throw error;
    }
  }

  /**
   * Login contact-based user
   */
  async loginContact(type: 'email' | 'phone', value: string) {
    try {
      const response = await this.client.post('/auth/login-contact', { type, value });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw this.handleError(error);
      }
      throw error;
    }
  }

  /**
   * Error handler
   */
  private handleError(error: AxiosError) {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const message = (error.response.data as any)?.message || error.message;
      return new Error(`Auth Service Error (${status}): ${message}`);
    } else if (error.request) {
      // Request made but no response
      return new Error('Auth Service is unreachable. Please check network connection.');
    } else {
      // Error in request setup
      return new Error(`Request Error: ${error.message}`);
    }
  }
}

// Export singleton instance
export const authServiceClient = new AuthServiceClient();
```

**Usage Example**:

```typescript
import { authServiceClient } from './auth-service-client';

// Register user
try {
  const result = await authServiceClient.register({
    email: 'user@example.com',
    password: 'securepassword123',
    firstName: 'John',
    lastName: 'Doe',
  });
  console.log('User registered:', result.user);
  console.log('Access Token:', result.accessToken);
  console.log('Refresh Token:', result.refreshToken);
} catch (error) {
  console.error('Registration failed:', error.message);
}

// Login
try {
  const result = await authServiceClient.login('user@example.com', 'securepassword123');
  // Store tokens securely (e.g., in HTTP-only cookies, secure storage)
  localStorage.setItem('accessToken', result.accessToken);
  localStorage.setItem('refreshToken', result.refreshToken);
} catch (error) {
  console.error('Login failed:', error.message);
}

// Validate token
try {
  const token = localStorage.getItem('accessToken');
  const validation = await authServiceClient.validateToken(token);
  console.log('Token is valid. User:', validation.user);
} catch (error) {
  console.error('Token validation failed:', error.message);
}
```

#### Python (FastAPI/Django/Flask)

**Basic HTTP Client Setup**:

```python
import os
import httpx
from typing import Optional, Dict, Any, List
from datetime import datetime

class AuthServiceClient:
    def __init__(self):
        self.base_url = os.getenv('AUTH_SERVICE_URL', 'http://auth-microservice:3370')
        self.timeout = 10.0

    def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Make HTTP request to auth service"""
        url = f"{self.base_url}{endpoint}"
        request_headers = {'Content-Type': 'application/json'}
        if headers:
            request_headers.update(headers)

        try:
            with httpx.Client(timeout=self.timeout) as client:
                response = client.request(method, url, json=data, headers=request_headers)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as e:
            error_msg = e.response.json().get('message', str(e)) if e.response.text else str(e)
            raise Exception(f"Auth Service Error ({e.response.status_code}): {error_msg}")
        except httpx.RequestError as e:
            raise Exception(f"Auth Service is unreachable: {str(e)}")

    def register(
        self,
        email: str,
        password: str,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        phone: Optional[str] = None
    ) -> Dict[str, Any]:
        """Register a new user"""
        data = {
            'email': email,
            'password': password,
            'firstName': first_name,
            'lastName': last_name,
            'phone': phone
        }
        return self._make_request('POST', '/auth/register', data)

    def login(self, email: str, password: str) -> Dict[str, Any]:
        """Login user and get JWT tokens"""
        data = {'email': email, 'password': password}
        return self._make_request('POST', '/auth/login', data)

    def validate_token(self, token: str) -> Dict[str, Any]:
        """Validate JWT token"""
        data = {'token': token}
        return self._make_request('POST', '/auth/validate', data)

    def refresh_token(self, refresh_token: str) -> Dict[str, Any]:
        """Refresh access token using refresh token"""
        data = {'refreshToken': refresh_token}
        return self._make_request('POST', '/auth/refresh', data)

    def get_profile(self, access_token: str) -> Dict[str, Any]:
        """Get user profile (requires JWT token)"""
        headers = {'Authorization': f'Bearer {access_token}'}
        return self._make_request('GET', '/auth/profile', headers=headers)

    def request_password_reset(self, email: str) -> Dict[str, Any]:
        """Request password reset"""
        data = {'email': email}
        return self._make_request('POST', '/auth/password-reset-request', data)

    def confirm_password_reset(self, token: str, new_password: str) -> Dict[str, Any]:
        """Confirm password reset"""
        data = {'token': token, 'newPassword': new_password}
        return self._make_request('POST', '/auth/password-reset-confirm', data)

    def change_password(
        self,
        access_token: str,
        current_password: str,
        new_password: str
    ) -> Dict[str, Any]:
        """Change password (requires JWT token)"""
        data = {'currentPassword': current_password, 'newPassword': new_password}
        headers = {'Authorization': f'Bearer {access_token}'}
        return self._make_request('POST', '/auth/password-change', data, headers)

    def register_contact(
        self,
        name: str,
        contact_info: List[Dict[str, Any]],
        source: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Register contact-based user (no password)"""
        data = {
            'name': name,
            'contactInfo': contact_info,
            'source': source,
            'sessionId': session_id
        }
        return self._make_request('POST', '/auth/register-contact', data)

    def login_contact(self, contact_type: str, value: str) -> Dict[str, Any]:
        """Login contact-based user"""
        data = {'type': contact_type, 'value': value}
        return self._make_request('POST', '/auth/login-contact', data)

# Export singleton instance
auth_service_client = AuthServiceClient()
```

**Usage Example**:

```python
from auth_service_client import auth_service_client

# Register user
try:
    result = auth_service_client.register(
        email='user@example.com',
        password='securepassword123',
        first_name='John',
        last_name='Doe'
    )
    print(f"User registered: {result['user']}")
    print(f"Access Token: {result['accessToken']}")
except Exception as e:
    print(f"Registration failed: {e}")

# Login
try:
    result = auth_service_client.login('user@example.com', 'securepassword123')
    # Store tokens securely
    access_token = result['accessToken']
    refresh_token = result['refreshToken']
except Exception as e:
    print(f"Login failed: {e}")
```

#### Go

**Basic HTTP Client Setup**:

```go
package auth

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "os"
    "time"
)

type AuthServiceClient struct {
    baseURL string
    client  *http.Client
}

type RegisterRequest struct {
    Email     string `json:"email"`
    Password  string `json:"password"`
    FirstName string `json:"firstName,omitempty"`
    LastName  string `json:"lastName,omitempty"`
    Phone     string `json:"phone,omitempty"`
}

type LoginRequest struct {
    Email    string `json:"email"`
    Password string `json:"password"`
}

type ValidateTokenRequest struct {
    Token string `json:"token"`
}

type AuthResponse struct {
    User         User   `json:"user"`
    AccessToken  string `json:"accessToken"`
    RefreshToken string `json:"refreshToken"`
}

type User struct {
    ID        string `json:"id"`
    Email     string `json:"email"`
    FirstName string `json:"firstName,omitempty"`
    LastName  string `json:"lastName,omitempty"`
    IsActive  bool   `json:"isActive"`
    IsVerified bool  `json:"isVerified"`
}

func NewAuthServiceClient() *AuthServiceClient {
    baseURL := os.Getenv("AUTH_SERVICE_URL")
    if baseURL == "" {
        baseURL = "http://auth-microservice:3370"
    }

    return &AuthServiceClient{
        baseURL: baseURL,
        client: &http.Client{
            Timeout: 10 * time.Second,
        },
    }
}

func (c *AuthServiceClient) Register(req RegisterRequest) (*AuthResponse, error) {
    return c.makeRequest("POST", "/auth/register", req)
}

func (c *AuthServiceClient) Login(email, password string) (*AuthResponse, error) {
    req := LoginRequest{Email: email, Password: password}
    return c.makeRequest("POST", "/auth/login", req)
}

func (c *AuthServiceClient) ValidateToken(token string) (*User, error) {
    req := ValidateTokenRequest{Token: token}
    var response struct {
        Valid bool `json:"valid"`
        User  User `json:"user"`
    }
    
    err := c.makeRequestWithResponse("POST", "/auth/validate", req, &response)
    if err != nil {
        return nil, err
    }
    
    if !response.Valid {
        return nil, fmt.Errorf("invalid token")
    }
    
    return &response.User, nil
}

func (c *AuthServiceClient) makeRequest(method, endpoint string, body interface{}) (*AuthResponse, error) {
    var response AuthResponse
    err := c.makeRequestWithResponse(method, endpoint, body, &response)
    if err != nil {
        return nil, err
    }
    return &response, nil
}

func (c *AuthServiceClient) makeRequestWithResponse(method, endpoint string, body interface{}, response interface{}) error {
    url := c.baseURL + endpoint
    
    var reqBody io.Reader
    if body != nil {
        jsonData, err := json.Marshal(body)
        if err != nil {
            return fmt.Errorf("failed to marshal request: %w", err)
        }
        reqBody = bytes.NewBuffer(jsonData)
    }
    
    req, err := http.NewRequest(method, url, reqBody)
    if err != nil {
        return fmt.Errorf("failed to create request: %w", err)
    }
    
    req.Header.Set("Content-Type", "application/json")
    
    resp, err := c.client.Do(req)
    if err != nil {
        return fmt.Errorf("request failed: %w", err)
    }
    defer resp.Body.Close()
    
    if resp.StatusCode >= 400 {
        bodyBytes, _ := io.ReadAll(resp.Body)
        return fmt.Errorf("auth service error (%d): %s", resp.StatusCode, string(bodyBytes))
    }
    
    if err := json.NewDecoder(resp.Body).Decode(response); err != nil {
        return fmt.Errorf("failed to decode response: %w", err)
    }
    
    return nil
}
```

**Usage Example**:

```go
package main

import (
    "fmt"
    "log"
    "your-project/auth"
)

func main() {
    client := auth.NewAuthServiceClient()
    
    // Register
    result, err := client.Register(auth.RegisterRequest{
        Email:    "user@example.com",
        Password: "securepassword123",
    })
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("User registered: %+v\n", result.User)
    
    // Login
    result, err = client.Login("user@example.com", "securepassword123")
    if err != nil {
        log.Fatal(err)
    }
    fmt.Printf("Access Token: %s\n", result.AccessToken)
}
```

---

### Step 4: JWT Token Validation Middleware

For services that need to protect routes with JWT authentication, implement middleware to validate tokens.

#### NestJS Middleware Example

```typescript
import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { authServiceClient } from './auth-service-client';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    try {
      const validation = await authServiceClient.validateToken(token);
      // Attach user to request object
      (req as any).user = validation.user;
      next();
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
```

#### Express.js Middleware Example

```typescript
import { Request, Response, NextFunction } from 'express';
import { authServiceClient } from './auth-service-client';

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const validation = await authServiceClient.validateToken(token);
    (req as any).user = validation.user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}
```

#### FastAPI Middleware Example

```python
from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from auth_service_client import auth_service_client

security = HTTPBearer()

async def auth_middleware(request: Request, call_next):
    """Validate JWT token from Authorization header"""
    auth_header = request.headers.get("Authorization")
    
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No token provided"
        )
    
    token = auth_header.split(" ")[1]
    
    try:
        validation = auth_service_client.validate_token(token)
        request.state.user = validation["user"]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    response = await call_next(request)
    return response
```

---

### Step 5: Token Storage and Management

**Security Best Practices**:

1. **Access Tokens**: Store in memory or secure HTTP-only cookies (for web apps)
2. **Refresh Tokens**: Store securely (HTTP-only cookies, secure storage)
3. **Never store tokens in localStorage** (vulnerable to XSS attacks)
4. **Implement token refresh logic** to automatically refresh expired tokens

**Token Refresh Implementation**:

```typescript
class TokenManager {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  async refreshAccessToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const result = await authServiceClient.refreshToken(this.refreshToken);
      this.accessToken = result.accessToken;
      this.refreshToken = result.refreshToken; // New refresh token
      return this.accessToken;
    } catch (error) {
      // Refresh token expired - user needs to login again
      this.clearTokens();
      throw error;
    }
  }

  async getValidAccessToken(): Promise<string> {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    // Validate token (optional - can decode JWT to check expiration)
    try {
      await authServiceClient.validateToken(this.accessToken);
      return this.accessToken;
    } catch (error) {
      // Token expired, try to refresh
      return await this.refreshAccessToken();
    }
  }

  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
  }
}
```

---

### Step 6: Error Handling

Implement comprehensive error handling for all auth operations:

```typescript
enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  USER_EXISTS = 'USER_EXISTS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  USER_INACTIVE = 'USER_INACTIVE',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

class AuthError extends Error {
  constructor(
    public code: AuthErrorCode,
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

function handleAuthError(error: any): AuthError {
  if (error.response) {
    const status = error.response.status;
    const message = error.response.data?.message || error.message;

    switch (status) {
      case 401:
        if (message.includes('credentials')) {
          return new AuthError(AuthErrorCode.INVALID_CREDENTIALS, message, status);
        }
        return new AuthError(AuthErrorCode.TOKEN_INVALID, message, status);
      case 409:
        return new AuthError(AuthErrorCode.USER_EXISTS, message, status);
      default:
        return new AuthError(AuthErrorCode.SERVICE_UNAVAILABLE, message, status);
    }
  } else if (error.request) {
    return new AuthError(
      AuthErrorCode.SERVICE_UNAVAILABLE,
      'Auth service is unreachable',
      503
    );
  }
  return new AuthError(AuthErrorCode.SERVICE_UNAVAILABLE, error.message);
}
```

---

### Step 7: Integration Testing

Create integration tests to verify your auth integration:

```typescript
import { authServiceClient } from './auth-service-client';

describe('Auth Service Integration', () => {
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = process.env.TEST_PASSWORD || 'min-6-chars-placeholder';
  let accessToken: string;
  let refreshToken: string;

  test('should register a new user', async () => {
    const result = await authServiceClient.register({
      email: testEmail,
      password: testPassword,
      firstName: 'Test',
      lastName: 'User',
    });

    expect(result.user).toBeDefined();
    expect(result.user.email).toBe(testEmail);
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();

    accessToken = result.accessToken;
    refreshToken = result.refreshToken;
  });

  test('should login with valid credentials', async () => {
    const result = await authServiceClient.login(testEmail, testPassword);

    expect(result.user).toBeDefined();
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });

  test('should validate token', async () => {
    const validation = await authServiceClient.validateToken(accessToken);

    expect(validation.valid).toBe(true);
    expect(validation.user).toBeDefined();
    expect(validation.user.email).toBe(testEmail);
  });

  test('should refresh token', async () => {
    const result = await authServiceClient.refreshToken(refreshToken);

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });
});
```

---

### Step 8: Security Best Practices

1. **Always use HTTPS** in production for external access
2. **Validate tokens server-side** - never trust client-side validation only
3. **Implement rate limiting** on login/register endpoints
4. **Use secure password requirements** (minimum length, complexity)
5. **Store tokens securely** - HTTP-only cookies for web, secure storage for mobile
6. **Implement token rotation** - refresh tokens should be rotated on use
7. **Log authentication events** for security auditing
8. **Handle token expiration gracefully** - automatically refresh when possible
9. **Never expose JWT_SECRET** in client-side code
10. **Implement CORS properly** - restrict origins in production

---

### Step 9: Troubleshooting

**Common Issues and Solutions**:

1. **Connection Refused / Service Unreachable**
   - Verify `AUTH_SERVICE_URL` is correct
   - Check if services are on the same Docker network
   - Verify auth-microservice is running: `docker ps | grep auth-microservice`
   - Check health endpoint: `curl http://auth-microservice:3370/health`

2. **401 Unauthorized Errors**
   - Verify JWT token is valid and not expired
   - Check if `JWT_SECRET` matches between services
   - Ensure token is sent in `Authorization: Bearer <token>` format
   - Verify user account is active

3. **Token Validation Fails**
   - Check token expiration time
   - Verify JWT_SECRET matches
   - Ensure token format is correct (should start with `Bearer` in header)

4. **Network Timeout**
   - Increase timeout values in HTTP client
   - Check network connectivity
   - Verify service is not overloaded

5. **CORS Errors**
   - Set CORS_ORIGIN in auth-microservice `.env` to a comma-separated list of allowed origins (e.g. <https://auth.statex.cz,https://logging.statex.cz,https://notifications.statex.cz,https://database-server.statex.cz>). Required for admin logins from logging/notifications/database-server; when credentials are used, origin cannot be `*`.
   - Ensure each frontend origin is listed in CORS_ORIGIN

---

### Step 10: Complete Integration Example

Here's a complete example for a NestJS service:

```typescript
// auth.module.ts
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthMiddleware } from './auth.middleware';

@Module({
  imports: [HttpModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}

// auth.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  private readonly authServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.authServiceUrl = this.configService.get<string>('AUTH_SERVICE_URL');
  }

  async validateToken(token: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.authServiceUrl}/auth/validate`, { token }),
      );
      return response.data;
    } catch (error) {
      throw new Error('Token validation failed');
    }
  }
}

// auth.middleware.ts
import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly authService: AuthService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }
    
    const token = authHeader.substring(7);
    const validation = await this.authService.validateToken(token);
    
    (req as any).user = validation.user;
    next();
  }
}

// app.module.ts
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AuthMiddleware } from './auth/auth.middleware';

@Module({
  imports: [AuthModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('protected-route');
  }
}
```

---

### Summary

To integrate the auth-microservice into your service/application:

1. ✅ Configure Docker network (for containerized services)
2. ✅ Set environment variables (`AUTH_SERVICE_URL`, `JWT_SECRET`)
3. ✅ Implement HTTP client for auth operations
4. ✅ Add JWT validation middleware/guards
5. ✅ Implement token storage and refresh logic
6. ✅ Add comprehensive error handling
7. ✅ Write integration tests
8. ✅ Follow security best practices

For questions or issues, check the logs in `auth-microservice/logs/` or contact the development team.

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
# Connect to your production server and navigate to nginx-microservice directory
cd /path/to/nginx-microservice
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
  "domain": "${DOMAIN}",
  "services": {
    "backend": {
      "container_name_base": "auth-microservice",
      "port": "${PORT:-3370}",  # Port configured in auth-microservice/.env
      "health_endpoint": "/health",
      "startup_time": 30
    }
  }
}
```

### Production Server Setup

**Production checklist:** Set `CORS_ORIGIN` in `.env` to a comma-separated list of allowed origins (e.g. `https://auth.statex.cz,https://logging.statex.cz,https://notifications.statex.cz,https://database-server.statex.cz`) so admin logins from logging, notifications, and database-server work.

#### Initial Setup

1. Clone repository to production server:

```bash
# Connect to your production server
cd /path/to/project
git clone <repository-url>
cd auth-microservice
```

1. Create `.env` file with production values (see Environment Variables section)

2. Initialize database:

```bash
# Create auth database on shared database-server
docker exec db-server-postgres psql -U dbadmin -d postgres -c 'CREATE DATABASE auth;'
```

1. Pull latest code and deploy:

```bash
# Pull latest code
cd /path/to/auth-microservice
git pull

# Pull nginx-microservice updates
cd /path/to/nginx-microservice
git pull

# Deploy using blue/green deployment
./scripts/blue-green/deploy.sh auth-microservice
```

#### Updating Deployment

For updates, pull the latest code and redeploy:

```bash
# Connect to your production server and run:
cd /path/to/auth-microservice && git pull && cd ../nginx-microservice && git pull && ./scripts/blue-green/deploy.sh auth-microservice
```

#### Verification

Verify the service is running:

```bash
# Check health endpoint (replace ${DOMAIN} with your configured domain)
curl https://${DOMAIN}/health

# Check container status
docker ps | grep auth-microservice

# Check deployment state
cat /path/to/nginx-microservice/state/auth-microservice.json | jq .
```

### Local Development

For local development, use the standard docker-compose.yml:

```bash
# Build and start service
docker compose up -d --build

# View logs
docker compose logs -f auth-microservice

# Stop service
docker compose down

# Restart service
docker compose restart auth-microservice
```

## Related Services

- **database-server**: Shared PostgreSQL database
- **logging-microservice**: Centralized logging service
- **notifications-microservice**: Notification service (for password reset emails, etc.)

## Integration with Applications

The auth-microservice can be integrated with any application that requires authentication:

- Email/password authentication
- Password reset/change
- Contact-based registration
- Token validation and refresh

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

- Blue: `auth-microservice-blue` (port ${PORT:-3370}, configured in `auth-microservice/.env`)
- Green: `auth-microservice-green` (port 3371 host, ${PORT:-3370} container, port configured in `auth-microservice/.env`)

### Nginx Configuration

The nginx configuration uses upstream blocks for load balancing:

```nginx
# Port configured in auth-microservice/.env: PORT (default: 3370)
upstream auth-microservice {
    server auth-microservice-blue:${PORT:-3370} backup max_fails=3 fail_timeout=30s;
    server auth-microservice-green:${PORT:-3370} weight=100 max_fails=3 fail_timeout=30s;
}
```

The active color has `weight=100`, while the inactive color is marked as `backup`.

---

**Last Updated**: 2025-11-18
