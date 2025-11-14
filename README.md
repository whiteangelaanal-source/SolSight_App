# SolSight Accessibility Platform

A comprehensive accessibility platform connecting blind users with volunteers through WebRTC video calls, featuring blockchain-based rewards and voice control capabilities.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB 5.0+
- Redis 6.0+
- React Native development environment
- Expo CLI
- Docker and Docker Compose

### Installation

```bash
# Clone repository
git clone <repository-url>
cd SolSight_App

# Backend setup
cd backend
npm install
cp .env.production .env
# Update .env with your configuration

# Frontend setup
cd ..
npm install
npx expo install
```

## 📱 Development

### Backend Development

```bash
cd backend

# Start development server
npm run dev

# Run tests
npm run test

# Run specific test suites
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:coverage     # Tests with coverage report
```

### Frontend Development

```bash
# Start Expo development server
npx expo start

# Run on device
npx expo start --ios
npx expo start --android

# Build for production
npx expo build:android
npx expo build:ios
```

## 🧪 Testing

### Backend Testing Suite

#### Unit Tests
- **Authentication endpoints** (`tests/unit/auth.test.js`)
  - User registration and login
  - Token refresh mechanism
  - Password validation
  - Role-based access control

- **Matching algorithm** (`tests/unit/matching.test.js`)
  - Volunteer pairing logic
  - Geographic preferences
  - Skills matching
  - Queue management

#### Integration Tests
- **Complete user journeys** (`tests/integration/api.test.js`)
  - Blind user: signup → matching → call → rewards
  - Volunteer user: signup → availability → accept call → rewards
  - Admin user: login → user management → analytics

#### Test Coverage
- **Command:** `npm run test:coverage`
- **Threshold:** 80% for branches, functions, lines, statements
- **Reports:** HTML, LCOV, JSON formats

#### Running Tests

```bash
# Run all tests
npm test

# Run with watch mode
npm run test:watch

# Run specific test file
npx jest tests/unit/auth.test.js --watch

# Run with coverage
npm run test:coverage

# Run integration tests only
npm run test:integration
```

### Frontend Testing

```bash
# Install frontend testing dependencies
npm install --save-dev jest @testing-library/react-native @testing-library/jest-native

# Run component tests (when implemented)
npm run test:components

# Run E2E tests (when implemented)
npm run test:e2e
```

## 🚢 Production Deployment

### Backend Deployment

#### Using Docker (Recommended)

```bash
# Build and deploy with Docker Compose
cd backend

# Development/Testing
docker-compose up -d

# Production
docker-compose -f docker-compose.prod.yml up -d

# Manual deployment
chmod +x scripts/deploy.sh
./scripts/deploy.sh production

# Rollback if needed
./scripts/deploy.sh rollback
```

#### Manual Backend Deployment

```bash
# Install dependencies
npm ci --only=production

# Set environment variables
export NODE_ENV=production
export PORT=3000
export JWT_SECRET=your-production-secret
export MONGODB_URI=mongodb://your-production-db/solsight
# Set all required environment variables

# Start application
npm start
```

### Frontend Deployment

#### Expo Application Services (EAS)

```bash
# Configure EAS (one-time setup)
npx eas build:configure

# Build for preview
npx eas build --platform android --profile preview
npx eas build --platform ios --profile preview

# Build for production
npx eas build --platform android --profile production
npx eas build --platform ios --profile production

# Submit to app stores
npx eas submit --platform android --profile production
npx eas submit --platform ios --profile production
```

#### Environment-Specific Configuration

```bash
# Development (.env.development)
API_URL=http://localhost:3000/api
SOLANA_NETWORK=devnet
SENTRY_DSN=

# Staging (.env.staging)
API_URL=https://staging-api.solsight.app/api
SOLANA_NETWORK=testnet
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Production (.env.production)
API_URL=https://api.solsight.app/api
SOLANA_NETWORK=mainnet-beta
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

## 📊 Monitoring & Analytics

### Application Monitoring

#### Backend Health Checks
```bash
# Basic health check
curl http://localhost:3000/health

