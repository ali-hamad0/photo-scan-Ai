# PathoScan AI — API Reference

Complete API endpoint documentation with request/response examples.

## Base URL

```
http://localhost:8000       (Development)
https://yourdomain.com      (Production)
```

## Authentication

All endpoints marked with 🔒 require JWT token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:8000/api/endpoint
```

## Health & Status

### 🌐 Health Check

```http
GET /
```

**Response:**
```json
{"status": "ok"}
```

**Example:**
```bash
curl http://localhost:8000/
```

---

### 🌐 Test Groq API

```http
GET /api/test-ai
```

Verify Groq API connectivity.

**Response:**
```json
{
  "status": "ok",
  "message": "Groq API connection successful"
}
```

**Example:**
```bash
curl http://localhost:8000/api/test-ai
```

---

## Authentication

### Register

```http
POST /api/auth/register
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Dr. Smith",
  "email": "smith@clinic.com",
  "password": "SecurePass123!"
}
```

**Response (201 Created):**
```json
{
  "message": "Registration successful",
  "user_id": 1,
  "name": "Dr. Smith",
  "email": "smith@clinic.com"
}
```

**Example:**
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dr. Smith",
    "email": "smith@clinic.com",
    "password": "SecurePass123!"
  }'
```

**Error (400 — Email exists):**
```json
{
  "detail": "Email already registered"
}
```

**Rate Limit:** 3 per minute per IP

---

### Login

```http
POST /api/auth/login
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "smith@clinic.com",
  "password": "SecurePass123!"
}
```

**Response (200 OK):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "name": "Dr. Smith",
  "user_id": 1
}
```

**Example:**
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "smith@clinic.com",
    "password": "SecurePass123!"
  }'
```

**Error (401 — Invalid credentials):**
```json
{
  "detail": "Invalid email or password"
}
```

**Rate Limit:** 5 per minute per IP

---

## Image Analysis

### Analyze Scan 🔒

```http
POST /api/analyze
Content-Type: multipart/form-data
Authorization: Bearer JWT_TOKEN
```

**Form Data:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | Image file (JPEG, PNG) |
| `scan_type` | String | Yes | `chest_xray`, `bone_xray`, or `brain_mri` |
| `patient_name` | String | No | Patient name (max 100 chars) |
| `patient_age` | Integer | No | Patient age (0-120) |
| `patient_gender` | String | No | `male`, `female`, or `other` |
| `patient_notes` | String | No | Clinical notes (max 500 chars) |

**Response (200 OK):**
```json
{
  "result_id": 42,
  "scan_type": "chest_xray",
  "prediction": "Pneumonia",
  "confidence": 87.3,
  "explanation": "Signs of pneumonia detected in the lower lobes...",
  "patient_name": "John Doe",
  "patient_age": 45,
  "patient_gender": "Male",
  "patient_notes": "Smoker",
  "heatmap": "iVBORw0KGgoAAAANS...",
  "created_at": "May 16, 2024 14:32"
}
```

**Example:**
```bash
curl -X POST http://localhost:8000/api/analyze \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@chest_xray.jpg" \
  -F "scan_type=chest_xray" \
  -F "patient_name=John Doe" \
  -F "patient_age=45" \
  -F "patient_gender=male"
```

**Error (413 — File too large):**
```json
{
  "detail": "File size exceeds 10MB limit"
}
```

**Rate Limit:** 10 per minute

---

### Get Scan History 🔒

```http
GET /api/history?page=1&page_size=20
Authorization: Bearer JWT_TOKEN
```

**Query Parameters:**

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | Integer | 1 | — | Page number (1-indexed) |
| `page_size` | Integer | 20 | 100 | Results per page |

