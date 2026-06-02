# PathoScan AI — Documentation Index

Complete guide to all available documentation. Start here to find what you need.

---

## 🚀 Getting Started (5-10 minutes)

| Document | Purpose | Best For |
|----------|---------|----------|
| **[QUICK_START.md](QUICK_START.md)** | Docker Compose setup in 5 minutes | New developers, first-time setup |
| **[INSTALLATION.md](INSTALLATION.md)** | Detailed local & Docker setup with troubleshooting | Detailed setup instructions, specific OS |

---

## 👨‍💻 For Developers

| Document | Purpose | Best For |
|----------|---------|----------|
| **[DEVELOPMENT.md](DEVELOPMENT.md)** | Code structure, conventions, adding features | Writing code, extending features |
| **[ML_MODELS.md](ML_MODELS.md)** | ML pipeline, training, inference, Grad-CAM | Understanding AI/ML components |
| **[RAG_CHATBOT.md](RAG_CHATBOT.md)** | RAG system, vector search, LLM integration | Chatbot functionality, knowledge base |
| **[DATABASE.md](DATABASE.md)** | Schema, SQL queries, migrations | Database structure, writing queries |
| **[API_ENDPOINTS.md](API_ENDPOINTS.md)** | All REST endpoints with examples | API integration, testing endpoints |

---

## 🔧 For Operations & DevOps

| Document | Purpose | Best For |
|----------|---------|----------|
| **[DEPLOYMENT.md](DEPLOYMENT.md)** | Production setup, Docker Compose, monitoring | Deploying to production, scaling |
| **[SECURITY.md](SECURITY.md)** | Security best practices, compliance, hardening | Security reviews, medical compliance |
| **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** | Common problems and solutions | Debugging, fixing issues |

---

## 📖 Reference

| Document | Purpose | Best For |
|----------|---------|----------|
| **[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)** | Complete technical reference | Comprehensive overview, architecture |

---

## Quick Navigation

### By Task

**"I want to..."**

- **...get the app running locally**
  → Start with [QUICK_START.md](QUICK_START.md) (5 min) or [INSTALLATION.md](INSTALLATION.md) (detailed)

- **...understand the codebase**
  → Read [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) then [DEVELOPMENT.md](DEVELOPMENT.md)

- **...add a new feature**
  → [DEVELOPMENT.md](DEVELOPMENT.md) → [API_ENDPOINTS.md](API_ENDPOINTS.md) → [DATABASE.md](DATABASE.md)

- **...fix a bug**
  → [TROUBLESHOOTING.md](TROUBLESHOOTING.md) or [DEVELOPMENT.md](DEVELOPMENT.md)

- **...deploy to production**
  → [DEPLOYMENT.md](DEPLOYMENT.md) → [SECURITY.md](SECURITY.md)

- **...understand how models work**
  → [ML_MODELS.md](ML_MODELS.md)

- **...understand the chatbot**
  → [RAG_CHATBOT.md](RAG_CHATBOT.md)

- **...integrate with the API**
  → [API_ENDPOINTS.md](API_ENDPOINTS.md)

- **...understand the database**
  → [DATABASE.md](DATABASE.md)

---

## Document Overview

### QUICK_START.md (5 min read)
**Purpose:** Get PathoScan running in 5 minutes with Docker Compose

**Contents:**
- Prerequisites check
- Clone and configure
- Start services
- Access the app
- Test it
- Troubleshooting quick fixes

**When to use:** First time running the project

---

### INSTALLATION.md (15 min read)
**Purpose:** Detailed installation instructions for multiple setups

**Contents:**
- System requirements
- Local development setup (Python, Node, MySQL)
- Docker Compose setup (step-by-step)
- Verification tests
- Troubleshooting per OS

**When to use:** Detailed setup help, specific OS issues

---

### DEVELOPMENT.md (20 min read)
**Purpose:** Guide for developers working on the codebase

**Contents:**
- Local development setup
- Project structure
- Code conventions (Python, React)
- Adding new scan types
- Testing
- Debugging tips
- Git workflow
- Common issues