# Detailed health metrics
curl http://localhost:3000/api/admin/system/health

# Application metrics
curl http://localhost:3000/api/admin/analytics
```

#### Performance Metrics
- **API Response Time:** < 200ms (target)
- **Database Query Time:** < 50ms (target)
- **WebSocket Connection Time:** < 3s (target)
- **Memory Usage:** < 70% (alert threshold)
- **CPU Usage:** < 80% (alert threshold)

#### Monitoring Setup
```bash
# Application metrics endpoint
curl http://localhost:3000/api/admin/analytics

# Real-time WebSocket connections
ws://localhost:3000/api/webrtc/ws
```

## 🔧 Configuration

### Backend Configuration

#### Core Settings
```bash
NODE_ENV=production                    # Environment
PORT=3000                            # Server port
JWT_SECRET=your-jwt-secret          # JWT signing secret
JWT_REFRESH_SECRET=your-refresh-secret # Refresh token secret
```

#### Database Configuration
```bash
MONGODB_URI=mongodb://localhost:27017/solsight
DB_POOL_MIN=5                        # Min database connections
DB_POOL_MAX=20                       # Max database connections
```

#### Firebase Configuration
```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@project.iam.gserviceaccount.com
```

#### Blockchain Configuration
```bash
SOLANA_NETWORK=mainnet-beta
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_COMMITMENT=confirmed
```

### Frontend Configuration

#### Expo Configuration (app.json)
- **App Name:** SolSight
- **Bundle ID:** com.solsight.app
- **Permissions:** Camera, Microphone, Network State
- **Plugins:** Camera, Audio, Voice Control
- **Build Profiles:** Development, Preview, Production

#### Build Profiles
- **Development:** Internal testing with debug mode
- **Preview:** Staging environment for QA
- **Production:** App store releases with optimizations

## 🔐 Security

### Authentication & Authorization
- JWT-based authentication with refresh tokens
- Role-based access control (blind, volunteer, admin)
- API rate limiting per IP and user
- CORS protection with origin validation
- Input validation and sanitization

### API Security
```bash
# Required headers for authenticated endpoints
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Database Security
- Encrypted connections (TLS/SSL)
- User authentication with proper indexing
- Role-based data access patterns
- Input validation before database operations

### WebSocket Security
- Authentication required for WebSocket connections
- Message validation and rate limiting
- Connection limits and timeout enforcement
- Secure signaling channel for WebRTC

## 📞 API Documentation

### Core Endpoints

#### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Token refresh
- `POST /api/auth/logout` - User logout

#### User Management
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `PUT /api/users/availability` - Update availability
- `GET /api/users/stats` - Get user statistics

#### Volunteer Matching
- `POST /api/matching/start` - Start matching process
- `GET /api/matching/queue-status` - Get queue status
- `POST /api/matching/accept/:roomId` - Accept match
- `POST /api/matching/decline/:roomId` - Decline match

#### Video Calling
- `GET /api/webrtc/ice-servers` - Get ICE servers
- `GET /api/webrtc/room/:roomId` - Get room info
- `WS /api/webrtc/ws` - WebSocket signaling

#### Rewards & Blockchain
- `GET /api/rewards/user` - Get user rewards
- `GET /api/rewards/stats` - Get reward statistics
- `GET /api/rewards/blockchain-info` - Get blockchain info

#### Admin Management
- `GET /api/admin/users` - List users (admin only)
- `GET /api/admin/analytics` - Platform analytics (admin only)
- `GET /api/admin/system/health` - System health (admin only)
- `GET /api/admin/calls` - Call history (admin only)

### API Response Format

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Operation successful"
}
```

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description"
  }
}
```

## 🎯 Testing Guidelines

