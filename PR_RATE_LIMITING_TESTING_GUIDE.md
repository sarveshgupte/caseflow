# Rate Limiting Testing Guide

## Overview

This guide provides step-by-step instructions for testing the rate limiting framework to ensure it works correctly in production.

---

## Prerequisites

### Development Testing
- MongoDB running locally or accessible
- Node.js 18+ installed
- Optional: Redis instance (can use in-memory fallback)

### Production Testing
- Redis instance configured (REQUIRED)
- REDIS_URL environment variable set
- Staging environment with production-like configuration

---

## Test 1: Basic Functionality Test

### Objective
Verify rate limiters are properly initialized and don't crash the server.

### Steps
```bash
# 1. Run the test script
cd /home/runner/work/Docketra/Docketra
node test_rate_limiting.js

# Expected output:
# ✓ Test 1: Import rate limiters module
# ✓ Test 2: Verify all limiters are middleware functions
# ✓ Test 3: Verify Redis configuration module
# ✓ Test 4: Test rate limiter middleware structure
# === All Tests Passed ===
```

### Success Criteria
- ✅ All tests pass
- ✅ No errors or warnings
- ✅ Redis connection message appears (if configured)

---

## Test 2: Authentication Rate Limiting

### Objective
Verify brute-force protection on login endpoint.

### Test Case: Rapid Login Attempts
```bash
# Make 6 login attempts in quick succession
for i in {1..6}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test@example.com","password":"wrong"}' \
    -w "\nStatus: %{http_code}\n" \
    echo "---"
done
```

### Expected Results
- First 5 requests: Return 401 (Unauthorized) or 400 (Bad Request)
- 6th request: Return **429 (Too Many Requests)**
- 429 response body:
```json
{
  "success": false,
  "message": "Too many requests. Please slow down.",
  "error": "RATE_LIMIT_EXCEEDED",
  "limiter": "authLimiter",
  "retryAfter": "XX"
}
```

### Success Criteria
- ✅ 6th request returns 429
- ✅ Response includes rate limit headers
- ✅ Console shows abuse log entry: `[RATE_LIMIT] Abuse detected`

### Test Case: Rate Limit Reset
```bash
# Wait 60 seconds, then try again
sleep 60
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test@example.com","password":"wrong"}' \
  -w "\nStatus: %{http_code}\n"
```

### Expected Results
- Request succeeds (returns 401, not 429)
- Rate limit window has reset

### Success Criteria
- ✅ Request after window expiry does not get 429

---

## Test 3: Case Read Rate Limiting

### Objective
Verify read operations are limited per user+firm.

### Setup
```bash
# 1. Login to get JWT token
TOKEN=$(curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@firm1.com","password":"YourPassword"}' \
  | jq -r '.token')

echo "Token: $TOKEN"
```

### Test Case: Rapid Case Reads
```bash
# Make 61 case list requests
for i in {1..61}; do
  response=$(curl -s -o /dev/null -w "%{http_code}" \
    -X GET http://localhost:5000/api/cases \
    -H "Authorization: Bearer $TOKEN")
  echo "Request $i: $response"
  if [ "$response" = "429" ]; then
    echo "Rate limit hit at request $i"
    break
  fi
done
```

### Expected Results
- First 60 requests: Return 200 (OK)
- 61st request: Return **429 (Too Many Requests)**

### Success Criteria
- ✅ Rate limit triggers at 61st request
- ✅ 429 response includes limiter name: "userReadLimiter"
- ✅ Abuse log shows userId and firmId

---

## Test 4: Case Write Rate Limiting

### Objective
Verify write operations have stricter limits than reads.

### Setup
Same as Test 3 (get JWT token)

### Test Case: Rapid Case Comments
```bash
# Make 31 comment requests
for i in {1..31}; do
  response=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST http://localhost:5000/api/cases/CASE-20260109-00001/comments \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"Test comment $i\"}")
  echo "Request $i: $response"
  if [ "$response" = "429" ]; then
    echo "Rate limit hit at request $i"
    break
  fi
done
```

### Expected Results
- First 30 requests: Return 200 or 201
- 31st request: Return **429 (Too Many Requests)**

### Success Criteria
- ✅ Rate limit triggers at 31st request (stricter than reads)
- ✅ 429 response includes limiter name: "userWriteLimiter"

---

## Test 5: Attachment Rate Limiting

### Objective
Verify attachment downloads have the strictest limits.

### Setup
Same as Test 3 (get JWT token)

### Test Case: Rapid Attachment Downloads
```bash
# Make 11 download requests
ATTACHMENT_ID="existing-attachment-id"  # Replace with real ID
for i in {1..11}; do
  response=$(curl -s -o /dev/null -w "%{http_code}" \
    -X GET "http://localhost:5000/api/cases/CASE-20260109-00001/attachments/$ATTACHMENT_ID/download" \
    -H "Authorization: Bearer $TOKEN")
  echo "Request $i: $response"
  if [ "$response" = "429" ]; then
    echo "Rate limit hit at request $i"
    break
  fi
done
```

### Expected Results
- First 10 requests: Return 200 (OK)
- 11th request: Return **429 (Too Many Requests)**