**When to use:** Writing code, extending features, understanding conventions

---

### ML_MODELS.md (20 min read)
**Purpose:** Complete guide to ML models and inference

**Contents:**
- Model architectures (ResNet, DenseNet)
- Image preprocessing pipeline
- Inference pipeline
- Grad-CAM heatmap algorithm
- Model performance metrics
- Model file management
- Troubleshooting

**When to use:** Understanding AI components, training, inference optimization

---

### RAG_CHATBOT.md (20 min read)
**Purpose:** Complete guide to RAG chatbot system

**Contents:**
- Architecture overview
- Knowledge base ingestion
- Retrieval strategy (MMR)
- Question condensation
- Prompt templates
- Streaming responses
- Session memory
- Configuration
- Error handling

**When to use:** Understanding chatbot, adding knowledge, customizing responses

---

### DATABASE.md (20 min read)
**Purpose:** Database schema and reference

**Contents:**
- Entity-relationship diagram
- All 6 tables (users, patients, scans, scan_results, chat_sessions, chat_messages)
- Column definitions
- Relationships and constraints
- Example queries
- Backup and recovery
- Performance optimization
- Migration guide

**When to use:** Understanding data model, writing queries, schema changes

---

### API_ENDPOINTS.md (15 min read)
**Purpose:** Complete REST API reference

**Contents:**
- Base URL and authentication
- Health endpoints
- Auth endpoints (register, login)
- Analysis endpoints (upload, history, stats)
- Patient management endpoints
- Chat endpoints (streaming, sessions)
- Error responses
- Rate limiting
- Testing examples (curl, Postman)

**When to use:** API integration, testing endpoints, understanding contracts

---

### DEPLOYMENT.md (25 min read)
**Purpose:** Production deployment guide

**Contents:**
- Architecture overview
- Prerequisites
- Server setup (Linux, Docker)
- Environment configuration
- Docker Compose setup
- HTTPS and reverse proxy
- Backup and recovery
- Monitoring and logging
- Updates and maintenance
- Troubleshooting
- Performance tuning
- Production checklist

**When to use:** Deploying to production, scaling, monitoring

---

### SECURITY.md (25 min read)
**Purpose:** Security best practices and hardening

**Contents:**
- Medical compliance notes (HIPAA, GDPR)
- Authentication and authorization
- Password security
- Data protection (encryption at rest/transit, PII)
- API security (CORS, rate limiting, input validation)
- Secrets management
- Infrastructure security
- Monitoring and audit logging
- Dependency security
- Medical-specific security
- Incident response

**When to use:** Security review, compliance, hardening application

---

### TROUBLESHOOTING.md (20 min read)
**Purpose:** Common problems and solutions

**Contents:**
- Quick diagnosis checklist
- Installation & startup issues
- API & backend issues
- Frontend issues
- Database issues
- Performance issues
- Monitoring & logs
- Incident response

**When to use:** Debugging, error messages, performance issues

---

### PROJECT_DOCUMENTATION.md (Reference)
**Purpose:** Comprehensive technical reference

**Contents:**
- Full project overview
- Complete system architecture
- Technology stack
- Full database schema
- Backend module breakdown
- ML pipeline details
- RAG system details
- Frontend pages and components
- API reference
- Authentication & security
- Docker deployment
- Environment variables
- User flows
- Known limitations and future work

**When to use:** Complete technical reference, architecture review

---

## Learning Path

### For New Team Members (1 hour)

1. **[QUICK_START.md](QUICK_START.md)** (5 min) — Get app running
2. **[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)** (20 min) — Understand architecture
3. **[DEVELOPMENT.md](DEVELOPMENT.md)** (20 min) — Code structure and conventions
4. Explore codebase with understanding of structure

### For ML/AI Focus (2 hours)

