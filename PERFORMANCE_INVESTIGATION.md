# Auth Microservice Performance Investigation

## Summary

**Issue**: Login requests taking 78-129 seconds when called through API gateway, but only 0.2-0.3 seconds when called directly.

## Findings

### ✅ What's Working Fast

1. **Direct API calls**: 0.226 seconds (from host)
2. **Direct axios calls from gateway**: 271ms (from gateway container)
3. **Database queries**: 0.06ms execution time (with index)
4. **Network connectivity**: <1ms ping times
5. **Health checks**: 21ms response time

### ❌ Performance Issues

1. **API Gateway requests**: 78-129 seconds (through gateway)
2. **Connection handling**: Gateway uses `externalHttpAgent` (no keep-alive) for auth service

## Root Cause Analysis

### Database Performance
- Database queries are fast (0.06ms)
- Index exists on email column
- Only 12 users in database

### Network Performance
- Network connectivity is excellent (<1ms)
- Direct HTTP calls are fast (271ms)
- No network latency issues

### Code Performance
- bcrypt password hashing: <1ms
- Database queries: <1ms
- JWT token generation: <1ms

### Potential Issues

1. **Logger Service**: Makes async HTTP calls to logging-microservice
   - Timeout: 5 seconds
   - Non-blocking (fire-and-forget)
   - Should not cause delays

2. **API Gateway Connection Handling**:
   - Uses `externalHttpAgent` (no keep-alive) for auth service
   - Auth service is NOT in `isInternalService` list
   - Each request creates new connection

3. **Connection Pool Exhaustion**:
   - External agent has `maxSockets: 50`
   - No keep-alive means connections are closed after each request
   - Could cause connection delays if pool is exhausted

## Recommendations

### Immediate Fixes

1. **Add auth-microservice to internal services list**:
   - Change `isInternalService` to include 'auth'
   - Use keep-alive agent for better connection reuse
   - This should significantly improve performance

2. **Check logging service connectivity**:
   - Verify logging-microservice is accessible
   - Check if logging calls are timing out
   - Consider making logging truly async (don't await)

3. **Monitor connection pool**:
   - Check if connection pool is being exhausted
   - Monitor socket counts in gateway

### Long-term Improvements

1. **Connection Pooling**:
   - Use keep-alive for all internal services
   - Implement connection pool monitoring
   - Add connection pool metrics

2. **Performance Monitoring**:
   - Add request timing logs
   - Monitor database query times
   - Track external service call times

3. **Optimize Logger**:
   - Make logging truly non-blocking
   - Use queue for log messages
   - Batch log messages

## Test Results

### Direct Tests
- Host → Auth: 0.226s ✅
- Gateway container → Auth: 0.271s ✅
- Database query: 0.00006s ✅

### Through Gateway
- Gateway → Auth: 78-129s ❌

## Next Steps

1. Change auth service to use keep-alive agent
2. Test performance improvement
3. Monitor connection pool usage
4. Check logging service connectivity

