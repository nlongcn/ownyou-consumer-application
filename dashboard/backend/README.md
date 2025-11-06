# Dashboard Backend API

Flask-based REST API for the IAB Taxonomy Profile Dashboard.

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Apply database migrations
python -m dashboard.backend.db.migrate

# Run development server
python dashboard/backend/run.py
```

The API will be available at `http://127.0.0.1:5000`

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with user_id
- `POST /api/auth/logout` - Logout
- `GET /api/auth/status` - Check authentication status
- `GET /api/auth/session` - Get session info

### Profile
- `GET /api/profile/summary` - Get profile summary with counts
- `GET /api/profile/classifications` - Get all classifications (optional ?section= filter)
- `GET /api/profile/sections` - Get all sections with classifications

### Analytics
- `GET /api/analytics/costs` - Get cost tracking records
- `GET /api/analytics/costs/total` - Get total cost summary
- `GET /api/analytics/runs` - Get analysis run history
- `GET /api/analytics/confidence/history` - Get confidence evolution history

## Configuration

Set environment variables in `.env`:

```bash
# Flask settings
FLASK_ENV=development
FLASK_DEBUG=True
FLASK_SECRET_KEY=your-secret-key

# CORS
CORS_ORIGINS=http://localhost:3000

# Database
MEMORY_DATABASE_PATH=data/email_parser_memory.db
```

## Testing

```bash
# Test authentication
curl -X POST http://127.0.0.1:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test_user"}' \
  -c cookies.txt

# Test profile summary
curl http://127.0.0.1:5000/api/profile/summary \
  -b cookies.txt

# Test classifications
curl http://127.0.0.1:5000/api/profile/classifications?section=interests \
  -b cookies.txt
```

## Architecture

```
dashboard/backend/
├── app.py              # Flask application factory
├── config.py           # Configuration
├── run.py              # Development server runner
├── api/                # API route handlers
│   ├── auth.py         # Authentication endpoints
│   ├── profile.py      # Profile endpoints
│   └── analytics.py    # Analytics endpoints
├── db/                 # Database layer
│   ├── migrate.py      # Migration script
│   ├── queries.py      # Query functions
│   └── schema_extensions.sql
└── utils/              # Utilities
    └── validators.py   # Request validators
```

## Security

- Session-based authentication with httpOnly cookies
- User-scoped data access (strict isolation)
- CORS protection
- Request validation and sanitization
- Environment-based configuration

## Development

```bash
# Install in development mode
pip install -e .

# Run with debug mode
FLASK_DEBUG=True python dashboard/backend/run.py

# View logs
tail -f logs/dashboard.log
```
