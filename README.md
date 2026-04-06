# NYU Campus Marketplace

[![API CI/CD](https://github.com/swe-students-fall2025/5-final-reallyawesome/actions/workflows/api.yml/badge.svg)](https://github.com/swe-students-fall2025/5-final-reallyawesome/actions/workflows/api.yml)
[![MongoDB CI/CD](https://github.com/swe-students-fall2025/5-final-reallyawesome/actions/workflows/mongo.yml/badge.svg)](https://github.com/swe-students-fall2025/5-final-reallyawesome/actions/workflows/mongo.yml)
[![Test Coverage](https://img.shields.io/badge/coverage-86%25-brightgreen)](./services/api/tests/)

A full-stack secondhand marketplace for NYU students to buy, sell, and trade campus items. Built with Flask, MongoDB, Docker, and deployed to DigitalOcean App Platform.
The intuition we had for this project came from our own experiences—every semester, our team members buy textbooks and furniture at the start, but at the end of the semester, we have to discard or waste them. We don't want to waste money or these resources, and we know there are students in the market who really want to buy these secondhand textbooks or items. Current solutions like Facebook Marketplace lack campus context, safety through university verification, and student-specific features. NYU Campus Marketplace solves this by creating a trusted, campus-centric trading platform exclusively for NYU students, featuring NYU email verification, campus-specific filtering (Brooklyn vs Washington Square), course code tagging for textbooks, and suggested meetup points students actually know, like Rogers Hall or Bobst Library.

## 👥 Team

- **Leo Li** - [Leo Li](https://github.com/LiShangcheng)

## 📋 Features

- **Browse & Search**: Filter items by category, campus location, and keywords
- **Post Listings**: Create listings with images, descriptions, and course codes (for textbooks)
- **Messaging**: Real-time chat between buyers and sellers
- **Favorites**: Save items to wishlist
- **User Profiles**: Manage listings and avatars
- **Campus-Specific**: NYU Brooklyn/Tandon and Washington Square locations
- **Email Verification**: New accounts must verify an `@nyu.edu` email before they can log in

## 🏗️ System Architecture

**Three subsystems:**

1. **Flask API** (`services/api/`) - Python REST backend
   - Docker Image (CI): [leoli120959/marketplace-api:latest](https://hub.docker.com/r/leoli120959/marketplace-api)  
   - Docker Image (App Platform): [leoli120959/swap-hub-api:latest](https://hub.docker.com/r/leoli120959/swap-hub-api)
   - Port: env `PORT` (compose sets 5001 and maps to host 5002; default 5000 if unset)

2. **MongoDB** (`services/mongo/`) - Data persistence
   - Docker Image: [leoli120959/marketplace-mongo:latest](https://hub.docker.com/r/leoli120959/marketplace-mongo)
   - Port: 27017 (mapped to 27018 on host)

3. **Web Frontend** (`services/web/`) - Vite + React UI
   - Port: 3000

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Git

### Run with Docker (Recommended)

```bash
git clone https://github.com/swe-students-fall2025/5-final-reallyawesome.git
cd 5-final-reallyawesome

# Create environment file
cp .env.example .env

# Start services
docker compose up --build
```

Open http://localhost:3000 in your browser for the UI, and http://localhost:5002 for the API.

### Run Locally (Development)

```bash
# Setup Python environment
cd services/api
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Use mock database for testing
export USE_MOCK_DB=1

# Start Flask dev server
python app.py
```

Open http://localhost:5000

### Run Frontend Locally

```bash
cd services/web
npm install
npm run dev
```

Open http://localhost:3000

## ⚙️ Configuration

### Environment Variables

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

**Required variables:**

| Variable | Description | Default |
|----------|-------------|---------|
| MONGO_URI | MongoDB connection string | mongodb://mongo:27017 |
| MONGO_DB | Database name | marketplace |
| PORT | API server port | 5001 |
| CORS_ORIGIN | Allowed frontend origin | http://localhost:3000 |
| EMAIL_VERIFICATION_BASE_URL | Public API base used in verification links | http://localhost:5002 |

**Optional:**

| Variable | Description | Default |
|----------|-------------|---------|
| USE_MOCK_DB | Use in-memory DB for testing | 0 |
| FRONTEND_BASE_URL | App URL shown on the verification success page | http://localhost:3000 |
| EMAIL_VERIFICATION_TTL_HOURS | Verification link expiration window | 24 |
| SMTP_HOST | SMTP server hostname for real email delivery | unset |
| SMTP_PORT | SMTP server port | 587 |
| SMTP_USERNAME | SMTP username | unset |
| SMTP_PASSWORD | SMTP password | unset |
| SMTP_FROM_EMAIL | Sender address for verification emails | unset |
| SMTP_USE_TLS | Enable STARTTLS for SMTP | 1 |

If SMTP is not configured, the API still creates verification tokens and returns a preview verification link in register/resend responses. That keeps local development and test environments usable while you wire up a real mail provider.

### Database Seeding

MongoDB automatically seeds initial data on startup via `services/mongo/initdb/init.js`:
- Sample "Welcome" item
- Sample "Notebook" item

## 🧪 Testing

Run all tests with coverage reporting:

```bash
cd services/api
pytest --cov=. --cov-report=term --cov-report=xml
```

Verify 80% coverage threshold:
```bash
coverage report --fail-under=80
```

**Test Coverage**: Authentication, listings, search, messaging, favorites (80%+)

## 📡 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/listings` | GET/POST | Browse/create listings |
| `/api/auth/register` | POST | Register user |
| `/api/auth/login` | POST | Login user |
| `/api/auth/resend-verification` | POST | Resend email verification link |
| `/api/auth/verify-email` | POST | Verify email token with JSON |
| `/verify-email` | GET | Verify email token from a browser link |
| `/api/threads` | POST/GET | Create/fetch message threads |
| `/api/messages` | POST/GET | Send/fetch messages |
| `/api/favorites` | POST/DELETE/GET | Manage wishlist |

See `services/api/app.py` for complete endpoint documentation.

## 🐳 Docker Images

Pre-built images available on Docker Hub:

```bash
# Pull and run API (App Platform image)
docker pull leoli120959/swap-hub-api:latest
docker run -p 5002:5001 -e PORT=5001 leoli120959/swap-hub-api:latest

# Pull and run MongoDB
docker pull leoli120959/marketplace-mongo:latest
docker run -p 27018:27017 leoli120959/marketplace-mongo:latest
```

Manual build:
```bash
docker build -f services/api/Dockerfile -t leoli120959/marketplace-api:latest .
docker build -f services/mongo/Dockerfile -t leoli120959/marketplace-mongo:latest services/mongo/
```

## 🔄 CI/CD Pipeline

GitHub Actions workflows trigger on push/PR to `main`:

- **api.yml**: Tests API, builds/pushes Docker image, triggers DigitalOcean App Platform deploy (if DO secrets set)
- **mongo.yml**: Builds/pushes MongoDB image, triggers DigitalOcean App Platform deploy (if DO secrets set)
- **build-push.yml**: Builds/pushes `swap-hub-api` image for App Platform

Required secrets in GitHub:
- `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` - Docker Hub creds
- (Optional deploy) `DO_API_TOKEN`, `DO_APP_ID` - to trigger App Platform redeploy for API
- (Optional deploy) `DO_MONGO_APP_ID` - to trigger Mongo-related App Platform redeploy
- `MONGO_URI`, `MONGO_DB` - Production MongoDB connection

## 📁 Project Structure

```
├── services/
│   ├── api/                 # Flask REST API
│   │   ├── app.py          # Main application
│   │   ├── db.py           # MongoDB interface
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   └── tests/          # Unit tests
│   └── mongo/              # MongoDB setup
│       ├── Dockerfile
│       └── initdb/         # Seed data
│   └── web/                # Vite + React frontend
│       ├── Dockerfile
│       └── package.json
├── docker-compose.yml      # Service orchestration
└── .env.example            # Environment template
```

## 🔒 Security Notes

**Demo project - NOT production-ready:**

- Passwords stored in plaintext (no bcrypt)
- Session management in memory
- No CSRF protection
- No rate limiting

**Production TODO:**
- Add bcrypt password hashing
- Use JWT tokens with Redis sessions
- Implement CSRF protection
- Add rate limiting (Flask-Limiter)
- Input validation with Marshmallow
- HTTPS with SSL certificates

## 🐛 Troubleshooting

**Port conflicts?**
```bash
# Change host port in docker-compose.yml
ports:
  - "5003:5001"  # Use 5003 instead of 5002
```

**MongoDB connection fails?**
```bash
# Verify MongoDB is running
docker compose ps

# Check logs
docker compose logs mongo
```

**Tests fail locally?**
```bash
# Use mock database
export USE_MOCK_DB=1
pytest services/api/tests/
```

## 📄 License

GNU General Public License v3.0 - see LICENSE file for details.
