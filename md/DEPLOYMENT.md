# PathoScan AI — Deployment Guide

This guide covers deploying PathoScan AI to production using Docker Compose.

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│           Production Environment                     │
│                                                      │
│  ┌──────────┐      ┌──────────┐     ┌───────────┐  │
│  │  Nginx   │ ──▶  │ FastAPI  │ ──▶ │  MySQL    │  │
│  │ Port 80  │      │ Port 8000│     │ Port 3306 │  │
│  └──────────┘      └──────────┘     └───────────┘  │
│                           │                          │
│                           ├──▶ TensorFlow Models     │
│                           ├──▶ Groq API (cloud)      │
│                           └──▶ ChromaDB (local)      │
│                                                      │
│  Volumes:                                            │
│  - db_data → MySQL persistence                       │
│  - vectorstore → Chroma vector DB                    │
│  - hf_cache → HuggingFace embeddings                │
└─────────────────────────────────────────────────────┘
```

## Prerequisites

- **Server**: Linux (Ubuntu 20.04+) or Docker Desktop
- **Docker**: v20.10+
- **Docker Compose**: v1.29+
- **Disk Space**: 20 GB minimum (for models, DB, vectorstore)
- **RAM**: 8 GB minimum (4 GB for backend, 2 GB for DB, 2 GB for OS)
- **Network**: HTTPS-capable domain (for production)

## 1. Prepare Server

### On Linux Server

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version

# Add user to docker group (avoid sudo)
sudo usermod -aG docker $USER
newgrp docker
```

## 2. Clone Repository

```bash
# Clone to production directory
cd /opt
git clone <repo-url> pathoscan-ai
cd pathoscan-ai

# Use specific version tag (optional but recommended)
git checkout v1.0.0  # Replace with actual version
```

## 3. Configure Environment

Create `.env` file with production values:

```bash
# Copy template
cp .env.example .env

# Edit with your values
nano .env
```

### Complete .env Configuration

```env
# ============================================
# DATABASE CONFIGURATION
# ============================================
DB_USER=pathoscan_prod
DB_PASSWORD=your_very_strong_password_here_32_chars_min
DB_ROOT_PASSWORD=your_root_password_32_chars_min
DB_HOST=db
DB_PORT=3306
DB_NAME=pathoscan

# ============================================
# JWT & AUTHENTICATION
# ============================================
# Generate with: openssl rand -hex 32
SECRET_KEY=your_64_char_hex_key_from_openssl_command_here

# Token expiry in hours
TOKEN_EXPIRE_HOURS=24

# ============================================
# GROQ API (LLM for Chatbot)
# ============================================
# Get from: https://console.groq.com
GROQ_API_KEY=gsk_your_production_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile

# ============================================
# CORS & SECURITY
# ============================================
# Comma-separated list of allowed origins
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# ============================================
# RATE LIMITING
# ============================================
RATE_LIMIT_ANALYZE=10/minute
RATE_LIMIT_LOGIN=5/minute
RATE_LIMIT_REGISTER=3/minute
RATE_LIMIT_CHAT=20/minute

# ============================================
# LOGGING & DEBUG
# ============================================
LOG_LEVEL=INFO  # Use WARNING in production
DEBUG=False
```

### Generate Secure Keys

```bash
# Generate SECRET_KEY
openssl rand -hex 32

# Generate strong password (32 chars)
openssl rand -base64 32
```

**Store these securely** (e.g., in a secrets management system):
- `.env` file should NOT be committed to git
- Use `.env.example` as template with placeholder values
- Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.) in production

## 4. Configure Docker Compose

Edit `docker-compose.yml` for production:

