# Second-Hand-Marketplace
Campus-focused marketplace for NYU students to buy and sell second-hand items (textbooks, electronics, furniture, dorm essentials) with zero platform fees. Web app uses Flask backend, SQLite storage, and static HTML/CSS front-end; designed to later expand to mobile/WeChat Mini Program.

## Features
- User auth: register/login via email with hashed passwords and JWT tokens.
- Listings: create, browse, search, filter by category/community, view counts, image uploads.
- Favorites: save/unsave items, per-user favorites list.
- Messaging: buyer-seller threads, messages, unread counts.
- Reporting and reviews: submit reports, rate users with tags and comments.
- Stats: dashboard and category aggregates.
- Healthcheck endpoint for uptime monitoring.

## Tech Stack
- Backend: Python, Flask, flask-cors, SQLite.
- Auth: JWT (PyJWT) + SHA-256 password hashing.
- Data: SQLite schema defined in `modules/db.py`.
- Front-end assets: static HTML/CSS in `templates/` and `static/`.

## Setup
1) Python 3.9+ recommended; create and activate a virtualenv.  
2) Install dependencies:  
   `pip install -r requirements.txt`  
3) Initialize the local SQLite database with sample data:  
   `python modules/db.py`  
   (or run `python app.py` once to auto-create tables and insert samples in non-production).

## Run
`python app.py`  
- Defaults: host `0.0.0.0`, free port starting at 5000.  
- Env overrides: `FLASK_HOST`, `FLASK_PORT`, `FLASK_ENV=production` to disable debug/sample inserts.

## API Highlights
- Auth: `/api/auth/register`, `/api/auth/login`, `/api/auth/verify`
- Listings: `/api/listings` (GET/POST), `/api/listings/<id>`, `/api/listings/search`
- Favorites: `/api/favorites` (POST/DELETE), `/api/users/<user_id>/favorites`
- Messaging: `/api/threads`, `/api/threads/<user_id>`, `/api/messages`, `/api/threads/<thread_id>/messages`
- Reports/Reviews: `/api/reports`, `/api/reviews`, `/api/users/<user_id>/reviews`
- Stats/Health: `/api/stats/dashboard`, `/api/stats/categories`, `/api/health`

## Tests
- Framework: `pytest` (see `tests/`).  
- Run suite: `pytest -q`.  
- Tests use an isolated temp SQLite file per test via `tests/conftest.py`, so they do not touch `marketplace.db`.
