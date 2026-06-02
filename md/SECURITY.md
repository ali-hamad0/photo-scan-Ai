# PathoScan AI — Security Guide

This document outlines security considerations, best practices, and controls for PathoScan AI.

## ⚠️ Medical Compliance Note

PathoScan AI is designed for **educational and research purposes**. If you intend to use it in clinical settings, ensure compliance with:

- **HIPAA** (Health Insurance Portability and Accountability Act) — US healthcare
- **GDPR** (General Data Protection Regulation) — EU/UK personal data
- **PIPEDA** (Personal Information Protection and Electronic Documents Act) — Canada
- **State/Regional medical record laws**

This application **currently does NOT** meet these standards without additional hardening.

---

## 1. Authentication & Authorization

### JWT (JSON Web Token) Security

**Current Implementation:**
- Algorithm: `HS256` (HMAC with SHA-256)
- Secret: `SECRET_KEY` environment variable (must be 64+ characters)
- Expiry: `TOKEN_EXPIRE_HOURS` (default 24 hours)

**Recommendations:**

✅ **DO:**
```env
# Generate strong secret
openssl rand -hex 32

# Use long expiry for lower refresh overhead
TOKEN_EXPIRE_HOURS=24

# Store securely in secrets manager
# Never commit .env to git
```

❌ **DON'T:**
```python
# DON'T hardcode secrets
SECRET_KEY = "my-secret-key-12345"

# DON'T use weak secrets
SECRET_KEY = "secret"

# DON'T log tokens
print(f"Token: {token}")
```

### Password Security

**Current:**
- Hashing: `bcrypt` with adaptive cost factor
- Salted: Yes (bcrypt handles this)
- Plain-text storage: No

**Recommendations:**
```python
# Enforce minimum password requirements
MIN_PASSWORD_LENGTH = 12
REQUIRE_UPPERCASE = True
REQUIRE_DIGITS = True
REQUIRE_SPECIAL = True

# Check against common passwords
import passwords_io  # or similar library
if password in common_passwords():
    raise HTTPException(detail="Password too common")
```

### Ownership Enforcement

All endpoints validate `user_id` from JWT before returning data:

```python
# ✅ GOOD: Filters by user_id
scans = db.query(Scan).filter(Scan.user_id == current_user["user_id"]).all()

# ❌ BAD: No user_id check
scans = db.query(Scan).all()
```

**Verify:**
```bash
# Try accessing another user's scan with your token
curl -H "Authorization: Bearer your_token" \
  http://localhost:8000/api/history/123

# Should return 403 if scan belongs to different user
```

---

## 2. Data Protection

### Encryption at Rest

**Current:** No encryption at rest

**Recommendations:**

For production medical data:
```bash
# Enable MySQL InnoDB encryption
ALTER INSTANCE ROTATE INNODB MASTER KEY;
SET GLOBAL innodb_encrypt_tables=ON;

# Or use Docker volume encryption
docker run \
  -v encrypted_volume:/data \
  -e ENCRYPTION_KEY=your_key \
  mysql
```

### Encryption in Transit

**Current:** HTTP (local dev only)

**Recommendations:**
```nginx
# HTTPS required (see DEPLOYMENT.md)
server {
  listen 443 ssl;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;
  ssl_prefer_server_ciphers on;
}
```

### Sensitive Data Handling

**PII (Personally Identifiable Information):**
- Patient names
- Patient ages
- Patient gender
- Clinical notes

**Do not:**
```python
# ❌ Log patient data
logger.info(f"Analyzing scan for {patient_name}")

# ❌ Store in plain text
patient_notes = "John Doe, diabetic"

# ❌ Expose in error messages
return {"error": f"Patient {name} not found"}
```

**Do:**
```python
# ✅ Redact from logs
logger.info("Analyzing scan for patient")

# ✅ Use hashed IDs
patient_hash = hashlib.sha256(patient_id.encode()).hexdigest()

# ✅ Generic error messages
return {"error": "Patient not found"}
```

### Image Storage

**Current:** Base64-encoded in database

**Issues:**
- Stores full heatmap image in DB
- Unencrypted
- No audit trail

**Recommendations:**
```python
# Move images to S3/object storage
import boto3
s3 = boto3.client('s3')
s3.put_object(
    Bucket='pathoscan-images',
    Key=f'heatmaps/{result_id}.jpg',
    Body=heatmap_bytes,
    ServerSideEncryption='AES256',
)

# Store only the S3 URL in DB
heatmap_url = f"s3://pathoscan-images/heatmaps/{result_id}.jpg"
```

---

## 3. API Security

### CORS (Cross-Origin Resource Sharing)

**Current:**
```env
ALLOWED_ORIGINS=http://localhost
```

**For Production:**
```env
# Only your domain
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# NOT:
ALLOWED_ORIGINS=*  # ❌ Insecure
```

