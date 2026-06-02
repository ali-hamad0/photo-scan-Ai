# PathoScan AI — Development Guide

This guide covers local development, code organization, and extending PathoScan AI.

## Local Development Setup

### Prerequisites

- **Python 3.9+** (for backend)
- **Node.js 16+** (for frontend)
- **MySQL 8.0** (or use Docker)
- **Git**

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
SECRET_KEY=$(openssl rand -hex 32)
GROQ_API_KEY=gsk_your_key_here
DATABASE_URL=mysql+pymysql://user:password@localhost:3306/pathoscan
ALLOWED_ORIGINS=http://localhost:3000
GROQ_MODEL=llama-3.3-70b-versatile
TOKEN_EXPIRE_HOURS=24
EOF

# Run server
uvicorn api:app --reload --port 8000
```

Server runs at **http://localhost:8000**
API docs available at **http://localhost:8000/docs**

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
REACT_APP_API_URL=http://localhost:8000
EOF

# Start dev server
npm start
```

Frontend runs at **http://localhost:3000**

## Project Structure

```
backend/
├── api.py                 # FastAPI app entry point
├── auth.py                # Authentication (register, login, JWT)
├── analyze.py             # Image analysis routes
├── chat.py                # Chat & streaming endpoints
├── database.py            # SQLAlchemy ORM models
├── config.py              # Configuration & env vars
├── scan_utils.py          # Scan type mapping utilities
├── services/
│   └── analyzer.py        # Image preprocessing, Grad-CAM, explanations
├── rag/                   # RAG chatbot system
│   ├── agent.py           # Public API: ask(), ask_stream()
│   ├── config.py          # Groq API configuration
│   ├── ingest.py          # Knowledge base ingestion CLI
│   ├── prompts.py         # LangChain prompt templates
│   └── services/
│       ├── chain.py       # RAG pipeline logic
│       ├── embeddings.py  # HuggingFace embeddings
│       ├── llm.py         # Groq LLM client
│       ├── memory.py      # Chat session memory
│       ├── retriever.py   # Chroma MMR retriever
│       └── vectorstore.py # ChromaDB singleton
├── models/                # ML model .h5 files
│   ├── chest_xray_model.h5
│   ├── bone_xray_model.h5
│   └── brain_mri_model.h5
└── requirements.txt       # Python dependencies

frontend/
├── src/
│   ├── App.js             # Main app with routing
│   ├── index.js           # Entry point
│   ├── pages/
│   │   ├── ScanPage.js    # Reusable scan upload (used by Chest/Bone/Brain)
│   │   ├── Dashboard.js   # Stats & overview
│   │   ├── History.js     # Paginated scan history
│   │   ├── Patients.js    # Patient management
│   │   ├── Chat.js        # AI chatbot interface
│   │   ├── Login.js       # Authentication
│   │   └── Signup.js
│   ├── components/
│   │   ├── Sidebar.js     # Navigation
│   │   ├── Navbar.js      # Top navigation
│   │   ├── ThemeToggle.js # Light/dark mode
│   │   └── ScanCard.js    # Card component
│   ├── utils/
│   │   └── generateReport.js  # PDF export
│   └── styles/
│       └── App.css        # Global styles
├── public/
│   └── index.html
└── package.json
```

## Code Conventions

### Backend (Python)