1. **[QUICK_START.md](QUICK_START.md)** (5 min) — Get app running
2. **[ML_MODELS.md](ML_MODELS.md)** (20 min) — Model architectures and inference
3. **[RAG_CHATBOT.md](RAG_CHATBOT.md)** (20 min) — Chatbot system
4. **[DEVELOPMENT.md](DEVELOPMENT.md)** (20 min) — How to extend
5. Read source: `backend/services/analyzer.py`, `backend/rag/`

### For Backend/API Focus (1.5 hours)

1. **[QUICK_START.md](QUICK_START.md)** (5 min) — Get app running
2. **[API_ENDPOINTS.md](API_ENDPOINTS.md)** (15 min) — API reference
3. **[DATABASE.md](DATABASE.md)** (20 min) — Data model
4. **[DEVELOPMENT.md](DEVELOPMENT.md)** (20 min) — Code structure
5. Read source: `backend/api.py`, `backend/analyze.py`, `backend/chat.py`

### For DevOps/Ops Focus (1.5 hours)

1. **[DEPLOYMENT.md](DEPLOYMENT.md)** (25 min) — Production setup
2. **[SECURITY.md](SECURITY.md)** (25 min) — Security hardening
3. **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** (20 min) — Common issues
4. Review: `docker-compose.yml`, `.env.example`

---

## Documentation Maintenance

### How to Update Docs

1. **Code Changes**: Update corresponding `.md` file
2. **New Features**: Add to relevant doc (e.g., new endpoint → API_ENDPOINTS.md)
3. **Bugs Fixed**: Add to TROUBLESHOOTING.md if recurring
4. **Architecture Changes**: Update PROJECT_DOCUMENTATION.md and related docs

### Version Control

- Docs live in git alongside code
- Update docs in same PR as code changes
- Use git history to track documentation evolution

---

## Quick Reference

### File Locations

```
project-root/
├── QUICK_START.md                 ← Start here (5 min)
├── INSTALLATION.md
├── DEVELOPMENT.md
├── ML_MODELS.md
├── RAG_CHATBOT.md
├── DATABASE.md
├── API_ENDPOINTS.md
├── DEPLOYMENT.md
├── SECURITY.md
├── TROUBLESHOOTING.md
├── PROJECT_DOCUMENTATION.md       ← Complete reference
├── DOCUMENTATION_INDEX.md         ← You are here
├── backend/
│   ├── api.py
│   ├── analyze.py
│   ├── chat.py
│   ├── database.py
│   ├── rag/
│   │   ├── agent.py
│   │   ├── ingest.py
│   │   └── services/
│   └── services/
│       └── analyzer.py
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   ├── pages/
│   │   └── components/
│   └── package.json
├── docker-compose.yml
├── .env.example
└── README.md
```

### Key Commands

```bash
# Setup
docker-compose up --build -d

# View logs
docker-compose logs -f backend

# Database access
docker-compose exec db mysql -u user -p pathoscan

# Run tests
docker-compose exec backend pytest

# Backend shell
docker-compose exec backend bash

# Stop
docker-compose down
```

---

## Support

- 📖 Read relevant documentation for your task
- 🔍 Use documentation index (this file) to find what you need
- 🐛 Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues
- 💬 Ask team members for context not in docs
- 📝 Update docs when you learn something new

---

## Document Statistics

| Document | Lines | Reading Time |
|----------|-------|--------------|
| QUICK_START.md | ~150 | 5 min |
| INSTALLATION.md | ~350 | 15 min |
| DEVELOPMENT.md | ~450 | 20 min |
| ML_MODELS.md | ~400 | 20 min |
| RAG_CHATBOT.md | ~400 | 20 min |
| DATABASE.md | ~450 | 20 min |
| API_ENDPOINTS.md | ~450 | 15 min |
| DEPLOYMENT.md | ~500 | 25 min |
| SECURITY.md | ~450 | 25 min |
| TROUBLESHOOTING.md | ~400 | 20 min |
| PROJECT_DOCUMENTATION.md | ~730 | Reference |
| **TOTAL** | **~4,930** | **~185 min** |

---

Last Updated: May 2024
Version: 1.0 Documentation Suite

🎉 You now have comprehensive documentation for PathoScan AI!