**Verify:**
```bash
curl -H "Origin: http://evil.com" \
  -H "Access-Control-Request-Method: POST" \
  http://localhost:8000/api/analyze

# Should return 403 if origin not allowed
```

### Rate Limiting

**Current:**
```env
RATE_LIMIT_ANALYZE=10/minute
RATE_LIMIT_LOGIN=5/minute
RATE_LIMIT_REGISTER=3/minute
RATE_LIMIT_CHAT=20/minute
```

**Issues:**
- Per-IP only (not per-user)
- In-memory (lost on restart)
- Not suitable for distributed systems

**For Production:**
```python
# Use Redis-based rate limiting
from slowapi.util import get_remote_address
from slowapi import Limiter
from slowapi.stores.redis import RedisStore

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri="redis://localhost:6379"
)
```

### Input Validation

**Current:** Minimal validation

**Recommendations:**

```python
from pydantic import BaseModel, validator, Field

class AnalyzeRequest(BaseModel):
    scan_type: str = Field(..., regex="^(chest_xray|bone_xray|brain_mri)$")
    patient_name: str = Field(None, max_length=100)
    patient_age: int = Field(None, ge=0, le=120)
    
    @validator('scan_type')
    def validate_scan_type(cls, v):
        allowed = ["chest_xray", "bone_xray", "brain_mri"]
        if v not in allowed:
            raise ValueError(f"Invalid scan type: {v}")
        return v
```

### SQL Injection Prevention

**Current:** SQLAlchemy ORM (protected by default)

**Verify:** Never use string formatting for queries
```python
# ✅ GOOD: ORM query
user = db.query(User).filter(User.email == email).first()

# ❌ BAD: SQL string formatting
query = f"SELECT * FROM users WHERE email = '{email}'"
user = db.execute(query)
```

### NoSQL Injection (if using MongoDB in future)

```python
# ❌ BAD
db.scans.find({"patient_id": request.patient_id})

# ✅ GOOD
from bson import ObjectId
patient_id = ObjectId(request.patient_id)
db.scans.find({"patient_id": patient_id})
```

---

## 4. Secrets Management

### Sensitive Environment Variables

```env
# ✅ Must be set before deployment
SECRET_KEY=<generated-via-openssl>
GROQ_API_KEY=<from-console.groq.com>
DB_PASSWORD=<strong-password>
DB_ROOT_PASSWORD=<strong-password>

# ❌ Must NOT be in git
# Add to .gitignore:
.env
.env.local
.env.*.local
```

### Using Secrets Manager

**Option 1: AWS Secrets Manager**
```python
import json
import boto3

client = boto3.client('secretsmanager')
secret = client.get_secret_value(SecretId='pathoscan/prod')
credentials = json.loads(secret['SecretString'])

SECRET_KEY = credentials['secret_key']
GROQ_API_KEY = credentials['groq_api_key']
```

**Option 2: HashiCorp Vault**
```python
import hvac

client = hvac.Client(url='https://vault.example.com:8200')
secret = client.secrets.kv.read_secret_version(path='pathoscan/prod')

SECRET_KEY = secret['data']['data']['secret_key']
```

**Option 3: Docker Secrets**
```yaml
services:
  backend:
    secrets:
      - secret_key
      - groq_api_key

secrets:
  secret_key:
    external: true
  groq_api_key:
    external: true
```

---

## 5. Infrastructure Security

### Firewall Rules

```bash
# Allow SSH only from admin IPs
iptables -A INPUT -p tcp --dport 22 -s 203.0.113.0/24 -j ACCEPT
iptables -A INPUT -p tcp --dport 22 -j DROP

# Allow HTTP/HTTPS
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Block database port (3306) from internet
iptables -A INPUT -p tcp --dport 3306 -j DROP

# Block backend port (8000) from internet
iptables -A INPUT -p tcp --dport 8000 -j DROP
```

### Network Isolation

```yaml
# docker-compose.yml
networks:
  pathoscan-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.25.0.0/16

services:
  backend:
    networks:
      - pathoscan-network
  db:
    networks:
      - pathoscan-network
    # Don't expose port 3306 to host
    # ports:
    #   - "3306:3306"
```

### File Permissions

```bash
# Restrict .env file
chmod 600 .env
chown $USER:$USER .env

# Restrict model files
chmod 644 backend/models/*.h5
chown $USER:$USER backend/models/

# Restrict database data directory
chmod 750 db_data/
```

---

## 6. Monitoring & Logging

### Audit Logging

**Current:** No audit trail