### Manual Testing Checklist

#### User Registration & Login
- [ ] Email validation works correctly
- [ ] Password requirements enforced
- [ ] Role selection functions properly
- [ ] Login success with valid credentials
- [ ] Login failure with invalid credentials
- [ ] Token refresh works automatically

#### Volunteer Matching Algorithm
- [ ] Geographic preferences respected
- [ ] Language matching works correctly
- [ ] Skills matching functions properly
- [ ] Queue management is efficient
- [ ] Match notifications sent promptly
- [ ] Duplicate matches prevented

#### Video Calling Features
- [ ] WebRTC connection established successfully
- [ ] Audio and video streams work
- [ ] ICE servers configured correctly
- [ ] Signaling messages exchange properly
- [ ] Call quality metrics recorded
- [ ] Call termination works correctly

#### Voice Control Features
- [ ] Voice commands recognized accurately
- [ ] Voice feedback system works
- [ ] Commands integrated with app functions
- [ ] Accessibility features work with screen readers
- [ ] Error handling for voice failures

#### Admin Management
- [ ] User management interface works
- [ ] Analytics display accurate data
- [ ] System health monitoring works
- [ ] Ban/unban functionality works
- [ ] Search and filtering works
- [ ] Bulk operations work

#### Performance & Reliability
- [ ] API response times < 200ms
- [ ] WebSocket connections < 3s
- [ ] Mobile app startup < 3s
- [ ] Memory usage < 70%
- [ ] No memory leaks detected
- [ ] Error handling works gracefully
- [ ] Offline scenarios handled properly

### Automated Testing

#### Running Tests
```bash
# Run all tests with coverage
npm run test:coverage

# Run integration tests
npm run test:integration

# Run tests with watch mode
npm run test:watch

# Run specific test file
npx jest tests/unit/auth.test.js --watch

# Generate coverage report
npm run test:coverage

# Run tests with verbose output
npm test --verbose
```

#### Test Results Analysis
- **Unit Tests:** Core functionality validation
- **Integration Tests:** End-to-end user flows
- **Performance Tests:** Load and stress testing
- **Security Tests:** Vulnerability scanning
- **Accessibility Tests:** Screen reader compatibility

### Debugging Common Issues

#### Test Failures
```bash
# Run tests with debug output
DEBUG=true npm test

# Run specific failing test
npx jest --testNamePattern="should login with valid credentials"

# Clear Jest cache
npx jest --clearCache

# Run tests in verbose mode
npm test --verbose
```

#### Database Issues
```bash
# Reset test database
npm run test:reset-db

# Check database connection
node -e "
const db = require('./src/config/database');
db.testConnection().then(() => process.exit(0)).catch(err => {
  console.error('Database connection failed:', err);
  process.exit(1);
});
"
```

#### WebSocket Issues
```bash
# Test WebSocket connection
wscat -c ws://localhost:3000/api/webrtc/ws

# Check WebSocket server status
curl http://localhost:3000/api/admin/system/health
```

#### Performance Issues
```bash
# Profile API performance
curl -w "@{time_total}" http://localhost:3000/api/health

# Check database query performance
npm run test:performance

# Monitor resource usage
top -p node -i 10
```

## 🔧 Troubleshooting

### Common Issues & Solutions

#### Backend Issues

**Problem:** Database connection failed
```bash
# Check MongoDB connection
mongo mongodb://localhost:27017/solsight

# Check environment variables
echo $MONGODB_URI

# Check MongoDB logs
sudo systemctl status mongod
sudo journalctl -u mongod -f
```

**Solution:** Verify MongoDB is running and connection string is correct

**Problem:** JWT token expired
```bash
# Check JWT configuration
grep JWT_SECRET .env

# Test token generation
node -e "console.log(require('jsonwebtoken').sign({test: 'data'}, 'your-secret'));"

# Verify token parsing
node -e "console.log(require('jsonwebtoken').verify('your-token', 'your-secret'));"
```

