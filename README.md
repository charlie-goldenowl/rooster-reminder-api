# Birthday Reminder Service

A scalable, timezone-aware birthday reminder service built with NestJS, TypeORM, and Bull Queue.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   REST API      │    │   Event Engine   │    │  Message Queue  │
│   (Controllers) │────│   (Schedulers)   │────│   (Bull Queue)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User Service  │    │  Event Service   │    │ Notification    │
│                 │    │   (Extensible)   │    │    Service      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              Database Layer (PostgreSQL + Redis)                │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Features

- ✅ **Timezone-aware scheduling**: Send messages at 9 AM local time
- ✅ **Fault tolerance**: Auto-retry failed messages with exponential backoff
- ✅ **Race condition prevention**: Distributed locking with Redis
- ✅ **Extensible architecture**: Easy to add new event types (anniversary, etc.)
- ✅ **Scalable design**: Handle thousands of events per day
- ✅ **Comprehensive testing**: Unit and integration tests
- ✅ **Production ready**: Logging, monitoring, validation

## 📋 Project Structure

```
src/
├── modules/
│   ├── user/                   # User management
│   │   ├── dto/
│   │   ├── entities/
│   │   ├── user.controller.ts
│   │   ├── user.service.ts
│   │   └── user.module.ts
│   ├── event/                  # Event management (extensible)
│   │   ├── dto/
│   │   ├── entities/
│   │   ├── enums/
│   │   ├── interfaces/
│   │   ├── processors/
│   │   ├── event.service.ts
│   │   └── event.module.ts
│   ├── notification/           # Message delivery
│   │   ├── dto/
│   │   ├── entities/
│   │   ├── notification.service.ts
│   │   └── notification.module.ts
│   └── scheduler/              # Cron jobs and queue management
│       ├── scheduler.service.ts
│       └── scheduler.module.ts
├── common/
│   ├── decorators/
│   ├── guards/
│   ├── interfaces/
│   └── utils/
├── config/
├── database/
└── main.ts
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js >= 18
- PostgreSQL >= 13
- Redis >= 6

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 3. Database Setup
```bash
# Generate migration
npm run migration:generate

# Run migrations
npm run migration:run
```

### 4. Start Services
```bash
# Development
npm run start:dev

# Production
npm run start:prod
```

## 📚 API Documentation

### Users
```http
# Create user
POST /user
{
  "firstName": "John",
  "lastName": "Doe", 
  "birthday": "1990-05-15",
  "timezone": "America/New_York"
}

# Update user
PUT /user/:id
{
  "firstName": "Jane",
  "timezone": "America/Los_Angeles"
}

# Delete user
DELETE /user/:id
```

### Health Check
```http
GET /health
```

## 🏗️ Architecture Details

### 1. Extensible Event System
The system is designed to handle multiple event types through a plugin architecture:

- **Event Types**: Enum-based event type system
- **Event Processors**: Strategy pattern for different event handling
- **Message Builders**: Template-based message generation

### 2. Timezone Handling
- Uses `luxon` for robust timezone calculations
- Handles DST transitions automatically
- Stores timezone strings (e.g., "America/New_York")

### 3. Fault Tolerance
- **Queue System**: Bull queue with Redis
- **Retry Logic**: Exponential backoff (3 attempts)
- **Dead Letter Queue**: Failed messages after all retries
- **Duplicate Prevention**: Redis-based distributed locking

### 4. Scalability Features
- **Horizontal Scaling**: Stateless design
- **Database Optimization**: Proper indexing and constraints
- **Queue Workers**: Multiple workers can process jobs
- **Caching**: Redis for locks and temporary data

## 🧪 Testing

```bash
# Unit tests
npm run test

# Integration tests  
npm run test:e2e

# Test coverage
npm run test:cov
```

## 📊 Monitoring & Observability

- **Health Checks**: `/health` endpoint
- **Queue Dashboard**: Bull Dashboard at `/admin/queues`
- **Logging**: Structured logging with Winston
- **Metrics**: Custom metrics for message delivery

## 🔧 Configuration

Key environment variables:

```env
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=rooster_db
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Webhook
WEBHOOK_URL=https://hookbin.com/your-bin

# App
PORT=3000
NODE_ENV=development
```

## 🚀 Deployment

### Docker
```bash
docker-compose up -d
```

### Production Checklist
- [ ] Set NODE_ENV=production
- [ ] Configure proper database credentials
- [ ] Set up Redis cluster
- [ ] Configure logging level
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Configure reverse proxy (Nginx)

## 📈 Performance Considerations

- **Database**: Proper indexing on birthday + timezone
- **Queue**: Redis persistence configured
- **Memory**: Efficient TypeORM entity loading
- **CPU**: Optimized cron scheduling (hourly checks)

## 🔄 Future Extensions

Easy to add new features:

1. **New Event Types**: Add to `EventType` enum + create processor
2. **New Channels**: SMS, Push notifications (implement `NotificationChannel`)
3. **Advanced Scheduling**: Custom times, recurring events
4. **Analytics**: Event tracking, delivery reports


**Built with ❤️ using NestJS, TypeORM, and Bull Queue**