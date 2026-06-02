# PathoScan AI — Troubleshooting Guide

Solutions for common problems and error messages.

## Quick Diagnosis

**First, collect diagnostic information:**

```bash
# Check service status
docker-compose ps

# View recent logs
docker-compose logs --tail=50 backend
docker-compose logs --tail=50 db
docker-compose logs --tail=50 frontend

# Check system resources
docker stats

# Test connectivity
curl http://localhost:8000/
curl http://localhost/
```

---

## Installation & Startup

### Docker won't start

**Problem:** `docker-compose up` fails immediately

**Diagnosis:**
```bash
docker-compose logs db
docker-compose logs backend
```

**Solutions:**

1. **Port already in use**
   ```bash
   # Find process using port
   lsof -i :8000
   lsof -i :80
   
   # Option A: Kill the process
   kill -9 <PID>
   
   # Option B: Use different port in docker-compose.yml
   ports:
     - "8001:8000"  # Use 8001 instead of 8000
   ```

2. **Insufficient disk space**
   ```bash
   df -h  # Check disk usage
   
   # Clean up Docker
   docker system prune -a
   ```

3. **Docker daemon not running**
   ```bash
   # Linux
   sudo systemctl start docker
   
   # macOS
   open -a Docker
   
   # Windows
   # Start Docker Desktop app
   ```

4. **Memory insufficient**
   ```bash
   # Check available memory
   free -h  # Linux
   
   # Increase Docker memory limit (Windows/macOS)
   # Docker Desktop → Settings → Resources → Memory
   ```

---

### Database fails to initialize

**Problem:** "Can't connect to MySQL server"

**Diagnosis:**
```bash
docker-compose logs db | grep -i "error\|failed"
```

**Solutions:**

1. **Database not ready yet**
   ```bash
   # Wait longer
   sleep 60
   docker-compose ps db  # Check if healthy
   
   # Restart database
   docker-compose restart db
   sleep 30
   ```

2. **Invalid database credentials**
   ```bash
   # Check .env file
   cat .env | grep DB_
   
   # Credentials must match docker-compose.yml
   # Update .env and restart
   docker-compose down
   docker-compose up -d
   ```

3. **Volume permission denied**
   ```bash
   # Check volume permissions
   ls -la db_data/
   
   # Fix permissions
   sudo chown -R 999:999 db_data/
   sudo chmod -R 750 db_data/
   ```

---

## API & Backend Issues

### Backend won't start

**Problem:** Backend container exits immediately

**Diagnosis:**
```bash
docker-compose logs backend
```

**Solutions:**

1. **Missing environment variables**
   ```bash
   # Check .env exists
   cat .env
   
   # Must include:
   # - SECRET_KEY
   # - GROQ_API_KEY
   # - DATABASE_URL
   ```

2. **Model files missing**
   ```bash
   # Check models exist
   ls -la backend/models/
   
   # Should have:
   # - chest_xray_model.h5
   # - bone_xray_model.h5
   # - brain_mri_model.h5
   
   # If missing, either:
   # a) Download them
   # b) Remove them and use without that scan type
   ```

3. **Python dependency issue**
   ```bash
   # Rebuild backend image
   docker-compose build --no-cache backend
   docker-compose up -d backend
   ```

---

### API returns 503 Service Unavailable

**Problem:** "Model not loaded" or service temporarily unavailable

**Diagnosis:**
```bash
# Check if backend is healthy
curl http://localhost:8000/

# Check logs
docker-compose logs backend | tail -20
```

**Solutions:**

1. **Models not loaded yet**
   - Wait 30-60 seconds for startup
   - Check: `curl http://localhost:8000/`

2. **Out of memory**
   ```bash
   # Check memory usage
   docker stats backend
   
   # Restart backend
   docker-compose restart backend
   
   # Or allocate more memory in docker-compose.yml:
   services:
     backend:
       mem_limit: 4g
   ```

3. **TensorFlow initialization failed**
   ```bash
   # Rebuild backend
   docker-compose build --no-cache backend
   
   # Or remove model files and restart
   rm backend/models/*.h5
   docker-compose restart backend
   ```

---

### API returns 401 Unauthorized

**Problem:** "Invalid token" or "Token expired"

**Solutions:**

1. **No token provided**
   ```bash
   # Must include Authorization header
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:8000/api/history
   ```

2. **Token expired**
   ```bash
   # Login again to get new token
   curl -X POST http://localhost:8000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"user@example.com","password":"password"}'
   ```

3. **Invalid token format**
   ```bash
   # Token should be: Bearer <jwt_token>
   # NOT: Bearer the_word_Bearer_jwt_token
   
   curl -H "Authorization: Bearer eyJhbGci..." http://localhost:8000/api/history
   ```

---

### API returns 403 Forbidden

**Problem:** "Access denied" or "Permission denied"

