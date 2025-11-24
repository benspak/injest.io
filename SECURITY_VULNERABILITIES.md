# Security Vulnerability Report
**Generated:** November 24, 2025
**Codebase:** injest.io

## Executive Summary

This report identifies security vulnerabilities found in the injest.io codebase. Issues are categorized by severity: **Critical**, **High**, **Medium**, and **Low**.

---

## 🔴 CRITICAL VULNERABILITIES

### 1. **Default JWT Secret in Production**
**Location:** `api/src/config/auth.ts:5`
**Severity:** Critical
**Risk:** Authentication bypass, token forgery

```5:5:api/src/config/auth.ts
export const JWT_SECRET: string = process.env.JWT_SECRET || 'default-secret-change-in-production';
```

**Issue:** If `JWT_SECRET` environment variable is not set, the application uses a hardcoded default secret. This allows attackers to forge authentication tokens.

**Recommendation:**
- Fail fast if `JWT_SECRET` is not set in production
- Use a strong, randomly generated secret
- Never commit secrets to version control

**Fix:**
```typescript
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  console.warn('WARNING: Using default JWT_SECRET. This should never be used in production!');
}
export const JWT_SECRET: string = process.env.JWT_SECRET || 'default-secret-change-in-production';
```

---

### 2. **XSS Vulnerability via dangerouslySetInnerHTML**
**Location:**
- `frontend/components/item-list.tsx:1393`
- `frontend/components/search-results.tsx:1220`
**Severity:** Critical
**Risk:** Cross-Site Scripting (XSS) attacks

**Issue:** HTML content is rendered using `dangerouslySetInnerHTML` without sanitization. Malicious HTML/JavaScript in email content or item descriptions can execute in users' browsers.

**Example:**
```1393:1393:frontend/components/item-list.tsx
dangerouslySetInnerHTML={{ __html: rewrittenHtml }}
```

**Recommendation:**
- Use DOMPurify or similar library to sanitize HTML before rendering
- Implement Content Security Policy (CSP) headers
- Consider using a safer alternative like `react-markdown` for user-generated content

**Fix:**
```typescript
import DOMPurify from 'isomorphic-dompurify';

// Before rendering:
const sanitizedHtml = DOMPurify.sanitize(rewrittenHtml, {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li'],
  ALLOWED_ATTR: ['href', 'target', 'rel']
});

<div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
```

---

### 3. **SQL Injection Risk in Dynamic Query Construction**
**Location:** `api/src/services/contactEnrichment.ts:124-147`
**Severity:** Critical
**Risk:** SQL injection attacks

**Issue:** Dynamic SQL conditions are constructed by joining strings, which could be vulnerable if input is not properly sanitized.

```124:147:api/src/services/contactEnrichment.ts
    const conditions: string[] = [
      `LOWER(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))) LIKE $1`,
      `LOWER(TRIM(COALESCE(last_name, '') || ' ' || COALESCE(first_name, ''))) LIKE $1`,
    ];

    // Add individual word matches
    searchTerms.forEach((term, index) => {
      const paramIndex = index + 2; // $1 is used for full pattern
      conditions.push(`LOWER(COALESCE(first_name, '')) LIKE $${paramIndex}`);
      conditions.push(`LOWER(COALESCE(last_name, '')) LIKE $${paramIndex}`);
    });

    const params = [searchPattern, ...wordPatterns];

    const result = await pool.query<User>(
      `
        SELECT *
        FROM users
        WHERE profile_private = false
          AND (
            first_name IS NOT NULL OR last_name IS NOT NULL
          )
          AND (
            ${conditions.join(' OR ')}
          )
        LIMIT 50
      `,
      params
    );
```

**Note:** While parameters are used, the dynamic construction of conditions could be risky if `searchTerms` contains unexpected values. The current implementation appears safe, but the pattern is concerning.

**Recommendation:**
- Validate and sanitize `searchTerms` before use
- Consider using a query builder library
- Add input validation to ensure search terms only contain expected characters

---

## 🟠 HIGH SEVERITY VULNERABILITIES

### 4. **Insecure CORS Configuration**
**Location:** `api/src/index.ts:31-52`
**Severity:** High
**Risk:** Unauthorized cross-origin requests

**Issue:** In development mode, CORS allows any `localhost` origin on any port, which could be exploited.

```31:52:api/src/index.ts
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : ['http://localhost:3000', 'http://localhost:3001'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // In development, allow localhost on any port
      if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost:')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
}));
```

**Issues:**
1. Requests with no origin are allowed (line 38) - this could allow unauthorized access
2. Development mode allows any localhost port, which could be exploited if misconfigured

**Recommendation:**
- Be more restrictive about requests with no origin
- Use a whitelist approach even in development
- Consider using environment-specific CORS configurations

---

### 5. **Rate Limiting in Memory (No Persistence)**
**Location:** `api/src/middleware/apiKeyAuth.ts:7`
**Severity:** High
**Risk:** Rate limit bypass, DoS attacks

**Issue:** Rate limiting is stored in memory using a `Map`, which means:
- Rate limits reset on server restart
- Multiple server instances don't share rate limit state
- Memory can grow unbounded

```7:7:api/src/middleware/apiKeyAuth.ts
const usageMap = new Map<string, number[]>();
```

**Recommendation:**
- Use Redis or similar distributed cache for rate limiting
- Implement cleanup for old entries to prevent memory leaks
- Consider using a library like `express-rate-limit` with Redis backend

---

### 6. **Missing Input Validation on File Uploads**
**Location:** `api/src/routes/items.ts:345-350`
**Severity:** High
**Risk:** Malicious file uploads, path traversal

