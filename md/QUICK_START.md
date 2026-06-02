# PathoScan AI — Quick Start Guide

Get PathoScan AI running in **5 minutes** using Docker Compose.

## Prerequisites

- **Docker** and **Docker Compose** installed
- **Git** (to clone the repo)
- 4 GB RAM available
- Internet connection (for downloading images and Groq API)

## 1. Clone & Configure

```bash
git clone <repo-url>
cd ISD/Ai
cp .env.example .env
```

Edit `.env` with your credentials:
```env
# Database
DB_USER=pathoscan
DB_PASSWORD=your_secure_password
DB_ROOT_PASSWORD=your_root_password

# JWT Secret (generate with: openssl rand -hex 32)
SECRET_KEY=your_64_char_hex_key_here

# Groq API (get from console.groq.com)
GROQ_API_KEY=gsk_your_api_key_here

# CORS (for local development)
ALLOWED_ORIGINS=http://localhost
```

## 2. Start Services

```bash
# Build and start all containers
docker compose up --build -d

# Wait for database to be healthy (~30 seconds)
docker compose logs -f db
```

## 3. Load Knowledge Base (Optional)

```bash
# Place PDF/CSV files in backend/rag/documents/
# Then run:
docker compose exec backend python -m rag.ingest

# This loads medical documents into the vector store
```

## 4. Access the App

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost | Web UI |
| Backend | http://localhost:8000 | API |
| API Docs | http://localhost:8000/docs | Swagger UI |

## 5. Test It

1. **Sign Up** → Create an account
2. **Upload Scan** → Go to Chest X-Ray / Bone X-Ray / Brain MRI
3. **Analyze** → Upload an image and see AI diagnosis
4. **Chat** → Talk to MedBot about the scan

## Troubleshooting

### Containers won't start
```bash
# Check logs
docker compose logs backend
docker compose logs db

# Rebuild from scratch
docker compose down -v
docker compose up --build
```

### Database connection error
```bash
# Wait for MySQL to be ready
docker compose logs db | grep "ready for connections"
```

### Out of memory
```bash
# Increase Docker memory limit in Settings
# Or reduce batch size in backend/config.py
```

### Can't reach http://localhost
- Check if containers are running: `docker compose ps`
- On Windows: use `http://localhost` or `http://127.0.0.1`
- On Mac: use `http://localhost` or check Docker Desktop networking

## Next Steps

- 📖 Read **[DEVELOPMENT.md](DEVELOPMENT.md)** to understand the codebase
- 🚀 Read **[DEPLOYMENT.md](DEPLOYMENT.md)** for production setup
- 🔒 Read **[SECURITY.md](SECURITY.md)** for security considerations
- 📚 Read **[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)** for comprehensive reference

## Common Commands

```bash
# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Restart a service
docker compose restart backend

# Stop all services
docker compose down

# Remove all data (fresh start)
docker compose down -v

# Access backend shell
docker compose exec backend bash

# Access database
docker compose exec db mysql -u pathoscan -p
```
