# ClyCites Enterprise Authentication Server

A comprehensive, enterprise-grade authentication and authorization system built with Node.js, Express, and MongoDB Atlas. This server provides multi-organization support, role-based access control, API token management, and OAuth2 integration for the ClyCites platform ecosystem.

## 🚀 Features

### Core Authentication
- **User Registration & Login** with email verification
- **JWT-based Authentication** with refresh tokens
- **Password Reset** with secure token-based flow
- **Multi-Factor Authentication (MFA)** support
- **Account Security** with login attempt limiting and account locking
- **Session Management** with device tracking

### Enterprise Features
- **Multi-Organization Support** with isolated data
- **Role-Based Access Control (RBAC)** with granular permissions
- **Team Management** with hierarchical structures
- **API Token Management** with scoped access
- **OAuth2 Applications** for third-party integrations
- **SSO Integration** (Google, Microsoft, GitHub, etc.)

### Security & Compliance
- **Enterprise-grade Security** with helmet, rate limiting, and input sanitization
- **Audit Logging** with comprehensive event tracking
- **Data Encryption** with bcrypt password hashing
- **CORS Protection** with configurable origins
- **Rate Limiting** with different tiers for various endpoints

### Developer Experience
- **Comprehensive API Documentation** with interactive endpoints
- **Postman Collection** auto-generation
- **Docker Support** with production-ready containers
- **Database Seeding** with sample data
- **Extensive Testing** with Jest test suite
- **TypeScript-ready** with ES modules

## 🏗️ Architecture