**Naming:**
- Functions: `snake_case` (e.g., `generate_gradcam()`)
- Classes: `PascalCase` (e.g., `ScanAnalyzer`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_FILE_SIZE`)
- Private methods: `_leading_underscore()`

**FastAPI Routes:**
```python
@router.post("/analyze")
async def analyze_scan(
    file: UploadFile,
    scan_type: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Analyze medical image and return diagnosis."""
    # Implementation
    pass
```

**Database Models (SQLAlchemy):**
```python
class Scan(Base):
    __tablename__ = "scans"
    
    scan_id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    scan_type = Column(String(50), nullable=False)  # xray, mri, ct, other
    # ...
```

**Error Handling:**
```python
from fastapi import HTTPException

if not file:
    raise HTTPException(status_code=400, detail="File is required")
```

### Frontend (React)

**Naming:**
- Components: `PascalCase` (e.g., `<ScanPage />`)
- Hooks: `snake_case` (e.g., `useAuthContext()`)
- Variables: `camelCase` (e.g., `uploadedFile`)

**Component Structure:**
```jsx
function MyComponent({ prop1, prop2 }) {
  const [state, setState] = useState(null);
  
  useEffect(() => {
    // Side effects
  }, [dependency]);
  
  return (
    <div className="my-component">
      {/* JSX */}
    </div>
  );
}

export default MyComponent;
```

**API Calls:**
```javascript
const response = await fetch(`${API_URL}/api/analyze`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  body: formData,
});
```

## Adding a New Scan Type

### 1. Train the Model
- Collect labeled medical images
- Train TensorFlow/Keras classifier
- Save as `.h5` file

### 2. Add Model Configuration

Edit `backend/analyze.py`:
```python
SCAN_CONFIG = {
    # ... existing types ...
    "ct_scan": {
        "classes": ["Class1", "Class2"],
        "binary": True,
        "threshold": 0.5
    }
}

MODEL_PREPROCESS = {
    # ... existing types ...
    "ct_scan": "resnet"  # or "densenet"
}
```

### 3. Update scan_utils.py

```python
def get_db_scan_type(app_type):
    mapping = {
        # ... existing ...
        "ct_scan": "ct",
    }
    return mapping.get(app_type, "other")

def infer_analysis_type(db_type, prediction, image_path):
    # Add logic to detect your new scan type
    if "glioma" in prediction.lower():
        return "brain_mri"
    # ... existing logic ...
```

### 4. Add Frontend Page

Create `frontend/src/pages/CTScan.js`:
```jsx
import ScanPage from './ScanPage';

function CTScan() {
  return (
    <ScanPage
      scanType="ct_scan"
      title="CT Scan"
      subtitle="Upload your CT scan"
      icon="🔬"
      color="#0066cc"
    />
  );
}

export default CTScan;
```

### 5. Add Route in App.js

```javascript
<Route path="/ct" element={<PrivateRoute><CTScan /></PrivateRoute>} />
```

## Testing

### Backend Tests

```bash
cd backend

# Run all tests
pytest

# Run specific test
pytest tests/test_analyze.py::test_upload_scan

# With coverage
pytest --cov=. tests/
```

**Test Example:**
```python
def test_user_can_analyze_chest_xray(client, auth_token):
    with open("tests/fixtures/chest_xray.jpg", "rb") as f:
        response = client.post(
            "/api/analyze",
            files={"file": f},
            data={"scan_type": "chest_xray"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
    assert response.status_code == 200
    assert "prediction" in response.json()
```

### Frontend Tests

```bash
cd frontend

# Run tests
npm test

# With coverage
npm test -- --coverage
```

## Debugging

### Backend Debugging

```python
# Add print statements
print(f"DEBUG: user_id={user_id}, scan_type={scan_type}")

# Or use pdb
import pdb; pdb.set_trace()

# View detailed logs
LOGLEVEL=DEBUG uvicorn api:app --reload
```

### Frontend Debugging

```javascript
// Browser console
console.log('State:', state);
console.error('Error:', error);

// React DevTools browser extension
// Redux DevTools (if using Redux)
```

### Database Debugging

```bash
# Connect to MySQL
docker compose exec db mysql -u pathoscan -p

# View tables
SHOW TABLES;
SELECT * FROM users LIMIT 5;

# Check indexes
SHOW INDEX FROM scans;
```

## Common Issues & Solutions

### Model Not Loading
```
Problem: "Model file not found"
Solution: Ensure .h5 files exist in backend/models/
          Check permissions: chmod +r backend/models/*.h5
```

### CORS Errors
```
Problem: "Access to XMLHttpRequest blocked by CORS"
Solution: Update ALLOWED_ORIGINS in .env
          Restart backend: docker compose restart backend
```

### Database Connection Failed
```
Problem: "Can't connect to MySQL server"
Solution: Check DB_PASSWORD in .env
          Restart MySQL: docker compose restart db
          Wait 30 seconds for startup
```

### Out of Memory on Model Load
```
Problem: TensorFlow model won't load
Solution: Reduce NUM_LOAD_THREADS in config.py
          Or allocate more Docker memory
```

### Chat Not Responding
```
Problem: "Groq API timeout"
Solution: Check GROQ_API_KEY is valid
          Check internet connection
          Verify IP isn't blocked: curl -I https://api.groq.com
```

## Performance Tips

### Optimize Image Preprocessing
```python
# Cache loaded models
@lru_cache(maxsize=1)
def get_model(model_name):
    return load_model(f"models/{model_name}.h5")
```

### Optimize Database Queries
```python
# Use indexed columns in WHERE clauses
# Add missing indexes for frequent queries
# Use eager loading for relationships
```

### Optimize Frontend
```bash
# Analyze bundle size
npm run build
npm install -g serve
serve -s build

# Check component render counts
npm install --save-dev why-did-you-render
```

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/add-new-scan-type

# Make changes
git add backend/analyze.py frontend/src/pages/NewScan.js

# Commit with clear message
git commit -m "feat: add CT scan support with ResNet50 model"

# Push to remote
git push origin feature/add-new-scan-type

# Create pull request on GitHub
```

**Commit Message Format:**
- `feat: add X` — new feature
- `fix: resolve X` — bug fix
- `refactor: improve X` — code quality
- `docs: update X` — documentation
- `test: add X` — tests
- `chore: update X` — dependencies, config

## Documentation

When making changes:
1. Update relevant `.md` files
2. Add docstrings to new functions
3. Update API docs (via FastAPI `/docs`)
4. Update this DEVELOPMENT.md with new conventions

## Getting Help

- 🔍 Check **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** for common issues
- 📚 Read **[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)** for detailed reference
- 🚀 See **[DEPLOYMENT.md](DEPLOYMENT.md)** for production questions
- 🔒 See **[SECURITY.md](SECURITY.md)** for security guidelines