**Recommendation:**
```python
class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.user_id"))
    action = Column(String(100))  # "upload_scan", "delete_scan", "login"
    resource_type = Column(String(50))  # "scan", "patient", "chat_session"
    resource_id = Column(Integer)
    changes = Column(JSON)  # What changed
    timestamp = Column(DateTime, default=datetime.utcnow)
    ip_address = Column(String(50))

# Log important actions
audit = AuditLog(
    user_id=current_user['user_id'],
    action='delete_scan',
    resource_type='scan',
    resource_id=result_id,
    changes={'prediction': 'Pneumonia', 'confidence': 87.3},
    ip_address=request.client.host,
)
db.add(audit)
db.commit()
```

### Secure Logging

**Don't log:**
```python
# ❌ Avoid logging sensitive data
logger.info(f"User {email} logged in with password {password}")
logger.error(f"Database error: {db_password}")
logger.debug(f"Token: {jwt_token}")
```

**Do log:**
```python
# ✅ Log security events without sensitive data
logger.warning(f"Failed login attempt for user {user_id}")
logger.info(f"User {user_id} deleted scan {scan_id}")
logger.error("Database connection failed")
```

### Monitoring Tools

```yaml
# docker-compose.yml — Add monitoring
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
  
  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
```

---

## 7. Dependency Security

### Python Packages

```bash
# Check for vulnerabilities
pip install safety
safety check

# Or use pip-audit
pip install pip-audit
pip-audit

# Keep dependencies updated
pip list --outdated
pip install --upgrade -r requirements.txt

# Pin versions in requirements.txt
tensorflow==2.13.0
fastapi==0.104.1
```

### Node Packages

```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Keep dependencies updated
npm outdated
npm update
```

### Scanning Container Images

```bash
# Scan Docker images for vulnerabilities
docker scan pathoscan-backend
docker scan pathoscan-frontend

# Or use Trivy
trivy image pathoscan-backend:latest
```

---

## 8. Medical-Specific Security

### Model Adversarial Robustness

**Risk:** Adversarial inputs could fool ML models

```python
# Add input validation before inference
def validate_image(image_bytes):
    # Check file format
    if not image_bytes.startswith(b'\xff\xd8\xff'):  # JPEG magic bytes
        raise ValueError("Invalid image format")
    
    # Check file size
    if len(image_bytes) > 10 * 1024 * 1024:  # 10 MB limit
        raise ValueError("Image too large")
    
    # Check image dimensions after loading
    img = Image.open(BytesIO(image_bytes))
    if img.size[0] < 100 or img.size[1] < 100:
        raise ValueError("Image too small")
```

### Diagnostic Disclaimers

**Always include:**
```python
MEDICAL_DISCLAIMER = """
⚠️ DISCLAIMER: This AI analysis is for educational purposes only.
It is NOT a substitute for professional medical evaluation.
Always consult a qualified physician for diagnosis and treatment.
"""
```

---

## 9. Security Checklist

### Before Development
- [ ] Review OWASP Top 10
- [ ] Set up `.gitignore` for sensitive files
- [ ] Use secrets manager for credentials

### Before Deployment
- [ ] Generate strong `SECRET_KEY`
- [ ] Verify all environment variables set securely
- [ ] Enable HTTPS/TLS
- [ ] Configure firewall rules
- [ ] Enable database encryption at rest
- [ ] Set up audit logging
- [ ] Configure rate limiting
- [ ] Review CORS settings
- [ ] Run dependency security scans
- [ ] Review error messages (no sensitive data)

### Ongoing
- [ ] Monitor logs for suspicious activity
- [ ] Keep dependencies updated
- [ ] Run regular penetration testing
- [ ] Review audit logs monthly
- [ ] Update security policies as threats evolve
- [ ] Conduct security training for team

---

## 10. Incident Response

### If a Secret is Exposed

```bash
# 1. Rotate immediately
openssl rand -hex 32 > new_secret.txt

# 2. Update application
# Edit docker-compose.yml or secrets manager

# 3. Restart services
docker compose restart backend

# 4. Review logs for unauthorized access
docker compose logs backend | grep "failed\|error\|unauthorized"

# 5. Notify users if data may be compromised
```

### If Database is Breached

```bash
# 1. Isolate immediately
docker compose down

# 2. Back up data for forensics
docker compose cp db:/var/lib/mysql backup/

# 3. Investigate logs
# Check: failed login attempts, unusual queries, exports

# 4. Restore from clean backup if needed
cat clean_backup.sql | docker compose exec -T db mysql -u root -p

# 5. Notify affected users
```

---

## Resources

- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **NIST Cybersecurity Framework**: https://www.nist.gov/cyberframework
- **HIPAA Security Rule**: https://www.hhs.gov/hipaa/for-professionals/security/index.html
- **GDPR Compliance**: https://gdpr-info.eu/
- **CWE Top 25**: https://cwe.mitre.org/top25/

## Questions?

- See **[DEVELOPMENT.md](DEVELOPMENT.md)** for code security
- See **[DEPLOYMENT.md](DEPLOYMENT.md)** for infrastructure security
- See **[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)** for architecture details