```yaml
version: '3.8'

services:
  db:
    image: mysql:8.0
    container_name: pathoscan-db
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MYSQL_DATABASE: ${DB_NAME}
      MYSQL_USER: ${DB_USER}
      MYSQL_PASSWORD: ${DB_PASSWORD}
    ports:
      - "3306:3306"
    volumes:
      - db_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - pathoscan-network

  backend:
    build: ./backend
    container_name: pathoscan-backend
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: mysql+pymysql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}
      SECRET_KEY: ${SECRET_KEY}
      GROQ_API_KEY: ${GROQ_API_KEY}
      GROQ_MODEL: ${GROQ_MODEL}
      TOKEN_EXPIRE_HOURS: ${TOKEN_EXPIRE_HOURS}
      ALLOWED_ORIGINS: ${ALLOWED_ORIGINS}
      LOG_LEVEL: ${LOG_LEVEL:-INFO}
    ports:
      - "8000:8000"
    volumes:
      - ./backend/rag/vectorstore:/app/rag/vectorstore
      - hf_cache:/root/.cache/huggingface
    restart: unless-stopped
    networks:
      - pathoscan-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build: ./frontend
    container_name: pathoscan-frontend
    depends_on:
      - backend
    ports:
      - "80:80"
    restart: unless-stopped
    networks:
      - pathoscan-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  db_data:
    driver: local
  hf_cache:
    driver: local

networks:
  pathoscan-network:
    driver: bridge
```

## 5. Deploy with Docker Compose

### Initial Deployment

```bash
# Build all images
docker compose build

# Start services
docker compose up -d

# Check service health
docker compose ps
docker compose logs -f

# Wait for all services to be ready (~60 seconds)
sleep 60

# Verify endpoints
curl http://localhost/                    # Frontend
curl http://localhost:8000/               # Backend health
curl http://localhost:8000/docs           # API Swagger docs
```

### Load Knowledge Base

```bash
# Place PDFs and CSVs in backend/rag/documents/
# Then ingest:
docker compose exec backend python -m rag.ingest

# Monitor progress
docker compose logs -f backend
```

### Verify Deployment

```bash
# Test API endpoints
curl http://localhost:8000/

# Test database
docker compose exec db mysql -u${DB_USER} -p${DB_PASSWORD} ${DB_NAME} -e "SELECT COUNT(*) FROM users;"

# Test Groq API connectivity
curl http://localhost:8000/api/test-ai
```

## 6. HTTPS & Reverse Proxy (Recommended)

For production, use Nginx with Let's Encrypt SSL:

### Option A: Nginx + Let's Encrypt (Docker)

Create `nginx/Dockerfile`:
```dockerfile
FROM nginx:alpine
RUN apk add --no-cache certbot certbot-nginx
COPY nginx.conf /etc/nginx/nginx.conf
```

Create `nginx/nginx.conf`:
```nginx
upstream backend {
  server backend:8000;
}

server {
  listen 80;
  listen 443 ssl;
  server_name yourdomain.com www.yourdomain.com;

  ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

  # Redirect HTTP to HTTPS
  if ($scheme != "https") {
    return 301 https://$server_name$request_uri;
  }

  # Frontend static files
  location / {
    root /usr/share/nginx/html;
    try_files $uri $uri/ /index.html;
  }

  # Backend API proxy
  location /api {
    proxy_pass http://backend;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # For Server-Sent Events (chat streaming)
    proxy_buffering off;
    proxy_cache off;
  }
}
```

### Option B: Certbot Standalone

```bash
# Get certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Mount in docker-compose.yml:
volumes:
  - /etc/letsencrypt:/etc/letsencrypt:ro
```

## 7. Backup & Recovery

### Database Backups

```bash
# Backup MySQL
docker compose exec db mysqldump -u${DB_USER} -p${DB_PASSWORD} ${DB_NAME} > backup_$(date +%Y%m%d).sql

# Restore from backup
cat backup_20240516.sql | docker compose exec -T db mysql -u${DB_USER} -p${DB_PASSWORD} ${DB_NAME}

# Schedule daily backups with cron
0 2 * * * cd /opt/pathoscan-ai && docker compose exec db mysqldump -u${DB_USER} -p${DB_PASSWORD} ${DB_NAME} > /backups/pathoscan_$(date +\%Y\%m\%d).sql
```

### Vectorstore Backups

```bash
# Backup Chroma vectorstore
tar -czf backup_vectorstore_$(date +%Y%m%d).tar.gz backend/rag/vectorstore/

# Restore
tar -xzf backup_vectorstore_20240516.tar.gz
```