**Issue:** While file uploads have size limits and filename sanitization, there's no validation of:
- File type/MIME type verification beyond basic checks
- File content validation (magic bytes)
- Path traversal protection beyond filename sanitization

**Recommendation:**
- Validate file MIME types against actual file content (magic bytes)
- Implement virus scanning for uploaded files
- Restrict allowed file types more strictly
- Store files outside web root when possible

---

### 7. **SSL Certificate Validation Disabled**
**Location:** `api/src/config/database.ts:10`
**Severity:** High
**Risk:** Man-in-the-middle attacks

**Issue:** SSL certificate validation is disabled in production, which could allow MITM attacks.

```10:10:api/src/config/database.ts
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
```

**Recommendation:**
- Enable SSL certificate validation in production
- Use proper CA certificates
- Only disable validation in development if absolutely necessary

**Fix:**
```typescript
ssl: process.env.NODE_ENV === 'production'
  ? { rejectUnauthorized: true }  // Enable validation
  : false,
```

---

## 🟡 MEDIUM SEVERITY VULNERABILITIES

### 8. **Weak Password Requirements**
**Location:** `api/src/routes/auth.ts:90-100`
**Severity:** Medium
**Risk:** Brute force attacks, weak passwords

**Issue:** Password validation only requires 8 characters minimum with no complexity requirements.

```90:100:api/src/routes/auth.ts
function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || password.length === 0) {
    return { valid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }

  return { valid: true };
}
```

**Recommendation:**
- Require password complexity (uppercase, lowercase, numbers, special characters)
- Implement password strength meter
- Consider using a password validation library like `zxcvbn`

---

### 9. **Missing CSRF Protection**
**Location:** Throughout API routes
**Severity:** Medium
**Risk:** Cross-Site Request Forgery attacks

**Issue:** No CSRF protection is implemented for state-changing operations.

**Recommendation:**
- Implement CSRF tokens for state-changing requests
- Use SameSite cookies
- Consider using `csurf` middleware for Express

---

### 10. **Information Disclosure in Error Messages**
**Location:** Multiple locations
**Severity:** Medium
**Risk:** Information leakage

**Issue:** Error messages sometimes expose internal details, especially in development mode.

**Example:**
```196:196:api/src/index.ts
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
```

**Recommendation:**
- Ensure production error messages don't leak sensitive information
- Log detailed errors server-side, return generic messages to clients
- Avoid exposing stack traces in production

---

### 11. **No Request Size Limits**
**Location:** `api/src/index.ts`
**Severity:** Medium
**Risk:** DoS attacks via large payloads

**Issue:** While file uploads have size limits, JSON body size limits may not be configured.

**Recommendation:**
- Set explicit body size limits for JSON and URL-encoded payloads
- Configure Express body parser limits
- Monitor request sizes

---

### 12. **API Key Exposure Risk**
**Location:** `api/src/middleware/apiKeyAuth.ts:16-36`
**Severity:** Medium
**Risk:** API key leakage in logs

**Issue:** API keys are extracted from headers but could potentially be logged in error messages or logs.

**Recommendation:**
- Never log API keys
- Mask API keys in any error responses
- Implement API key rotation mechanism

---

## 🟢 LOW SEVERITY / BEST PRACTICES

### 13. **Missing Security Headers**
**Severity:** Low
**Risk:** Various attacks

**Recommendation:**
- Implement security headers:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Strict-Transport-Security` (HSTS)
  - `Content-Security-Policy`
- Use `helmet` middleware for Express

---

### 14. **No Dependency Vulnerability Scanning**
**Severity:** Low
**Risk:** Vulnerable dependencies

**Recommendation:**
- Regularly run `npm audit` or use Snyk/Dependabot
- Keep dependencies up to date
- Review and update dependencies regularly

---

### 15. **Missing Rate Limiting on Authentication Endpoints**
**Severity:** Low
**Risk:** Brute force attacks

**Issue:** Login and signup endpoints don't appear to have rate limiting.

**Recommendation:**
- Implement rate limiting on authentication endpoints
- Use exponential backoff for failed login attempts
- Consider CAPTCHA after multiple failed attempts

---

### 16. **Environment Variable Validation**
**Severity:** Low
**Risk:** Misconfiguration

**Recommendation:**
- Validate all required environment variables at startup
- Fail fast if critical variables are missing
- Use a library like `envalid` for environment variable validation

---

## Summary of Recommendations

### Immediate Actions (Critical):
1. ✅ Fix default JWT secret handling
2. ✅ Sanitize HTML before rendering with `dangerouslySetInnerHTML`
3. ✅ Review and secure SQL query construction patterns

### Short-term Actions (High Priority):
1. ✅ Tighten CORS configuration
2. ✅ Implement persistent rate limiting
3. ✅ Enable SSL certificate validation
4. ✅ Add file upload content validation

### Medium-term Actions:
1. ✅ Strengthen password requirements
2. ✅ Implement CSRF protection
3. ✅ Add security headers
4. ✅ Set request size limits

### Ongoing Maintenance:
1. ✅ Regular dependency audits
2. ✅ Security code reviews
3. ✅ Penetration testing
4. ✅ Security monitoring and logging

---

## Additional Notes

- The codebase uses parameterized queries for most database operations, which is good
- Authentication middleware is properly implemented
- Stripe webhook signature verification is correctly implemented
- File uploads have size limits and filename sanitization
- Rate limiting exists for API keys (though in-memory only)

---

**Report Generated:** November 24, 2025
**Next Review Recommended:** Within 30 days