**Response (200 OK):**
```json
{
  "total": 5,
  "page": 1,
  "page_size": 20,
  "results": [
    {
      "result_id": 5,
      "scan_type": "brain_mri",
      "prediction": "No Tumor",
      "confidence": 95.2,
      "explanation": "No abnormal findings...",
      "patient_name": "Jane Smith",
      "patient_age": 32,
      "patient_gender": "Female",
      "patient_notes": null,
      "heatmap": "iVBORw0KGgo...",
      "created_at": "May 15, 2024 10:15"
    }
  ]
}
```

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:8000/api/history?page=1&page_size=10"
```

---

### Update Scan Patient Info 🔒

```http
PATCH /api/history/{result_id}
Content-Type: application/json
Authorization: Bearer JWT_TOKEN
```

**Request Body:**
```json
{
  "patient_name": "John Doe (Updated)",
  "patient_age": 46,
  "patient_gender": "male",
  "patient_notes": "Updated clinical notes"
}
```

**Response (200 OK):**
```json
{
  "message": "Scan updated successfully",
  "result_id": 42
}
```

**Example:**
```bash
curl -X PATCH http://localhost:8000/api/history/42 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_name": "John Doe",
    "patient_age": 46,
    "patient_notes": "Updated notes"
  }'
```

---

### Delete Scan 🔒

```http
DELETE /api/history/{result_id}
Authorization: Bearer JWT_TOKEN
```

**Response (200 OK):**
```json
{
  "message": "Scan deleted successfully"
}
```

**Example:**
```bash
curl -X DELETE http://localhost:8000/api/history/42 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Error (404 — Not found):**
```json
{
  "detail": "Scan not found"
}
```

---

### Get Statistics 🔒

```http
GET /api/stats
Authorization: Bearer JWT_TOKEN
```

**Response (200 OK):**
```json
{
  "total": 35,
  "chest": 15,
  "bone": 12,
  "brain": 8
}
```

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/stats
```

---

## Patient Management

### Get All Patients 🔒

```http
GET /api/patients
Authorization: Bearer JWT_TOKEN
```

**Response (200 OK):**
```json
{
  "patients": [
    {
      "patient_id": 1,
      "name": "John Doe",
      "age": 45,
      "gender": "Male",
      "notes": "Smoker",
      "scan_count": 3,
      "last_scan": "May 15, 2024",
      "scans": [
        {
          "result_id": 42,
          "scan_type": "chest_xray",
          "prediction": "Pneumonia",
          "confidence": 87.3,
          "created_at": "May 15, 2024 14:32"
        }
      ]
    }
  ]
}
```

**Example:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/patients
```

---

## Chat & RAG

### Get Recent Scans for Chat Context 🔒

```http
GET /api/chat/scans
Authorization: Bearer JWT_TOKEN
```

Returns last 10 scans for use as chat context.

**Response (200 OK):**
```json
{
  "scans": [
    {
      "scan_id": 42,
      "scan_type": "chest_xray",
      "prediction": "Pneumonia",
      "confidence": 87.3,
      "patient_name": "John Doe",
      "created_at": "May 15, 2024 14:32"
    }
  ]
}
```

---

### Get Chat Sessions 🔒

```http
GET /api/chat/sessions
Authorization: Bearer JWT_TOKEN
```

**Response (200 OK):**
```json
{
  "sessions": [
    {
      "session_id": "abc-123-uuid",
      "title": "What does pneumonia mean?",
      "created_at": "May 15, 2024 14:32",
      "updated_at": "May 15, 2024 15:45",
      "message_count": 5
    }
  ]
}
```

---

### Get Session Messages 🔒

```http
GET /api/chat/sessions/{session_id}/messages
Authorization: Bearer JWT_TOKEN
```

**Response (200 OK):**
```json
{
  "session_id": "abc-123-uuid",
  "messages": [
    {
      "id": 1,
      "role": "user",
      "content": "What does pneumonia mean?",
      "created_at": "May 15, 2024 14:32"
    },
    {
      "id": 2,
      "role": "bot",
      "content": "Pneumonia is an infection...",
      "created_at": "May 15, 2024 14:33"
    }
  ]
}
```

---

### Chat (Non-Streaming) 🔒