\`\`\`
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client Apps   │    │   Web Dashboard │    │   Mobile Apps   │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │     Nginx Load Balancer   │
                    └─────────────┬─────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │   ClyCites Auth Server    │
                    │   (Node.js + Express)     │
                    └─────────────┬─────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │    MongoDB Atlas          │
                    │   (Primary Database)      │
                    └───────────────────────────┘
\`\`\`

## 📋 Prerequisites

- **Node.js** 18+ 
- **MongoDB Atlas** account and cluster
- **Email Service** (Gmail, SendGrid, Mailgun, etc.)
- **Docker** (optional, for containerized deployment)

## 🚀 Quick Start

### 1. Clone and Install

\`\`\`bash
git clone <repository-url>
cd clycites-enterprise-auth
npm install
\`\`\`

### 2. Environment Configuration

Copy the example environment file and configure your settings:

\`\`\`bash
cp .env.example .env
\`\`\`

**Required Environment Variables:**

\`\`\`env
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database

# JWT Secrets (generate strong, unique keys)
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here

# Email Configuration (Gmail example)
EMAIL_SERVICE=gmail
EMAIL_USERNAME=your-email@gmail.com
EMAIL_PASSWORD=your-gmail-app-password

# Client Application URL
CLIENT_URL=http://localhost:3000
\`\`\`

### 3. Database Setup

Seed the database with default organization and admin user:

\`\`\`bash
npm run seed
\`\`\`

This creates:
- **Super Admin User**: admin@clycites.com / SuperAdmin123!
- **Default Organization**: ClyCites
- **System Roles**: Platform Owner, Admin, Manager, Member, Viewer
- **Sample Users**: john@example.com, jane@example.com (Password123!)

### 4. Start the Server

\`\`\`bash
# Development mode with hot reload
npm run dev

# Production mode
npm start
\`\`\`

The server will start on http://localhost:5000

### 5. Verify Installation

- **Health Check**: http://localhost:5000/health
- **API Documentation**: http://localhost:5000/api/docs
- **Test Login**: Use admin@clycites.com / SuperAdmin123!

## 📚 API Documentation

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | \`/api/auth/register\` | Register new user | No |
| POST | \`/api/auth/login\` | User login | No |
| POST | \`/api/auth/logout\` | User logout | Yes |
| GET | \`/api/auth/me\` | Get current user | Yes |
| POST | \`/api/auth/refresh-token\` | Refresh access token | No |
| GET | \`/api/auth/verify-email/:token\` | Verify email address | No |
| POST | \`/api/auth/forgot-password\` | Request password reset | No |
| PUT | \`/api/auth/reset-password/:token\` | Reset password | No |
| PUT | \`/api/auth/change-password\` | Change password | Yes |

### Organization Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | \`/api/organizations\` | Get user organizations | Yes |
| POST | \`/api/organizations\` | Create organization | Yes |
| GET | \`/api/organizations/:id\` | Get organization details | Yes |
| PUT | \`/api/organizations/:id\` | Update organization | Yes (Admin+) |
| POST | \`/api/organizations/:id/invite\` | Invite user to organization | Yes (Admin+) |
| GET | \`/api/organizations/:id/members\` | Get organization members | Yes |

### Team Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | \`/api/organizations/:orgId/teams\` | Get organization teams | Yes |
| POST | \`/api/organizations/:orgId/teams\` | Create team | Yes (Manager+) |
| POST | \`/api/teams/:teamId/invite\` | Invite user to team | Yes (Team Lead+) |

### API Token Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | \`/api/organizations/:orgId/tokens\` | Get user API tokens | Yes |
| POST | \`/api/organizations/:orgId/tokens\` | Create API token | Yes |
| DELETE | \`/api/tokens/:tokenId\` | Revoke API token | Yes |

## 🔧 Configuration

### Email Services

The system supports multiple email providers:

**Gmail (Recommended for development):**
\`\`\`env
EMAIL_SERVICE=gmail
EMAIL_USERNAME=your-email@gmail.com
EMAIL_PASSWORD=your-gmail-app-password
\`\`\`

**SendGrid:**
\`\`\`env
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=your-sendgrid-api-key
\`\`\`

**Mailgun:**
\`\`\`env
EMAIL_SERVICE=mailgun
MAILGUN_USERNAME=your-mailgun-username
MAILGUN_PASSWORD=your-mailgun-password
\`\`\`

**Custom SMTP:**
\`\`\`env
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_SECURE=false
EMAIL_USERNAME=your-email@domain.com
EMAIL_PASSWORD=your-password
\`\`\`

### OAuth2 Providers

**Google OAuth:**
\`\`\`env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
\`\`\`

### Security Configuration

\`\`\`env
# JWT Configuration
JWT_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d
JWT_COOKIE_EXPIRE=7

# Rate Limiting
RATE_LIMIT_WINDOW=900000  # 15 minutes
RATE_LIMIT_MAX=100        # requests per window
AUTH_RATE_LIMIT_MAX=5     # auth attempts per window

# Password Security
BCRYPT_ROUNDS=12
MAX_LOGIN_ATTEMPTS=5
LOCK_TIME=7200000         # 2 hours
\`\`\`

## 🐳 Docker Deployment

### Development with Docker

\`\`\`bash
# Build and start all services
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Or use the setup script
chmod +x scripts/docker-setup.sh
./scripts/docker-setup.sh dev
\`\`\`

### Production Deployment

\`\`\`bash
# Production deployment
docker-compose up --build -d

# Or use the setup script
./scripts/docker-setup.sh
\`\`\`

**Services included:**
- **ClyCites Auth Server** (Node.js application)
- **Nginx** (Reverse proxy with SSL termination)
- **Redis** (Session storage and caching)
- **MongoDB Express** (Database admin interface - dev only)

### Docker Commands

\`\`\`bash
# View logs
docker-compose logs -f clycites-auth

# Restart services
docker-compose restart

# Stop all services
docker-compose down

# Rebuild and restart
docker-compose up --build -d

# Run database seeding in container
docker-compose exec clycites-auth npm run seed
\`\`\`

## 🧪 Testing

### Run Tests

\`\`\`bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
\`\`\`

### Test Coverage

The test suite includes:
- **Authentication flow tests** (register, login, logout)
- **Authorization tests** (role-based access control)
- **API endpoint tests** (all major endpoints)
- **Security tests** (rate limiting, input validation)
- **Database model tests** (user, organization, role models)

Target coverage: 80%+ for branches, functions, lines, and statements.

## 📊 Monitoring and Logging

### Log Files

Logs are stored in the \`logs/\` directory:
- \`combined.log\` - All application logs
- \`error.log\` - Error logs only
- \`exceptions.log\` - Unhandled exceptions
- \`rejections.log\` - Unhandled promise rejections

### Log Levels

\`\`\`env
LOG_LEVEL=info  # error, warn, info, debug
\`\`\`

### Health Monitoring

- **Health Check**: \`GET /health\`
- **Status Check**: \`GET /api/status\`
- **Metrics**: Available through application logs

## 🔒 Security Best Practices

### Implemented Security Measures

1. **Input Validation** - Express-validator for all inputs
2. **SQL Injection Protection** - MongoDB sanitization
3. **XSS Protection** - XSS-clean middleware
4. **Rate Limiting** - Different limits for different endpoints
5. **CORS Protection** - Configurable allowed origins
6. **Helmet Security Headers** - Security headers for all responses
7. **Password Security** - Bcrypt with configurable rounds
8. **JWT Security** - Short-lived access tokens with refresh tokens
9. **Account Security** - Login attempt limiting and account locking

### Security Recommendations

1. **Use strong, unique JWT secrets** in production
2. **Enable HTTPS** with valid SSL certificates
3. **Configure proper CORS origins** for your domains
4. **Use environment variables** for all sensitive data
5. **Regularly rotate JWT secrets** and API keys
6. **Monitor logs** for suspicious activities
7. **Keep dependencies updated** with \`npm audit\`

## 🚀 Production Deployment

### Environment Setup

1. **Set NODE_ENV=production**
2. **Use strong, unique secrets** for JWT and sessions
3. **Configure production database** (MongoDB Atlas recommended)
4. **Set up SSL certificates** for HTTPS
5. **Configure email service** for production use
6. **Set up monitoring** and alerting

### Deployment Checklist

- [ ] Environment variables configured
- [ ] Database connection tested
- [ ] Email service configured and tested
- [ ] SSL certificates installed
- [ ] Rate limiting configured appropriately
- [ ] Logging configured for production
- [ ] Health checks working
- [ ] Backup strategy in place
- [ ] Monitoring and alerting set up

### Scaling Considerations

- **Load Balancing**: Use Nginx or cloud load balancers
- **Database**: MongoDB Atlas with replica sets
- **Caching**: Redis for session storage and caching
- **CDN**: For static assets and global distribution
- **Monitoring**: Application performance monitoring (APM)

## 🛠️ Development

### Project Structure

\`\`\`
clycites-enterprise-auth/
├── app.js                 # Main application file
├── config/               # Configuration files
│   ├── db.js            # Database connection
│   └── passport.js      # Passport.js configuration
├── controllers/         # Route controllers
│   ├── authController.js
│   ├── organizationController.js
│   └── ...
├── middlewares/         # Custom middleware
│   ├── authMiddleware.js
│   ├── errorMiddleware.js
│   └── ...
├── models/             # Database models
│   ├── userModel.js
│   ├── organizationModel.js
│   └── ...
├── routes/             # API routes
│   ├── authRoutes.js
│   ├── organizationRoutes.js
│   └── ...
├── utils/              # Utility functions
│   ├── emailService.js
│   ├── logger.js
│   └── ...
├── tests/              # Test files
├── scripts/            # Utility scripts
├── docker-compose.yml  # Docker configuration
├── Dockerfile         # Docker image definition
└── README.md          # This file
\`\`\`

### Development Commands

\`\`\`bash
# Start development server with hot reload
npm run dev

# Run linting
npm run lint
npm run lint:fix

# Format code
npm run format

# Run tests
npm test
npm run test:watch
npm run test:coverage

# Database operations
npm run seed          # Seed database with sample data
npm run migrate       # Run database migrations

# Docker operations
npm run docker:build  # Build Docker image
npm run docker:run    # Run Docker container
\`\`\`

### Adding New Features

1. **Create model** in \`models/\` directory
2. **Add controller** in \`controllers/\` directory
3. **Define routes** in \`routes/\` directory
4. **Add middleware** if needed in \`middlewares/\`
5. **Write tests** in \`tests/\` directory
6. **Update documentation** in this README

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (\`git checkout -b feature/amazing-feature\`)
3. Commit your changes (\`git commit -m 'Add amazing feature'\`)
4. Push to the branch (\`git push origin feature/amazing-feature\`)
5. Open a Pull Request

### Code Style

- Use **ES6+ syntax** and modules
- Follow **ESLint** configuration
- Use **Prettier** for code formatting
- Write **comprehensive tests** for new features
- Add **JSDoc comments** for functions and classes

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Getting Help

1. **Check the documentation** in this README
2. **Review the API docs** at \`/api/docs\`
3. **Check the logs** for error messages
4. **Search existing issues** in the repository
5. **Create a new issue** with detailed information

### Common Issues

**Database Connection Issues:**
- Verify MongoDB Atlas connection string
- Check network access settings in MongoDB Atlas
- Ensure database user has proper permissions

**Email Service Issues:**
- Verify email service credentials
- Check spam folders for test emails
- Use app passwords for Gmail (not regular password)

**Authentication Issues:**
- Verify JWT secrets are set correctly
- Check token expiration settings
- Ensure user email is verified

### Performance Optimization

- **Database Indexing**: Ensure proper indexes on frequently queried fields
- **Caching**: Implement Redis caching for frequently accessed data
- **Connection Pooling**: Configure MongoDB connection pooling
- **Rate Limiting**: Adjust rate limits based on usage patterns

## 🔄 Changelog

### Version 2.0.0 (Current)
- ✅ Multi-organization support
- ✅ Role-based access control
- ✅ API token management
- ✅ OAuth2 applications
- ✅ Team management
- ✅ Enterprise SSO integration
- ✅ Comprehensive audit logging
- ✅ Docker containerization
- ✅ Production-ready deployment

### Version 1.0.0
- ✅ Basic authentication (register, login, logout)
- ✅ JWT token management
- ✅ Email verification
- ✅ Password reset functionality
- ✅ Basic user management

## 🎯 Roadmap

### Upcoming Features
- [ ] **Multi-Factor Authentication (MFA)** with TOTP support
- [ ] **Advanced Analytics** and reporting dashboard
- [ ] **Webhook System** for real-time event notifications
- [ ] **Advanced Audit Logging** with detailed event tracking
- [ ] **API Rate Limiting** per organization/user
- [ ] **Advanced Role Management** with custom permissions
- [ ] **SSO Integration** with SAML and LDAP
- [ ] **Mobile SDK** for React Native and Flutter
- [ ] **GraphQL API** alongside REST API
- [ ] **Real-time Notifications** with WebSocket support

---

**Built with ❤️ by the ClyCites Team**

For more information, visit [ClyCites.com](https://clycites.com)