**Solutions:**

1. **Accessing another user's data**
   ```bash
   # You can only access your own scans
   # Try accessing your own: /api/history
   
   # Can't access other users' scans by ID
   ```

2. **Rate limit exceeded**
   ```bash
   # Wait 60 seconds before retrying
   # Check rate limits in .env:
   RATE_LIMIT_ANALYZE=10/minute
   RATE_LIMIT_CHAT=20/minute
   ```

---

### Groq API returns error

**Problem:** "GROQ_API_KEY is invalid" or "API error"

**Diagnosis:**
```bash
# Check if key is set
docker-compose exec backend bash -c 'echo $GROQ_API_KEY'

# Test API directly
curl -H "Authorization: Bearer gsk_your_key" \
  https://api.groq.com/openai/v1/models
```

**Solutions:**

1. **Invalid API key**
   ```bash
   # Get new key from: https://console.groq.com
   
   # Update .env
   GROQ_API_KEY=gsk_your_new_key_here
   
   # Restart backend
   docker-compose restart backend
   ```

2. **API key rate limited**
   ```bash
   # Wait before making more requests
   # Check your Groq Console for usage limits
   ```

3. **Internet connection**
   ```bash
   # Test connection
   curl -I https://api.groq.com
   
   # If using Docker on Linux, check DNS:
   docker-compose exec backend bash -c 'cat /etc/resolv.conf'
   ```

---

## Frontend Issues

### Frontend blank page

**Problem:** White screen or "Cannot GET /"

**Diagnosis:**
```bash
# Check if frontend is running
curl http://localhost/

# Check logs
docker-compose logs frontend
```

**Solutions:**

1. **Frontend not built**
   ```bash
   # Rebuild frontend
   docker-compose build --no-cache frontend
   docker-compose restart frontend
   ```

2. **Wrong API URL**
   ```bash
   # Check frontend .env
   # Should match backend URL
   REACT_APP_API_URL=http://localhost:8000
   
   # Rebuild if changed
   docker-compose build frontend
   ```

3. **Browser cache**
   ```bash
   # Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   # Or clear cache manually
   ```

---

### API requests fail from frontend

**Problem:** Browser console shows CORS errors or "Failed to fetch"

**Diagnosis:**
```bash
# Check browser console (F12 → Console)
# Look for CORS or network errors
```

**Solutions:**

1. **CORS blocked**
   ```bash
   # Check ALLOWED_ORIGINS in .env
   ALLOWED_ORIGINS=http://localhost
   
   # For different port, add it:
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000
   
   # Restart backend
   docker-compose restart backend
   ```

2. **Backend not responding**
   ```bash
   # Check if backend is running
   docker-compose ps backend
   
   # Check logs
   docker-compose logs backend
   
   # Try directly
   curl http://localhost:8000/
   ```

3. **Frontend calling wrong API URL**
   ```bash
   # Check in frontend code or .env
   REACT_APP_API_URL should be correct
   
   # If changed, rebuild
   docker-compose build frontend
   ```

---

### Chat interface not working

**Problem:** Chat doesn't stream or messages don't send

**Diagnosis:**
```bash
# Check browser Network tab (F12 → Network)
# Should see EventSource connection for streaming
```

**Solutions:**

1. **Rate limit exceeded**
   ```bash
   # Chat has 20 requests/minute limit
   # Wait before sending more messages
   ```

2. **Server-Sent Events broken**
   ```bash
   # Check backend logs
   docker-compose logs -f backend | grep chat
   
   # Restart chat service
   docker-compose restart backend
   ```

3. **Session not created**
   ```bash
   # Check browser console for session_id
   # Should be a UUID string
   ```

---

### Images not displaying

**Problem:** Heatmaps or uploaded images show as broken

**Diagnosis:**
```bash
# Check if image URLs are valid
# Should be base64 encoded data URLs
```

**Solutions:**

1. **Base64 encoding broken**
   ```bash
   # Check API response for heatmap field
   curl -H "Authorization: Bearer TOKEN" \
     http://localhost:8000/api/history | jq '.results[0].heatmap'
   
   # Should start with iVBOR... (base64 JPEG)
   ```

2. **Image too large**
   ```bash
   # Heatmaps are limited to 5MB base64
   # If exceeding, increase limit in backend/config.py
   ```

---

## Database Issues

### Can't connect to database

**Problem:** "Connection refused" or "Access denied"

**Diagnosis:**
```bash
# Check if DB is running
docker-compose ps db

# Check logs
docker-compose logs db

# Try connecting
docker-compose exec db mysql -u root -pPASSWORD -e "SELECT 1;"
```

**Solutions:**

1. **Database not started**
   ```bash
   # Start it
   docker-compose restart db
   sleep 30  # Wait for startup
   ```

