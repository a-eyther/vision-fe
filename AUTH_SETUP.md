# CSV Dashboard Authentication Setup

This guide explains the authentication system added to the CSV Dashboard application.

## System Overview

The application now includes a comprehensive authentication system with:
- **Secure Login/Logout** with JWT tokens
- **Role-based Access Control** (Admin & Executive roles)
- **PostgreSQL Database** for user management
- **Password Security** with bcrypt hashing
- **User Management Interface** for admins

## Architecture

```
Frontend (React)     Backend (Express)     Database (PostgreSQL)
    ↓                       ↓                      ↓
  - Login Page         - JWT Authentication    - Users Table
  - Auth Context       - Password Hashing     - Sessions Table
  - Protected Routes   - Role Middleware      - Secure Storage
  - User Management    - Rate Limiting
```

## Setup Instructions

### 1. Database Setup
PostgreSQL is already configured with:
- Database: `csv_dashboard_auth`
- Tables: `users`, `sessions`
- Indexes for performance

### 2. Backend Server
The Express server runs on port 5001 with:
- `/api/auth/login` - User authentication
- `/api/auth/register` - User registration (admin only)
- `/api/auth/me` - Get current user info
- `/api/auth/users` - Get all users (admin only)
- `/api/auth/logout` - Logout endpoint

### 3. Frontend Integration
The React app now includes:
- Authentication context for state management
- Login page with form validation
- Protected routes and components
- Role-based UI rendering

## User Roles & Permissions

### Admin Role
- **Full Dashboard Access**: All features including ROI Calculator
- **User Management**: Can create, view, and manage other users
- **System Administration**: Full system access

### Executive Role
- **Limited Dashboard Access**: Can view Overview and Insights tabs
- **No ROI Calculator**: This tab is hidden for executives
- **No User Management**: Cannot access user administration

## Demo Users

The system comes with pre-configured demo accounts:

### Admin Account
- **Email**: admin@hospital.com
- **Password**: admin123
- **Access**: Full system access including ROI Calculator and User Management

### Executive Account
- **Email**: executive@hospital.com
- **Password**: exec123
- **Access**: Limited to Overview and Insights tabs only

## Security Features

### Password Security
- Passwords are hashed using bcrypt with 12 salt rounds
- Minimum 8 character password requirement
- Secure password storage in database

### JWT Authentication
- Secure token-based authentication
- 24-hour token expiration
- Automatic token validation on each request

### Rate Limiting
- Login attempts limited to 5 per 15 minutes per IP
- Protection against brute force attacks

### Input Validation
- Email format validation
- Password strength requirements
- SQL injection protection
- XSS protection with helmet middleware

## User Management Features

### For Admins
1. **View All Users**: See complete user list with status and roles
2. **Add New Users**: Create accounts with email, password, and role assignment
3. **Activate/Deactivate Users**: Toggle user access without deleting accounts
4. **Role Assignment**: Set users as Admin or Executive during creation

### User Interface
- Clean, intuitive user management dashboard
- Real-time status updates
- Secure password input with visibility toggle
- Responsive design for all screen sizes

## API Endpoints

### Authentication Endpoints
```
POST /api/auth/login
POST /api/auth/register (admin only)
GET  /api/auth/me
POST /api/auth/logout
GET  /api/auth/users (admin only)
PUT  /api/auth/users/:id/status (admin only)
```

### Security Headers
- CORS configured for localhost development
- Helmet for security headers
- Request logging for monitoring
- Error handling middleware

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'executive')),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Sessions Table
```sql
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Running the Application

### Backend Server
```bash
cd server
npm run dev
# Server runs on http://localhost:5001
```

### Frontend Application
```bash
npm run dev
# Frontend runs on http://localhost:5173
```

### Database Connection
PostgreSQL should be running on localhost:5432 with the configured database.

## Environment Variables

The backend uses these environment variables (configured in `server/.env`):
- `JWT_SECRET`: Secret key for JWT token signing
- `DB_HOST`, `DB_PORT`, `DB_NAME`: Database connection details
- `BCRYPT_ROUNDS`: Password hashing strength (set to 12)

## Security Considerations

### Production Deployment
1. **Change Default Passwords**: Update demo account passwords
2. **Secure JWT Secret**: Use a strong, random JWT secret key
3. **HTTPS Only**: Ensure all traffic uses HTTPS in production
4. **Database Security**: Secure PostgreSQL with proper user permissions
5. **Environment Variables**: Use secure environment variable management

### Access Control
- All sensitive operations require authentication
- Role-based permissions are enforced on both frontend and backend
- Token validation on every protected request
- Automatic logout on token expiration

## Troubleshooting

### Common Issues
1. **Login Not Working**: Check if backend server is running on port 5001
2. **Database Errors**: Verify PostgreSQL is running and database exists
3. **Permission Denied**: Ensure user has correct role assigned
4. **Token Expired**: Users need to login again after 24 hours

### Development Notes
- The system uses localStorage for client-side token storage
- CORS is configured for development (localhost:3000, localhost:5173)
- Console logging available for debugging authentication flows
- Toast notifications provide user feedback for all operations

## Future Enhancements

Potential improvements for the authentication system:
- Password reset functionality
- Email verification for new accounts
- Session management with refresh tokens
- Audit logging for user actions
- Multi-factor authentication (MFA)
- Password policy enforcement
- Account lockout after failed attempts

This authentication system provides a secure, scalable foundation for the CSV Dashboard application while maintaining ease of use and clear role separation.