## 8. Monitoring & Logging

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f db

# Last N lines
docker compose logs --tail=100 backend

# With timestamps
docker compose logs -f --timestamps backend
```

### Monitor Resources

```bash
# Real-time stats
docker stats

# Specific container
docker stats pathoscan-backend
```

### Set Up Log Rotation

Edit `.env`:
```env
LOG_LEVEL=INFO
```

Configure logrotate:
```bash
# /etc/logrotate.d/pathoscan
/var/lib/docker/containers/*/*.log {
  rotate 7
  daily
  compress
  delaycompress
  missingok
}
```

## 9. Updates & Maintenance

### Update Application

```bash
# Pull latest code
git pull origin main

# Rebuild images
docker compose build

# Restart services (zero-downtime with health checks)
docker compose up -d --no-deps --build backend frontend

# Verify
docker compose ps
docker compose logs -f
```

### Database Migrations

```bash
# Apply migrations (if using Alembic)
docker compose exec backend alembic upgrade head

# Or manually
docker compose exec db mysql -u${DB_USER} -p${DB_PASSWORD} ${DB_NAME} < migration.sql
```

### Upgrade Dependencies

```bash
# Update Python packages
docker compose exec backend pip install --upgrade -r requirements.txt

# Update Node packages
docker compose exec frontend npm update

# Rebuild
docker compose build
docker compose up -d
```

## 10. Troubleshooting Deployment

### Container Crashes

```bash
# Check logs
docker compose logs backend

# Common issues:
# 1. Database not ready → Add longer startup delay
# 2. Out of memory → Increase Docker memory allocation
# 3. Port already in use → Change port in docker-compose.yml
```

### Database Connection Errors

```bash
# Verify MySQL is running and healthy
docker compose ps db

# Check connectivity from backend
docker compose exec backend mysql -h db -u ${DB_USER} -p${DB_PASSWORD} -e "SELECT 1;"

# Check if tables exist
docker compose exec db mysql -u${DB_USER} -p${DB_PASSWORD} ${DB_NAME} -e "SHOW TABLES;"
```

### API Not Responding

```bash
# Check if backend is running
curl -v http://localhost:8000/

# Check backend logs
docker compose logs -f backend

# Verify Groq API key
docker compose exec backend python -c "import os; print('KEY:', os.getenv('GROQ_API_KEY'))"
```

### High Memory Usage

```bash
# Check container memory
docker stats

# Reduce batch size in config.py
# Or allocate more RAM in Docker settings

# Restart to free memory
docker compose restart backend
```

## 11. Performance Tuning

### Database

```ini
# Add to docker-compose.yml environment:
MYSQL_INITDB_ARGS=--max_connections=500 --innodb_buffer_pool_size=2G
```

### Backend

```python
# In backend/config.py:
NUM_WORKERS=4
BATCH_SIZE=8
MODEL_CACHE_SIZE=3  # Cache last N models in memory
```

### Frontend

```bash
# In frontend/.env:
REACT_APP_API_TIMEOUT=30000  # 30 seconds
```

## 12. Production Checklist

- [ ] `.env` file configured with strong passwords
- [ ] `SECRET_KEY` generated and stored securely
- [ ] `GROQ_API_KEY` valid and rate limits adequate
- [ ] `ALLOWED_ORIGINS` configured for your domain
- [ ] HTTPS enabled with valid certificate
- [ ] Daily backups configured (MySQL + vectorstore)
- [ ] Health checks passing (`docker compose ps`)
- [ ] Logs monitored (disk space adequate)
- [ ] Firewall configured (ports 80/443 only exposed)
- [ ] Database user has limited permissions (not root)
- [ ] Rate limiting thresholds appropriate for traffic
- [ ] Monitoring/alerting set up (optional)
- [ ] Disaster recovery plan documented

## Support

- 📖 See **[QUICK_START.md](QUICK_START.md)** for local setup
- 🐛 See **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** for common issues
- 🔒 See **[SECURITY.md](SECURITY.md)** for security hardening
- 📚 See **[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)** for detailed reference
