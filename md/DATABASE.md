# PathoScan AI — Database Schema & Reference

Complete database schema documentation, relationships, and SQL queries.

## Overview

PathoScan AI uses **MySQL 8.0** with a normalized relational schema. The database stores:
- User accounts and authentication
- Medical scan records and analysis results
- Patient demographic information
- Chat sessions and conversation history

---

## Entity Relationship Diagram

```
┌──────────┐         ┌──────────┐         ┌──────────────┐
│  users   │◄────────│  scans   │────────►│ scan_results │
└──────────┘         └──────────┘         └──────────────┘
     │                    │
     │                    ├──────┐
     │                           │
     │                    ┌──────────────┐
     │                    │  patients    │
     │                    └──────────────┘
     │
     ├──────┐
     │      │
┌─────────────────┐    ┌──────────────────┐
│ chat_sessions   │───►│ chat_messages    │
└─────────────────┘    └──────────────────┘
```

---

## Table: `users`

Stores user account information.

### Schema

```sql
CREATE TABLE users (
  user_id         INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  email           VARCHAR(100) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  role            ENUM('admin', 'doctor', 'user') DEFAULT 'user',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_email (email),
  INDEX idx_role (role)
);
```

### Columns

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `user_id` | INT | No | Primary key, auto-increment |
| `name` | VARCHAR(100) | No | User's display name |
| `email` | VARCHAR(100) | No | Unique email, used for login |
| `password_hash` | VARCHAR(255) | No | Bcrypt hash (never plain text) |
| `role` | ENUM | No | Admin / Doctor / User (enforcement not yet implemented) |
| `created_at` | TIMESTAMP | No | Account creation time (UTC) |
| `updated_at` | TIMESTAMP | No | Last modification time (UTC) |

### Example Queries

```sql
-- Create a new user
INSERT INTO users (name, email, password_hash, role)
VALUES ('Dr. Smith', 'smith@clinic.com', '$2b$12$...', 'doctor');

-- Find user by email
SELECT * FROM users WHERE email = 'smith@clinic.com';

-- Update user role
UPDATE users SET role = 'admin' WHERE user_id = 1;

-- Count users by role
SELECT role, COUNT(*) FROM users GROUP BY role;
```

---

## Table: `patients`

Stores patient demographic information linked to users.

### Schema

```sql
CREATE TABLE patients (
  patient_id      INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL,
  name            VARCHAR(100) NOT NULL,
  age             INT,
  gender          ENUM('male', 'female', 'other'),
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_name (name)
);
```

### Columns

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `patient_id` | INT | No | Primary key, auto-increment |
| `user_id` | INT | No | FK to users; becomes NULL if user deleted |
| `name` | VARCHAR(100) | No | Patient's name |
| `age` | INT | Yes | Patient's age (0-120) |
| `gender` | ENUM | Yes | male / female / other |
| `notes` | TEXT | Yes | Clinical notes (max 500 chars) |
| `created_at` | TIMESTAMP | No | Record creation time (UTC) |

### Example Queries

```sql
-- Create patient
INSERT INTO patients (user_id, name, age, gender, notes)
VALUES (1, 'John Doe', 45, 'male', 'Smoker');

-- Get all patients for a user
SELECT * FROM patients WHERE user_id = 1 ORDER BY name;

-- Count patients by gender
SELECT gender, COUNT(*) FROM patients GROUP BY gender;

-- Update patient info
UPDATE patients SET notes = 'Updated notes' WHERE patient_id = 5;
```

---

## Table: `scans`

Stores medical image scan metadata.

### Schema

```sql
CREATE TABLE scans (
  scan_id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL,
  patient_id      INT,
  scan_type       ENUM('xray', 'mri', 'ct', 'other') NOT NULL,
  image_path      TEXT NOT NULL,
  status          ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_patient_id (patient_id),
  INDEX idx_scan_type (scan_type),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);
```

