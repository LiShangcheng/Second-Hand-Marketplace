# NYU Campus Marketplace

[![API CI/CD](https://github.com/LiShangcheng/Second-Hand-Marketplace/actions/workflows/api.yml/badge.svg)](https://github.com/LiShangcheng/Second-Hand-Marketplace/actions/workflows/api.yml)
[![Web CI/CD](https://github.com/LiShangcheng/Second-Hand-Marketplace/actions/workflows/web.yml/badge.svg)](https://github.com/LiShangcheng/Second-Hand-Marketplace/actions/workflows/web.yml)
[![MongoDB CI/CD](https://github.com/LiShangcheng/Second-Hand-Marketplace/actions/workflows/mongo.yml/badge.svg)](https://github.com/LiShangcheng/Second-Hand-Marketplace/actions/workflows/mongo.yml)
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
- **NYU Email Verification**: Require a one-time code before a new account can sign in
- **Campus-Specific**: NYU Brooklyn/Tandon and Washington Square locations

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
   - Docker Image: [leoli120959/marketplace-web:latest](https://hub.docker.com/r/leoli120959/marketplace-web)
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

**Optional:**

| Variable | Description | Default |
|----------|-------------|---------|
| USE_MOCK_DB | Use in-memory DB for testing | 0 |

### Email verification

Local development defaults to `MAIL_MODE=console`. Verification codes are printed in the API logs:

```bash
docker compose logs -f api
```

To send real email, set `MAIL_MODE=smtp` and configure `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USERNAME`, `SMTP_PASSWORD`, and `SMTP_FROM` in `.env`. Copy `.env.example`
for the complete list of options. Verification codes expire after 10 minutes, allow
five attempts, and have a 60-second resend cooldown by default.

Registration returns `verification_required` instead of a login token. Complete the
flow with `POST /api/auth/verify-email`; use `POST /api/auth/resend-verification` to
request a replacement code.

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
| `/api/auth/verify-email` | POST | Verify a six-digit email code |
| `/api/auth/resend-verification` | POST | Request a new verification code |
| `/api/auth/login` | POST | Login user |
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

Three independent GitHub Actions workflows run for every pull request to `main`/`master` and every push to those branches:

- **api.yml**: runs the Python test suite with an 80% coverage gate, builds the API image, publishes both `marketplace-api` and backward-compatible `swap-hub-api` tags, then deploys the API.
- **web.yml**: installs dependencies from the lock file, builds the Vite application and image, publishes `marketplace-web`, then deploys the frontend.
- **mongo.yml**: starts the MongoDB image and verifies its seed data, publishes `marketplace-mongo`, then optionally redeploys it.

Pull requests only test and build. Pushes to `main`/`master` publish both `latest` and immutable commit-SHA image tags. DigitalOcean deployment is skipped when its app ID is not configured.

Configure these GitHub repository secrets under **Settings → Secrets and variables → Actions**:

| Name | Required | Purpose |
|------|----------|---------|
| `DOCKERHUB_USERNAME` | Yes | Docker Hub namespace (for this repository, `leoli120959`) |
| `DOCKERHUB_TOKEN` | Yes | Docker Hub access token with read/write permission |
| `DO_API_TOKEN` | For deployment | DigitalOcean personal access token |
| `DO_API_APP_ID` | For API deployment | API App Platform app ID (`DO_APP_ID` is also accepted for compatibility) |
| `DO_WEB_APP_ID` | For web deployment | Frontend App Platform app ID |
| `DO_MONGO_APP_ID` | Optional | MongoDB App Platform app ID, if MongoDB is deployed as a separate app |

Also add the repository Actions variable `VITE_API_BASE_URL` with the public API URL, for example `https://api.example.com`. The value is compiled into the frontend image. Configure runtime secrets such as `MONGO_URI`, `MONGO_DB`, `CORS_ORIGIN`, and SMTP credentials in DigitalOcean App Platform rather than in the image-build workflow.

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