**Solution:** Verify JWT secrets are consistent across environments

**Problem:** WebSocket connection failed
```bash
# Test WebSocket server
wscat -c ws://localhost:3000/api/webrtc/ws

# Check server logs
docker logs solsight-api

# Verify WebSocket server status
curl http://localhost:3000/api/admin/system/health
```

**Solution:** Ensure WebSocket server is running and accessible

#### Frontend Issues

**Problem:** Metro bundler fails
```bash
# Clear Metro cache
npx expo start --clear

# Reset node modules
rm -rf node_modules && npm install

# Check for cache issues
watchman watchman list --all | grep metro
watchman watchman delete-all
```

**Solution:** Clear caches and reinstall dependencies

**Problem:** Voice commands not working
```bash
# Check microphone permissions
npx expo install:ios

# Test voice recognition
npx expo start --dev-client

# Check voice dependencies
npx expo install @react-native-voice/voice
```

**Solution:** Ensure proper permissions and voice API setup

### Debug Mode

#### Backend Debug Mode
```bash
# Enable debug logging
DEBUG=true npm run dev

# Database debug mode
DEBUG_DB=true npm run dev

# Verbose output
npm run dev --verbose
```

#### Frontend Debug Mode
```bash
# Expo debug mode
EXPO_DEBUG=true npx expo start

# Flipper debugging
npx expo start --dev-client
```

### Performance Debugging

#### Backend Performance
```bash
# Profile API calls
time curl http://localhost:3000/api/health

# Monitor resource usage
htop -p node

# Database query analysis
npm run test:performance
```

#### Frontend Performance
```bash
# Bundle analysis
npx expo start --profile production

# Performance monitoring
npx expo start --tunnel
```

## 📚 Support & Resources

### Getting Help

#### Documentation
- [API Documentation](./docs/api.md)
- [Deployment Guide](./docs/deployment.md)
- [Troubleshooting Guide](./docs/troubleshooting.md)

#### Community Support
- GitHub Issues: [Create new issue](https://github.com/your-org/solsight/issues)
- Discussions: [Ask questions](https://github.com/your-org/solsight/discussions)
- Wiki: [Community wiki](https://github.com/your-org/solsight/wiki)

#### Professional Support
- Email: support@solsight.app
- Documentation: https://docs.solsight.app
- Status Page: https://status.solsight.app

### Contributing

#### Development Guidelines
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Ensure all tests pass
6. Submit a pull request

#### Code Style
- Follow existing code patterns
- Use ESLint configuration
- Format code with Prettier
- Write meaningful commit messages
- Update documentation for changes

#### Testing Requirements
- Unit tests for new functions
- Integration tests for user flows
- Maintain test coverage above 80%
- Test accessibility features
- Test performance implications

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🎯 Development Status

This comprehensive platform is now **production-ready** with:

✅ **Complete Frontend API Integration**
- All screens use real API calls
- Proper error handling and loading states
- Real-time data synchronization

✅ **Comprehensive Admin System**
- User management with ban/unban capabilities
- Platform analytics with interactive charts
- Real-time system health monitoring
- Call history with quality metrics

✅ **Production Deployment Infrastructure**
- Docker containerization with multi-stage builds
- Automated CI/CD pipeline with GitHub Actions
- Comprehensive deployment and rollback scripts
- Environment-specific configurations

✅ **Extensive Testing Suite**
- Unit tests for all major components
- Integration tests for complete user journeys
- WebSocket and real-time feature testing
- Performance and load testing capabilities

✅ **Security Best Practices**
- JWT-based authentication with refresh tokens
- Role-based access control and audit logging
- Rate limiting and CORS protection
- Input validation and sanitization

The SolSight platform successfully connects blind users with volunteers through an accessible, reliable, and feature-rich mobile application with comprehensive backend support and production-ready deployment infrastructure.