### Columns

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `scan_id` | INT | No | Primary key, auto-increment |
| `user_id` | INT | No | FK to users; cascade delete |
| `patient_id` | INT | Yes | FK to patients; optional link |
| `scan_type` | ENUM | No | xray / mri / ct / other (generic modality) |
| `image_path` | TEXT | No | Original filename or S3 URL |
| `status` | ENUM | No | pending / completed / failed |
| `created_at` | TIMESTAMP | No | Upload time (UTC) |

### Important Notes

- **Generic modality types**: The database stores `xray`, `mri`, `ct`, `other` to represent image modalities
- **App-facing types**: The frontend expects specific scan types like `chest_xray`, `bone_xray`, `brain_mri`
- **Type inference**: The backend infers the specific app-facing type at query time using `scan_utils.infer_analysis_type()` by inspecting the prediction text and filename

### Example Queries

```sql
-- Create a scan
INSERT INTO scans (user_id, patient_id, scan_type, image_path, status)
VALUES (1, 5, 'xray', 'chest_xray_001.jpg', 'completed');

-- Get user's recent scans
SELECT * FROM scans
WHERE user_id = 1
ORDER BY created_at DESC
LIMIT 10;

-- Count scans by type
SELECT scan_type, COUNT(*) FROM scans
WHERE user_id = 1
GROUP BY scan_type;

-- Get failed scans
SELECT * FROM scans WHERE status = 'failed';
```

---

## Table: `scan_results`

Stores AI analysis results for each scan.

### Schema

```sql
CREATE TABLE scan_results (
  result_id       INT AUTO_INCREMENT PRIMARY KEY,
  scan_id         INT NOT NULL,
  prediction      VARCHAR(100) NOT NULL,
  confidence      FLOAT NOT NULL,
  explanation     TEXT,
  heatmap_path    LONGTEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (scan_id) REFERENCES scans(scan_id) ON DELETE CASCADE,
  INDEX idx_scan_id (scan_id),
  INDEX idx_prediction (prediction),
  INDEX idx_created_at (created_at)
);
```

### Columns

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `result_id` | INT | No | Primary key, auto-increment |
| `scan_id` | INT | No | FK to scans; cascade delete |
| `prediction` | VARCHAR(100) | No | Diagnosis label (e.g., "Pneumonia", "Glioma") |
| `confidence` | FLOAT | No | Confidence percentage (0-100) |
| `explanation` | TEXT | Yes | Clinical explanation text |
| `heatmap_path` | LONGTEXT | Yes | Base64-encoded JPEG image (Grad-CAM overlay) |
| `created_at` | TIMESTAMP | No | Analysis time (UTC) |

### Important Notes

- **Heatmap storage**: Currently stores base64-encoded JPEG string (~1-5 MB)
- **Future improvement**: Consider moving to object storage (S3) with URL reference
- **One result per scan**: Each scan has exactly one result row

### Example Queries

```sql
-- Get result for a scan
SELECT * FROM scan_results WHERE scan_id = 42;

-- Get top predictions
SELECT prediction, COUNT(*) as count
FROM scan_results
GROUP BY prediction
ORDER BY count DESC
LIMIT 10;

-- Average confidence by prediction
SELECT prediction, AVG(confidence) as avg_confidence
FROM scan_results
GROUP BY prediction;

-- Recent analyses
SELECT sr.*, s.user_id, p.name as patient_name
FROM scan_results sr
JOIN scans s ON sr.scan_id = s.scan_id
LEFT JOIN patients p ON s.patient_id = p.patient_id
ORDER BY sr.created_at DESC
LIMIT 20;
```

---

## Table: `chat_sessions`

Stores chat conversation sessions.

### Schema

```sql
CREATE TABLE chat_sessions (
  session_id      VARCHAR(64) PRIMARY KEY,
  user_id         INT,
  scan_id         INT,
  title           VARCHAR(200),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (scan_id) REFERENCES scans(scan_id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_scan_id (scan_id),
  INDEX idx_updated_at (updated_at)
);
```