### Success Criteria
- ✅ Rate limit triggers at 11th request (stricter than writes)
- ✅ 429 response includes limiter name: "attachmentLimiter"

---

## Test 6: Search Rate Limiting

### Objective
Verify search endpoints have appropriate limits.

### Setup
Same as Test 3 (get JWT token)

### Test Case: Rapid Search Queries
```bash
# Make 21 search requests
for i in {1..21}; do
  response=$(curl -s -o /dev/null -w "%{http_code}" \
    -X GET "http://localhost:5000/api/search?q=test$i" \
    -H "Authorization: Bearer $TOKEN")
  echo "Request $i: $response"
  if [ "$response" = "429" ]; then
    echo "Rate limit hit at request $i"
    break
  fi
done
```

### Expected Results
- First 20 requests: Return 200 (OK)
- 21st request: Return **429 (Too Many Requests)**

### Success Criteria
- ✅ Rate limit triggers at 21st request
- ✅ 429 response includes limiter name: "searchLimiter"

---

## Test 7: SuperAdmin Rate Limiting

### Objective
Verify even SuperAdmin has rate limits.

### Setup
```bash
# Login as SuperAdmin
SUPERADMIN_TOKEN=$(curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"'$SUPERADMIN_EMAIL'","password":"'$SUPERADMIN_PASSWORD'"}' \
  | jq -r '.token')
```

### Test Case: Rapid SuperAdmin Operations
```bash
# Make 101 requests to superadmin endpoint
for i in {1..101}; do
  response=$(curl -s -o /dev/null -w "%{http_code}" \
    -X GET http://localhost:5000/api/superadmin/stats \
    -H "Authorization: Bearer $SUPERADMIN_TOKEN")
  echo "Request $i: $response"
  if [ "$response" = "429" ]; then
    echo "Rate limit hit at request $i"
    break
  fi
done
```

### Expected Results
- First 100 requests: Return 200 (OK)
- 101st request: Return **429 (Too Many Requests)**

### Success Criteria
- ✅ Rate limit triggers at 101st request (higher but not unlimited)
- ✅ 429 response includes limiter name: "superadminLimiter"
- ✅ SuperAdmin is NOT exempt from rate limiting

---

## Test 8: Rate Limit Headers

### Objective
Verify standardized rate limit headers are returned.

### Test Case: Check Headers
```bash
curl -v -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}' 2>&1 | grep -i ratelimit
```

### Expected Headers
```
< RateLimit-Limit: 5
< RateLimit-Remaining: 4
< RateLimit-Reset: 1704902400
```

### Success Criteria
- ✅ `RateLimit-Limit` header present
- ✅ `RateLimit-Remaining` header decrements
- ✅ `RateLimit-Reset` header shows Unix timestamp

---

## Test 9: Abuse Logging

### Objective
Verify abuse events are logged correctly.

### Test Case: Trigger 429 and Check Logs
```bash
# Make 6 login attempts
for i in {1..6}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test@example.com","password":"wrong"}' > /dev/null 2>&1
done

# Check server logs for abuse event
grep "[RATE_LIMIT]" /path/to/logs/server.log | tail -1
```

### Expected Log Entry
```json
[RATE_LIMIT] Abuse detected: {
  "timestamp": "2026-01-10T19:00:00.000Z",
  "limiterName": "authLimiter",
  "ip": "127.0.0.1",
  "route": "POST /api/auth/login",
  "userId": "unauthenticated",
  "firmId": "none",
  "role": "none",
  "userAgent": "curl/7.68.0"
}
```

### Success Criteria
- ✅ Log entry contains all fields
- ✅ Log level is WARN
- ✅ Prefix is `[RATE_LIMIT]`

---

## Test 10: Fail-Closed Behavior (Production Only)

### ⚠️ WARNING: This test causes service disruption. Only run in staging/test environment.

### Objective
Verify requests are denied if Redis becomes unavailable in production.

### Setup
```bash
# Set NODE_ENV to production
export NODE_ENV=production
export REDIS_URL=redis://localhost:6379

# Start server
node src/server.js &
SERVER_PID=$!
```

### Test Case: Redis Failure
```bash
# 1. Make a successful request
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}'
# Should return 401 (request allowed)

# 2. Stop Redis
sudo systemctl stop redis
# OR
docker stop redis-container

# 3. Make another request
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}'
# Should return 500 or connection error (fail-closed)

# 4. Check server logs
tail -f /path/to/logs/server.log | grep FAIL-CLOSED
```

### Expected Results
- ✅ Log shows: `[RATE_LIMIT] FAIL-CLOSED: Redis unavailable in production`
- ✅ Requests are denied (not silently bypassed)
- ✅ Server logs critical error

### Cleanup
```bash
# Restart Redis
sudo systemctl start redis
# OR
docker start redis-container

# Stop server
kill $SERVER_PID
```

---

## Test 11: Multi-Tenant Isolation

### Objective
Verify rate limits are properly scoped to firm boundaries.

### Setup
```bash
# Get tokens for two users from different firms
TOKEN_FIRM1=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@firm1.com","password":"password"}' \
  | jq -r '.token')

TOKEN_FIRM2=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@firm2.com","password":"password"}' \
  | jq -r '.token')
```