```http
POST /api/chat
Content-Type: application/json
Authorization: Bearer JWT_TOKEN
```

**Request Body:**
```json
{
  "message": "What does a low WBC count mean?",
  "session_id": "abc-123-uuid",
  "history": [],
  "scan_id": 42
}
```

**Response (200 OK):**
```json
{
  "response": "A low WBC count may suggest...",
  "sources": [
    {
      "text": "Normal WBC range: 4,500-11,000 cells/µL",
      "metadata": {"source": "lab_reference.pdf"}
    }
  ]
}
```

---

### Chat Stream (Streaming) 🔒

```http
POST /api/chat/stream
Content-Type: application/json
Authorization: Bearer JWT_TOKEN (optional for guest mode)
```

Uses **Server-Sent Events (SSE)** for streaming responses.

**Request Body:**
```json
{
  "message": "What does this pneumonia finding mean?",
  "session_id": "abc-123-uuid",
  "history": [],
  "scan_id": 42
}
```

**Response Stream:**

```
data: {"type": "scan_context_active", "content": true}

data: {"type": "token", "content": "A"}
data: {"type": "token", "content": " pneumonia"}
data: {"type": "token", "content": " finding"}
...

data: {"type": "sources", "content": [{"text": "Pneumonia...", "metadata": {...}}]}

data: {"type": "done"}
```

**Example (JavaScript):**
```javascript
const eventSource = new EventSource('/api/chat/stream', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: "What does this finding mean?",
    session_id: "session-uuid",
    scan_id: 42
  })
});

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'token') {
    console.log(data.content);  // Print token
  } else if (data.type === 'done') {
    eventSource.close();
  }
};
```

**Rate Limit:** 20 per minute

---

### Delete Chat Session 🔒

```http
DELETE /api/chat/session/{session_id}
Authorization: Bearer JWT_TOKEN
```

**Response (200 OK):**
```json
{
  "message": "Session deleted successfully"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "detail": "Error message describing what went wrong"
}
```

### Common Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Scan analyzed |
| 201 | Created | User registered |
| 400 | Bad Request | Missing required field |
| 401 | Unauthorized | Invalid/missing token |
| 403 | Forbidden | Accessing another user's data |
| 404 | Not Found | Scan doesn't exist |
| 413 | Payload Too Large | File > 10 MB |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Internal error |
| 503 | Service Unavailable | Model not loaded |

---

## Rate Limiting

Rate limits are per IP address, per minute:

| Endpoint | Limit |
|----------|-------|
| `/api/auth/register` | 3/minute |
| `/api/auth/login` | 5/minute |
| `/api/analyze` | 10/minute |
| `/api/chat/stream` | 20/minute |
| Other endpoints | 30/minute |

**Response when limit exceeded (429):**
```json
{
  "detail": "Rate limit exceeded"
}
```

---

## Testing with cURL

### Full workflow example:

```bash
# 1. Register
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dr. Smith",
    "email": "smith@test.com",
    "password": "SecurePass123!"
  }'

# 2. Login and capture token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "smith@test.com",
    "password": "SecurePass123!"
  }' | jq -r '.token')

# 3. Get stats
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/stats

# 4. Upload a scan
curl -X POST http://localhost:8000/api/analyze \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test_image.jpg" \
  -F "scan_type=chest_xray" \
  -F "patient_name=Test Patient"

# 5. Get history
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/history

# 6. Chat
curl -X POST http://localhost:8000/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is pneumonia?",
    "session_id": "test-session",
    "history": []
  }'
```

---

## Testing with Postman

1. Import collection from `/api/openapi.json`
2. Set `Bearer Token` in Authorization header
3. Use `{{base_url}}` and `{{token}}` variables

---

## API Documentation

Interactive API docs available at:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI Schema**: http://localhost:8000/openapi.json

---

## Support

- See **[QUICK_START.md](QUICK_START.md)** for setup
- See **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** for issues
- See **[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)** for architecture