### Columns

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `session_id` | VARCHAR(64) | No | UUID generated by frontend |
| `user_id` | INT | Yes | FK to users; optional (allows guest chat) |
| `scan_id` | INT | Yes | FK to scans; optional context scan |
| `title` | VARCHAR(200) | Yes | First 60 chars of first message (auto-generated) |
| `created_at` | TIMESTAMP | No | Session creation time (UTC) |
| `updated_at` | TIMESTAMP | No | Last message time (UTC) |

### Example Queries

```sql
-- Create a new session
INSERT INTO chat_sessions (session_id, user_id, scan_id, title)
VALUES ('abc-123-uuid', 1, 42, 'What does pneumonia mean?');

-- Get user's sessions (most recent first)
SELECT * FROM chat_sessions
WHERE user_id = 1
ORDER BY updated_at DESC
LIMIT 50;

-- Update session title
UPDATE chat_sessions SET title = 'COVID-19 Questions' WHERE session_id = 'abc-123-uuid';

-- Count sessions per user
SELECT user_id, COUNT(*) FROM chat_sessions GROUP BY user_id;
```

---

## Table: `chat_messages`

Stores individual messages in chat sessions.

### Schema

```sql
CREATE TABLE chat_messages (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  session_id      VARCHAR(64) NOT NULL,
  role            ENUM('user', 'assistant', 'system') NOT NULL,
  content         TEXT NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE,
  INDEX idx_session_id (session_id),
  INDEX idx_role (role),
  INDEX idx_created_at (created_at)
);
```

### Columns

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | INT | No | Primary key, auto-increment |
| `session_id` | VARCHAR(64) | No | FK to chat_sessions; cascade delete |
| `role` | ENUM | No | user / assistant / system |
| `content` | TEXT | No | Message body (up to 64KB) |
| `created_at` | TIMESTAMP | No | Message time (UTC) |

### Important Notes

- **Role mapping**: Database stores `assistant` but frontend expects `bot`
- **Backend translation**: The backend converts `assistant` ↔ `bot` in API responses

### Example Queries

```sql
-- Get all messages in a session
SELECT * FROM chat_messages
WHERE session_id = 'abc-123-uuid'
ORDER BY created_at ASC;

-- Get last 5 messages for context
SELECT * FROM chat_messages
WHERE session_id = 'abc-123-uuid'
ORDER BY created_at DESC
LIMIT 5;

-- Count messages per session
SELECT session_id, COUNT(*) FROM chat_messages GROUP BY session_id;

-- Get conversation with patient context
SELECT cm.*, cs.scan_id, s.scan_type, sr.prediction
FROM chat_messages cm
JOIN chat_sessions cs ON cm.session_id = cs.session_id
LEFT JOIN scans s ON cs.scan_id = s.scan_id
LEFT JOIN scan_results sr ON s.scan_id = sr.scan_id
WHERE cm.session_id = 'abc-123-uuid'
ORDER BY cm.created_at;
```

---

## Useful Queries

### User Activity Summary

```sql
SELECT
  u.user_id,
  u.name,
  COUNT(DISTINCT s.scan_id) as total_scans,
  COUNT(DISTINCT p.patient_id) as total_patients,
  COUNT(DISTINCT cs.session_id) as chat_sessions,
  MAX(s.created_at) as last_scan_date
FROM users u
LEFT JOIN scans s ON u.user_id = s.user_id
LEFT JOIN patients p ON u.user_id = p.user_id
LEFT JOIN chat_sessions cs ON u.user_id = cs.user_id
GROUP BY u.user_id
ORDER BY last_scan_date DESC;
```

### Scan Analysis Report

```sql
SELECT
  sr.prediction,
  COUNT(*) as count,
  ROUND(AVG(sr.confidence), 2) as avg_confidence,
  MIN(sr.confidence) as min_confidence,
  MAX(sr.confidence) as max_confidence,
  COUNT(DISTINCT sr.scan_id) as unique_scans
FROM scan_results sr
WHERE sr.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY sr.prediction
ORDER BY count DESC;
```

### Patient Scan History