### Test Case: Independent Rate Limits
```bash
# Make 60 requests from Firm 1
for i in {1..60}; do
  curl -s -o /dev/null -X GET http://localhost:5000/api/cases \
    -H "Authorization: Bearer $TOKEN_FIRM1"
done

# Make 1 request from Firm 2 (should succeed, not rate limited)
response=$(curl -s -o /dev/null -w "%{http_code}" \
  -X GET http://localhost:5000/api/cases \
  -H "Authorization: Bearer $TOKEN_FIRM2")
  
echo "Firm 2 request status: $response"
```

### Expected Results
- Firm 2 request returns 200 (OK), not 429
- Rate limits are NOT shared across firms

### Success Criteria
- ✅ One firm hitting limits does not affect other firms
- ✅ Multi-tenancy isolation is maintained

---

## Test 12: Performance Impact

### Objective
Measure latency overhead of rate limiting.

### Setup
```bash
# Install Apache Bench (if not already installed)
sudo apt-get install apache2-utils

# Get auth token
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@firm1.com","password":"password"}' \
  | jq -r '.token')
```

### Test Case: Latency Measurement
```bash
# Test without rate limiting (baseline)
# Edit src/routes/case.routes.js and temporarily remove userReadLimiter
# Restart server, then:
ab -n 100 -c 10 -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/cases/ > baseline.txt

# Test with rate limiting (current)
# Restore userReadLimiter, restart server, then:
ab -n 100 -c 10 -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/cases/ > ratelimited.txt

# Compare results
grep "Time per request" baseline.txt ratelimited.txt
```

### Expected Results
- Overhead: < 5ms per request
- Performance degradation: < 10%

### Success Criteria
- ✅ Rate limiting adds minimal latency
- ✅ No significant performance impact

---

## Production Deployment Checklist

Before deploying to production, verify:

### Configuration
- [ ] `REDIS_URL` environment variable is set
- [ ] Redis instance is accessible from app servers
- [ ] Redis authentication is configured (if required)
- [ ] `NODE_ENV=production` is set

### Testing
- [ ] Test 1 (Basic Functionality) passes
- [ ] Test 2 (Auth Rate Limiting) passes
- [ ] Test 3 (Read Rate Limiting) passes
- [ ] Test 4 (Write Rate Limiting) passes
- [ ] Test 7 (SuperAdmin Rate Limiting) passes
- [ ] Test 9 (Abuse Logging) works correctly
- [ ] Test 10 (Fail-Closed) passes in staging

### Monitoring
- [ ] Alerting configured for `[RATE_LIMIT]` logs
- [ ] Dashboard shows rate limit metrics
- [ ] Redis health monitoring enabled
- [ ] 429 response rate is tracked

### Documentation
- [ ] Incident response procedures documented
- [ ] Rate limit values documented for support team
- [ ] Escalation process defined for limit adjustments

---

## Troubleshooting

### Issue: Server won't start
**Error**: `ValidationError: Custom keyGenerator appears to use request IP`

**Solution**: This error should not occur with current implementation. If it does:
1. Check that you have the latest version of `express-rate-limit`
2. Verify `validate.validationsConfig: false` is set in `createLimiter()`

### Issue: All requests return 429
**Possible causes**:
1. Redis is down (check logs for connection errors)
2. Rate limits are too strict (review limit values)
3. Time window hasn't expired (wait 60 seconds)

**Solution**:
1. Check Redis status: `redis-cli ping`
2. Review server logs for errors
3. Temporarily increase limits for debugging

### Issue: Rate limits not working
**Possible causes**:
1. Rate limiter not applied to route
2. Middleware order is incorrect
3. Redis not configured

**Solution**:
1. Check route file for rate limiter import and usage
2. Verify order: `authenticate, authorize, rateLimiter, handler`
3. Check Redis connection in logs

### Issue: CodeQL false positives
**Expected**: CodeQL may flag "missing rate limiting" alerts

**Explanation**: These are false positives. CodeQL's pattern matching expects rate limiters immediately before handlers, but our architecture correctly places them after auth/authz middleware.

**Verification**: Manually inspect flagged routes to confirm rate limiter is present.

---

## Summary

This testing guide covers:
- ✅ Basic functionality
- ✅ Authentication rate limiting (brute-force protection)
- ✅ Case read rate limiting (scraping prevention)
- ✅ Case write rate limiting (spam prevention)
- ✅ Attachment rate limiting (bandwidth protection)
- ✅ Search rate limiting (query abuse prevention)
- ✅ SuperAdmin rate limiting (privilege not unlimited)
- ✅ Rate limit headers
- ✅ Abuse logging
- ✅ Fail-closed behavior
- ✅ Multi-tenant isolation
- ✅ Performance impact

**Before production deployment**: Complete ALL tests in staging environment.

---

**Questions?** Refer to:
- `PR_RATE_LIMITING_IMPLEMENTATION_SUMMARY.md` for implementation details
- `PR_RATE_LIMITING_SECURITY_SUMMARY.md` for security analysis
