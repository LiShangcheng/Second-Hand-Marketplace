# NYU Campus Marketplace

[![API CI](https://github.com/LiShangcheng/Second-Hand-Marketplace/actions/workflows/api.yml/badge.svg?branch=main)](https://github.com/LiShangcheng/Second-Hand-Marketplace/actions/workflows/api.yml)
[![Web CI](https://github.com/LiShangcheng/Second-Hand-Marketplace/actions/workflows/web.yml/badge.svg?branch=main)](https://github.com/LiShangcheng/Second-Hand-Marketplace/actions/workflows/web.yml)
[![Container CI/CD](https://github.com/LiShangcheng/Second-Hand-Marketplace/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/LiShangcheng/Second-Hand-Marketplace/actions/workflows/deploy.yml)
[![Coverage](https://img.shields.io/badge/coverage-85.64%25-brightgreen)](services/api/tests)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

NYU Campus Marketplace is a student-focused secondhand marketplace for buying, selling, and exchanging items around NYU's Brooklyn and Washington Square campuses. The application uses React, Flask, MongoDB, and Docker and is deployed as one DigitalOcean App Platform service.

## Features

- Browse and filter listings by category, campus, and keyword.
- Create and edit listings with multiple images and meetup locations.
- Mark listings as sold and manage personal listings from a profile.
- Save and remove favorite listings.
- Create buyer/seller conversations, send messages and images, and track unread messages.
- Register with an `@nyu.edu` address and verify it with a six-digit email code.
- Update profile information and upload an avatar.
- Enforce verification-code expiry, resend cooldowns, and attempt limits.

## Architecture

Production uses one container and one public origin:

```text
Browser
  └── DigitalOcean App Platform / Gunicorn / Flask
        ├── /static/*  React production bundle
        ├── /api/*     REST API
        └── MongoDB Atlas
```

The root [Dockerfile](Dockerfile) is a multi-stage build. Node builds the Vite frontend, the resulting bundle is copied into Flask's static directory, and Gunicorn serves the combined application on `PORT`.

Local development can still run the frontend, API, and MongoDB as separate Docker Compose services.

## Quick start

### Docker Compose

Requirements: Docker, Docker Compose, and Git.

```bash
git clone https://github.com/LiShangcheng/Second-Hand-Marketplace.git
cd Second-Hand-Marketplace
cp .env.example .env
docker compose up --build
```

- Frontend: <http://localhost:3000>
- API health check: <http://localhost:5002/api/health>
- MongoDB: `localhost:27018`

### Run the services directly

Backend:

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r services/api/requirements.txt
export USE_MOCK_DB=1
python -m services.api.app
```

Frontend, in another terminal:

```bash
cd services/web
npm ci
npm run dev
```

## Configuration

Copy `.env.example` to `.env` for local development. In DigitalOcean, configure these as component-level Runtime variables. Encrypt secrets.

| Variable | Required | Description | Default |
|---|---:|---|---|
| `MONGO_URI` | Production | MongoDB Atlas connection string | `mongodb://localhost:27017` |
| `MONGO_DB` | Yes | Database name | `marketplace` |
| `PORT` | Yes | HTTP port | `5000` |
| `CORS_ORIGIN` | Separate frontend only | Allowed frontend origin | `http://localhost:3000` |
| `USE_MOCK_DB` | Tests only | Use the in-memory database | `0` |
| `VERIFICATION_SECRET` | Yes | HMAC secret for verification codes | Development placeholder |
| `VERIFICATION_TTL_MINUTES` | No | Code lifetime | `10` |
| `VERIFICATION_RESEND_SECONDS` | No | Resend cooldown | `60` |
| `VERIFICATION_MAX_ATTEMPTS` | No | Attempts before a new code is required | `5` |

Because production serves the UI and API from the same origin, `VITE_API_BASE_URL` is not required for the single-container deployment.

## Email verification

The complete registration flow is:

1. `POST /api/auth/register` creates an unverified account and sends a code.
2. `POST /api/auth/verify-email` validates the code and signs the user in.
3. `POST /api/auth/resend-verification` issues a replacement code after the cooldown.
4. Unverified accounts cannot log in.

### Development mode

`MAIL_MODE=console` does not send real email. It writes the code to API logs:

```bash
docker compose logs -f api
```

### SMTP mode

Set the following DigitalOcean component-level Runtime variables to send real mail:

```text
MAIL_MODE=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=your-smtp-user
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=verified-sender@example.com
SMTP_USE_TLS=1
```

Encrypt `SMTP_PASSWORD`, `SMTP_USERNAME`, and `VERIFICATION_SECRET`. `SMTP_FROM` must be an address accepted by the selected SMTP provider. The automated suite verifies message construction, STARTTLS, authentication, sending, expiry, resend cooldown, invalid codes, attempt limits, and recovery after delivery failures. A real inbox delivery test still requires valid provider credentials in DigitalOcean.

## Tests

### API and email tests

```bash
python -m pytest \
  --cov=services.api \
  --cov-report=term-missing \
  --cov-report=xml \
  --cov-fail-under=80
```

Current verified result: **62 tests passed**, with **85.64% coverage**. `email_service.py` has 100% line coverage.

### Frontend build and dependency audit

```bash
cd services/web
npm ci
npm audit --audit-level=high
npm run build
```

### Production container

```bash
docker build -t nyu-swap-hub .
docker run --rm -p 5000:5000 \
  -e USE_MOCK_DB=1 \
  -e PORT=5000 \
  nyu-swap-hub
```

Then check <http://localhost:5000/> and <http://localhost:5000/api/health>.

## DigitalOcean deployment

Create one App Platform Web Service from this repository:

| Setting | Value |
|---|---|
| Branch | `main` |
| Source directory | Repository root / blank |
| Dockerfile | `Dockerfile` |
| Public HTTP port | `5000` |
| Containers | `1` |
| Health check | `/api/health` |

Add the runtime variables described above, including an encrypted Atlas `MONGO_URI`. Atlas must allow traffic from the application's egress addresses; `0.0.0.0/0` is acceptable only for a short-lived demo with strong database credentials.

## CI/CD

The tracked GitHub Actions workflows are:

- `api.yml`: runs all Flask, MongoDB-mock, authentication, and email tests with an 80% coverage gate.
- `web.yml`: installs locked Node dependencies, runs `npm audit`, builds the Vite bundle, and uploads the bundle artifact.
- `deploy.yml`: builds the root production image, reruns the API suite inside it, starts the image, and smoke-tests the homepage, health endpoint, and compiled JavaScript. It can then trigger a DigitalOcean deployment.

For gated deployment, disable App Platform's source Autodeploy and add these GitHub repository secrets under **Settings → Secrets and variables → Actions**:

| Secret | Purpose |
|---|---|
| `DO_API_TOKEN` | DigitalOcean personal access token |
| `DO_APP_ID` | App Platform application ID |

`DO_API_APP_ID` is also accepted as a backward-compatible alternative to `DO_APP_ID`. If these secrets are absent, the workflow completes verification and skips its explicit deploy step; DigitalOcean source Autodeploy may remain enabled instead.

The badges at the top of this README become active after the workflow files are committed, pushed to `main`, and their first GitHub Actions runs complete.

## API overview

| Endpoint | Methods | Purpose |
|---|---|---|
| `/api/health` | GET | Health check |
| `/api/listings` | GET, POST | Browse and create listings |
| `/api/listings/<id>` | GET, PUT | View or update a listing |
| `/api/auth/register` | POST | Register and send a verification code |
| `/api/auth/verify-email` | POST | Verify a six-digit code |
| `/api/auth/resend-verification` | POST | Send a replacement code |
| `/api/auth/login` | POST | Log in a verified user |
| `/api/users/<id>` | GET, PUT | Read or update a profile |
| `/api/favorites` | GET, POST, DELETE | Manage saved listings |
| `/api/threads` | GET, POST | Manage conversations |
| `/api/messages` | GET, POST | Read and send messages |
| `/api/messages/upload` | POST | Upload an image for a message |

## Project structure

```text
.
├── .github/workflows/       GitHub Actions CI/CD
├── Dockerfile               Production single-container build
├── docker-compose.yml       Local three-service environment
├── services/
│   ├── api/                 Flask API, email service, tests, static output
│   ├── mongo/               Local MongoDB image and seed data
│   └── web/                 React and Vite frontend
└── .env.example             Local configuration template
```

## Known production limitations

This remains a demo project, not a production-hardened marketplace:

- Passwords are currently stored without a password-hashing migration.
- API authorization is not enforced consistently on all user-owned resources.
- Authentication and presence state are held in process memory.
- Uploaded images use the container filesystem and can disappear after a redeploy; use Spaces or another object store for persistence.
- Messaging uses HTTP refreshes rather than WebSockets.
- CSRF protection and rate limiting are not yet implemented.

Use one application container until authentication and presence state move to shared persistent storage.

## License

GNU General Public License v3.0. See [LICENSE](LICENSE).