```sql
SELECT
  p.name,
  p.age,
  p.gender,
  s.scan_type,
  sr.prediction,
  sr.confidence,
  s.created_at
FROM patients p
LEFT JOIN scans s ON p.patient_id = s.patient_id
LEFT JOIN scan_results sr ON s.scan_id = sr.scan_id
WHERE p.patient_id = 5
ORDER BY s.created_at DESC;
```

### Database Size

```sql
SELECT
  table_name,
  ROUND(((data_length + index_length) / 1024 / 1024), 2) as size_mb
FROM information_schema.TABLES
WHERE table_schema = 'pathoscan'
ORDER BY (data_length + index_length) DESC;
```

---

## Backup & Recovery

### Backup Database

```bash
# Full backup
docker-compose exec db mysqldump -u root -p pathoscan > backup.sql

# Backup with date
docker-compose exec db mysqldump -u root -p pathoscan > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup all databases
docker-compose exec db mysqldump -u root -p --all-databases > full_backup.sql
```

### Restore from Backup

```bash
# Restore database
cat backup.sql | docker-compose exec -T db mysql -u root -p pathoscan

# Restore all databases
cat full_backup.sql | docker-compose exec -T db mysql -u root -p
```

---

## Performance Optimization

### Add Missing Indexes

```sql
-- Index for user lookups
CREATE INDEX idx_users_email ON users(email);

-- Index for scan filtering
CREATE INDEX idx_scans_user_created ON scans(user_id, created_at);

-- Index for result lookups
CREATE INDEX idx_scan_results_scan_id ON scan_results(scan_id);

-- Index for chat queries
CREATE INDEX idx_chat_messages_session_created ON chat_messages(session_id, created_at);
```

### Check Index Usage

```sql
-- Find unused indexes
SELECT * FROM sys.schema_unused_indexes;

-- Find tables without primary key
SELECT table_name FROM information_schema.TABLES
WHERE table_schema = 'pathoscan'
AND table_name NOT IN (
  SELECT table_name FROM information_schema.KEY_COLUMN_USAGE
  WHERE column_name = 'PRIMARY'
);
```

---

## Migration Guide

### Adding a New Column

```sql
-- Add a column to scans table
ALTER TABLE scans ADD COLUMN analysis_type VARCHAR(50);

-- With default value
ALTER TABLE scans ADD COLUMN model_version VARCHAR(20) DEFAULT 'v1.0';

-- Make it required later
ALTER TABLE scans MODIFY COLUMN analysis_type VARCHAR(50) NOT NULL;
```

### Renaming a Column

```sql
ALTER TABLE scans CHANGE COLUMN image_path image_url TEXT;
```

### Removing a Column

```sql
ALTER TABLE scans DROP COLUMN analysis_type;
```

---

## Schema Improvements

### Proposed: Add `analysis_type` to `scan_results`

**Problem:** App-facing scan types (chest_xray, bone_xray) are inferred at runtime

**Solution:** Store the analysis type explicitly

```sql
ALTER TABLE scan_results ADD COLUMN analysis_type VARCHAR(50);

-- Update existing rows by inferring from prediction
UPDATE scan_results sr
SET analysis_type = CASE
  WHEN sr.prediction IN ('Normal', 'Pneumonia') THEN 'chest_xray'
  WHEN sr.prediction IN ('fractured', 'not fractured') THEN 'bone_xray'
  WHEN sr.prediction IN ('Glioma', 'Meningioma', 'No Tumor', 'Pituitary') THEN 'brain_mri'
  ELSE 'unknown'
END;

-- Make it required
ALTER TABLE scan_results MODIFY COLUMN analysis_type VARCHAR(50) NOT NULL;

-- Create index
CREATE INDEX idx_analysis_type ON scan_results(analysis_type);
```

---

## Reference

- See **[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)** for architecture
- See **[DEVELOPMENT.md](DEVELOPMENT.md)** for code conventions
- See **[API_ENDPOINTS.md](API_ENDPOINTS.md)** for REST API