2. **Wrong credentials**
   ```bash
   # Verify .env matches docker-compose.yml
   grep DB_ .env
   
   # Fix and restart
   docker-compose down
   docker-compose up -d
   ```

3. **Port conflict**
   ```bash
   # Check what's using port 3306
   lsof -i :3306
   
   # Kill it or use different port
   ```

---

### Database full or disk quota exceeded

**Problem:** "Disk quota exceeded" or "No space left"

**Diagnosis:**
```bash
# Check volume size
docker volume inspect db_data | grep Mountpoint
df -h /var/lib/docker/volumes
```

**Solutions:**

1. **Clean up old data**
   ```bash
   # View database size
   docker-compose exec db mysql -u root -pPASSWORD -e \
     "SELECT table_name, ROUND(((data_length + index_length) / 1024 / 1024), 2) as size FROM information_schema.TABLES WHERE table_schema = 'pathoscan';"
   
   # Delete old scans
   docker-compose exec db mysql -u root -pPASSWORD pathoscan -e \
     "DELETE FROM scans WHERE created_at < DATE_SUB(NOW(), INTERVAL 6 MONTH);"
   ```

2. **Increase disk space**
   ```bash
   # Increase Docker volume size
   docker volume rm db_data  # WARNING: Deletes data!
   
   # Or add more storage to system
   ```

---

### Database corruption

**Problem:** "Table is marked as crashed" or database won't start

**Diagnosis:**
```bash
docker-compose logs db | grep -i corrupt
```

**Solutions:**

1. **Repair database**
   ```bash
   # Stop database
   docker-compose down
   
   # Repair tables
   docker-compose run --rm db mysqlcheck -u root -pPASSWORD --repair --all-databases
   
   # Restart
   docker-compose up -d
   ```

2. **Restore from backup**
   ```bash
   # Restore previous backup
   cat backup_clean.sql | docker-compose exec -T db mysql -u root -pPASSWORD
   ```

---

## Performance Issues

### Slow API responses

**Problem:** Requests take >5 seconds

**Diagnosis:**
```bash
# Measure response time
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:8000/api/history \
  -H "Authorization: Bearer TOKEN"

# Check server load
docker stats backend
```

**Solutions:**

1. **Database slow queries**
   ```bash
   # Enable query logging
   docker-compose exec db mysql -u root -pPASSWORD -e \
     "SET GLOBAL slow_query_log = 'ON';"
   
   # View slow queries
   docker-compose exec db tail -f /var/log/mysql/slow.log
   ```

2. **Out of memory**
   ```bash
   # Increase container memory
   # Edit docker-compose.yml:
   services:
     backend:
       mem_limit: 4g
   
   docker-compose up -d
   ```

3. **Too many concurrent requests**
   ```bash
   # Check current connections
   docker-compose exec db mysql -u root -pPASSWORD -e "SHOW PROCESSLIST;"
   
   # Reduce frontend requests or increase backend workers
   ```

---

### Model inference slow

**Problem:** Image analysis takes >10 seconds

**Diagnosis:**
```bash
# Check backend logs for timing
docker-compose logs backend | grep "inference\|duration"
```

**Solutions:**

1. **GPU acceleration**
   ```bash
   # Enable GPU in docker-compose.yml:
   services:
     backend:
       runtime: nvidia
       environment:
         NVIDIA_VISIBLE_DEVICES: all
   ```

2. **Use smaller model**
   ```bash
   # Replace with quantized version (if available)
   # Edit backend/api.py to use smaller models
   ```

3. **Cache inference results**
   ```bash
   # For duplicate images, cache results
   # Add Redis caching layer
   ```

---

## Monitoring & Logs

### View detailed logs

```bash
# Backend logs with timestamps
docker-compose logs -f --timestamps backend

# Last 100 lines of database logs
docker-compose logs --tail=100 db

# All services
docker-compose logs -f
```

### Export logs to file

```bash
# Save all logs
docker-compose logs > logs.txt

# Watch logs in real-time and save
docker-compose logs -f | tee logs.txt
```

---

## Getting Help

1. **Collect diagnostic info:**
   ```bash
   docker-compose ps > status.txt
   docker-compose logs > logs.txt
   docker stats > stats.txt
   docker version > version.txt
   ```

2. **Share the diagnostics** in bug reports

3. **Check existing docs:**
   - [QUICK_START.md](QUICK_START.md) — Setup
   - [INSTALLATION.md](INSTALLATION.md) — Installation
   - [API_ENDPOINTS.md](API_ENDPOINTS.md) — API Reference
   - [SECURITY.md](SECURITY.md) — Security

---

## Still Stuck?

1. Check system resources (disk, memory, CPU)
2. Restart all services: `docker-compose restart`
3. Rebuild from scratch: `docker-compose down -v && docker-compose up --build`
4. Check logs for error messages
5. Verify environment variables in `.env`
