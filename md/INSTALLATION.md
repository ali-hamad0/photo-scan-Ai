# PathoScan AI — Installation Guide

Complete step-by-step instructions for setting up PathoScan AI locally and in production.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Local Development Setup](#local-development-setup)
3. [Docker Compose Setup](#docker-compose-setup)
4. [Verify Installation](#verify-installation)
5. [Troubleshooting](#troubleshooting)

---

## System Requirements

### Minimum Requirements

| Component | Minimum | Recommended |
|-----------|---------|------------|
| **CPU** | 2 cores | 4 cores |
| **RAM** | 4 GB | 8 GB |
| **Disk** | 10 GB | 20 GB |
| **Network** | 1 Mbps | 10 Mbps |

### Supported Operating Systems

- **Linux**: Ubuntu 20.04+, CentOS 8+, Debian 11+
- **macOS**: 11.0+ (Intel or Apple Silicon)
- **Windows**: 10 Pro, 11 Pro (with WSL 2 or Docker Desktop)

### Required Software

```bash
# Check your versions
python --version        # Need: 3.9+
node --version          # Need: 16+
docker --version        # Need: 20.10+
docker-compose --version # Need: 1.29+
```

---

## Local Development Setup

### Prerequisites

```bash
# Install Python (if not present)
# Ubuntu/Debian:
sudo apt-get update && sudo apt-get install python3.9 python3.9-venv

# macOS:
brew install python@3.9

# Windows:
# Download from https://www.python.org/downloads/
```

```bash
# Install Node.js (if not present)
# Ubuntu/Debian:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install nodejs

# macOS:
brew install node@18

# Windows:
# Download from https://nodejs.org/
```

```bash
# Install MySQL 8.0 (if not present)
# Ubuntu/Debian:
sudo apt-get install mysql-server mysql-client

# macOS:
brew install mysql

# Windows:
# Download from https://dev.mysql.com/downloads/mysql/
```

### Backend Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# Linux/macOS:
source venv/bin/activate

# Windows:
venv\Scripts\activate

# Upgrade pip
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
# Database
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/pathoscan_dev

# JWT
SECRET_KEY=$(openssl rand -hex 32)
TOKEN_EXPIRE_HOURS=24

# Groq API
GROQ_API_KEY=gsk_your_api_key_here

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000

# Server
LOG_LEVEL=DEBUG
EOF

# Start MySQL (if installed locally)
# Ubuntu/Linux:
sudo systemctl start mysql

# macOS:
brew services start mysql

# Windows:
# Start from Services app or: mysql -u root

# Create database
mysql -u root << EOF
CREATE DATABASE IF NOT EXISTS pathoscan_dev;
CREATE USER 'pathoscan'@'localhost' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON pathoscan_dev.* TO 'pathoscan'@'localhost';
FLUSH PRIVILEGES;
EOF

# Run backend
uvicorn api:app --reload --port 8000
```

Backend is ready at **http://localhost:8000**

API docs: **http://localhost:8000/docs**

### Frontend Setup

```bash
# Open new terminal, navigate to frontend
cd frontend

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
REACT_APP_API_URL=http://localhost:8000
EOF

# Start development server
npm start
```

Frontend is ready at **http://localhost:3000**

### Test the Setup

```bash
# In a new terminal, test API
curl http://localhost:8000/

# Test frontend
curl http://localhost:3000/

# Test database connection
mysql -u pathoscan -p -h 127.0.0.1 pathoscan_dev -e "SELECT 1;"
```

---

## Docker Compose Setup

### Prerequisites

**Install Docker:**

```bash
# Ubuntu/Debian:
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# macOS:
# Download Docker Desktop: https://www.docker.com/products/docker-desktop

# Windows:
# Download Docker Desktop: https://www.docker.com/products/docker-desktop
```

**Install Docker Compose:**

```bash
# Ubuntu/Debian:
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# macOS/Windows:
# Already included with Docker Desktop
```

**Verify installation:**

```bash
docker --version
docker-compose --version
```

### Quick Setup (5 minutes)

```bash
# Clone repository
git clone <repo-url>
cd pathoscan-ai

# Copy configuration
cp .env.example .env

# Edit .env (change these):
# DB_PASSWORD=your_password
# SECRET_KEY=your_key
# GROQ_API_KEY=your_groq_key
nano .env

# Start all services
docker-compose up --build -d

# Wait for services (about 30 seconds)
sleep 30

# Check if everything started
docker-compose ps

# View logs
docker-compose logs -f
```

Access the application:
- **Frontend**: http://localhost/
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### Detailed Docker Setup

```bash
# 1. Clone and enter directory
git clone <repo-url>
cd pathoscan-ai

# 2. Copy environment template
cp .env.example .env

# 3. Generate secure keys
cat > keys.txt << EOF
SECRET_KEY=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -base64 16)
EOF

# 4. Edit .env with generated values
nano .env

# 5. Build images
docker-compose build

# 6. Start services in background
docker-compose up -d

# 7. Wait for database health check
docker-compose logs db | grep "ready for connections"

# 8. Load knowledge base (optional)
mkdir -p backend/rag/documents
# Place your PDFs/CSVs here
docker-compose exec backend python -m rag.ingest

# 9. Verify setup
docker-compose ps
docker-compose exec backend curl localhost:8000/
```

---

## Verify Installation

### Backend Verification

```bash
# Check if API is responding
curl http://localhost:8000/

# Check API documentation
curl http://localhost:8000/docs

# Test Groq API connection
curl http://localhost:8000/api/test-ai

# Register a test user
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Frontend Verification

```bash
# Check if frontend is responding
curl http://localhost/

# Check if it's a valid React app
curl http://localhost/ | grep -q "react-app" && echo "React app found"
```

### Database Verification

```bash
# (Docker setup)
docker-compose exec db mysql -u pathoscan -p$DB_PASSWORD pathoscan -e "SHOW TABLES;"

# (Local MySQL)
mysql -u pathoscan -p pathoscan_dev -e "SELECT COUNT(*) FROM users;"
```

### Full System Test

```bash
# 1. Create an account
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@test.com","password":"pass123"}' \
  | jq -r '.token')

# 2. Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"pass123"}'

# 3. Get stats
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/stats

# 4. All checks passed!
echo "✓ Installation successful!"
```

---

## Troubleshooting

### Python Version Issues

```bash
# Verify Python 3.9+
python3 --version

# If using Python 3.8, upgrade
sudo apt-get install python3.9
python3.9 -m venv venv
```

### MySQL Connection Failed

```bash
# Check if MySQL is running
mysql -u root -e "SELECT 1;"

# Restart MySQL
sudo systemctl restart mysql  # Linux
brew services restart mysql   # macOS

# Check credentials
mysql -u pathoscan -p pathoscan_dev -e "SELECT 1;"
```

### Port Already in Use

```bash
# Find process using port
lsof -i :8000  # Backend
lsof -i :3000  # Frontend
lsof -i :3306  # MySQL

# Kill process
kill -9 <PID>

# Or use different port in .env
uvicorn api:app --port 8001
```

### Docker Issues

```bash
# Restart Docker daemon
sudo systemctl restart docker  # Linux
# macOS/Windows: Restart Docker Desktop

# Rebuild from scratch
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d

# Check logs
docker-compose logs backend
docker-compose logs db
```

### Out of Memory

```bash
# Check available memory
free -h  # Linux
vm_stat  # macOS

# Reduce backend memory usage
# Edit docker-compose.yml:
services:
  backend:
    mem_limit: 2g

# Restart
docker-compose up -d
```

### API Not Responding

```bash
# Check if backend is running
docker-compose ps backend

# Check logs
docker-compose logs -f backend

# Try health check
curl -v http://localhost:8000/

# Restart backend
docker-compose restart backend
```

### Frontend Blank Page

```bash
# Check browser console (F12)
# Check frontend logs
docker-compose logs -f frontend

# Clear browser cache
# Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

# Rebuild frontend
docker-compose build frontend
docker-compose up -d frontend
```

### Groq API Key Invalid

```bash
# Verify key format (should start with "gsk_")
echo $GROQ_API_KEY

# Test API connection
curl -H "Authorization: Bearer gsk_your_key" \
  https://api.groq.com/openai/v1/models

# Get new key: https://console.groq.com
```

---

## Next Steps

After successful installation:

1. **Sign Up** → Create a test account
2. **Upload Scan** → Upload a test medical image
3. **Use Chat** → Talk to MedBot
4. **Read Documentation** → Check [QUICK_START.md](QUICK_START.md)
5. **Start Developing** → See [DEVELOPMENT.md](DEVELOPMENT.md)

---

## Getting Help

- 📖 **[QUICK_START.md](QUICK_START.md)** — 5-minute setup
- 🐛 **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** — Common issues
- 📚 **[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)** — Reference
- 🚀 **[DEPLOYMENT.md](DEPLOYMENT.md)** — Production setup
