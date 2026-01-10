# Multi-Tenancy Security Architecture

## Overview

Docketra is a **multi-tenant SaaS application** where multiple organizations (firms) share the same infrastructure but must have **complete data isolation**. This document explains our security architecture for preventing cross-tenant data access.

## The Problem: IDOR and Cross-Tenant Attacks

### What is IDOR?

**Insecure Direct Object Reference (IDOR)** is a vulnerability where an attacker can access or modify resources by guessing or enumerating identifiers.

### Example Attack Scenario

```
1. User Alice from Firm A creates a case with caseId = "CASE-20260110-00001"
2. User Bob from Firm B guesses or observes this caseId
3. Bob makes a request: GET /api/cases/CASE-20260110-00001
4. WITHOUT proper security: Bob can view Alice's case
5. WITH proper security: System behaves as if case doesn't exist
```

## The Solution: Firm-Scoped Repository Layer

### Architecture Principles

1. **Fail Closed, Not Open**: If firmId is missing, deny access
2. **Defense in Depth**: Security at data layer, not just controller layer
3. **Structural Guarantees**: Make it impossible to write unsafe code
4. **Zero Trust**: Even valid IDs from other firms are rejected

### Three-Layer Architecture

```
┌─────────────────────────────────────┐
│         Controllers                 │ ← Extract firmId from req.user
│  (API endpoints, request handling)  │   Never trust request params/body
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│        Repositories                 │ ← ENFORCE firmId on ALL queries
│  (Firm-scoped data access layer)    │   Structural security guarantees
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│          Models                     │ ← Define schema and validation
│  (Mongoose models, business logic)  │
└─────────────────────────────────────┘
```

## Repository Layer

### Core Concept

**Controllers MUST NOT query models directly.** Instead, they use repositories that enforce firm scoping by design.

### Example: Case Repository

```javascript
// ❌ UNSAFE: Direct model query (NO firmId check)
const caseData = await Case.findOne({ caseId });

// ✅ SAFE: Repository query (firmId REQUIRED)
const caseData = await CaseRepository.findByCaseId(req.user.firmId, caseId);
```

### Available Repositories

- **CaseRepository**: Firm-scoped case access
- **ClientRepository**: Firm-scoped client access
- **UserRepository**: Firm-scoped user access

### Repository Methods

All repository methods follow the same pattern:

```javascript
// Pattern: repository.method(firmId, identifier, ...additionalParams)

// Find operations
CaseRepository.findByCaseId(firmId, caseId)
CaseRepository.findById(firmId, _id)
CaseRepository.find(firmId, query)
CaseRepository.findOne(firmId, query)

// Update operations
CaseRepository.updateByCaseId(firmId, caseId, update)
CaseRepository.updateById(firmId, _id, update)

// Other operations
CaseRepository.count(firmId, query)
CaseRepository.deleteByCaseId(firmId, caseId)
```

## Security Rules (MANDATORY)

### Rule 1: firmId Source

```javascript
// ✅ CORRECT: Get firmId from authenticated user
const firmId = req.user.firmId;

// ❌ WRONG: Get firmId from request params
const firmId = req.params.firmId; // CAN BE MANIPULATED

// ❌ WRONG: Get firmId from request body
const firmId = req.body.firmId; // CAN BE MANIPULATED
```

### Rule 2: No Direct Model Queries

```javascript
// ❌ FORBIDDEN in controllers/services
const Case = require('../models/Case.model');
const caseData = await Case.findOne({ caseId });

// ✅ REQUIRED in controllers/services
const { CaseRepository } = require('../repositories');
const caseData = await CaseRepository.findByCaseId(req.user.firmId, caseId);
```

### Rule 3: Fail Closed

```javascript
// If case not found, DON'T reveal why
if (!caseData) {
  // ✅ CORRECT: Generic message
  return res.status(404).json({
    success: false,
    message: 'Case not found',
  });
  
  // ❌ WRONG: Reveals information
  return res.status(403).json({
    success: false,
    message: 'This case belongs to another firm',
  });
}
```

### Rule 4: Never Trust User-Provided IDs

```javascript
// caseId, clientId, userId are NOT trusted by themselves
// They must ALWAYS be combined with firmId from req.user

// ❌ VULNERABLE
await Case.findOne({ caseId: req.params.caseId });

// ✅ SECURE
await CaseRepository.findByCaseId(req.user.firmId, req.params.caseId);
```

## Controller Implementation Pattern

### Standard Pattern

```javascript
const { CaseRepository } = require('../repositories');

async function getCase(req, res) {
  try {
    const { caseId } = req.params;
    const firmId = req.user.firmId; // From authenticated user
    
    // Firm-scoped query through repository
    const caseData = await CaseRepository.findByCaseId(firmId, caseId);
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    // Additional access control checks (if needed)
    // e.g., role-based permissions
    
    return res.status(200).json({
      success: true,
      data: caseData,
    });
  } catch (error) {
    console.error('Error fetching case:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch case',
    });
  }
}
```

## SuperAdmin Exception

SuperAdmin users have `firmId = null` and can access all firms. The repository layer handles this:

```javascript
// In repositories: check if firmId is null (SuperAdmin)
// If null, skip firmId filter to allow cross-firm access
```

**Note**: This is ONLY for SuperAdmin role, which is authenticated separately.

## Testing IDOR Prevention

### Test Scenario

1. Create two firms: Firm A and Firm B
2. Create a case in Firm A with caseId = "CASE-20260110-00001"
3. Authenticate as user from Firm B
4. Attempt to access: GET /api/cases/CASE-20260110-00001
5. **Expected Result**: 404 Not Found (as if case doesn't exist)
6. **Failure**: Case data returned or 403 Forbidden (reveals existence)

### Test Script

See `/test_idor_prevention.js` for automated IDOR testing.

## Migration Guide

### Converting Existing Code

#### Before (Unsafe)
```javascript
const caseData = await Case.findOne({ caseId });
const client = await Client.findById(clientId);
const user = await User.findOne({ xID });
```

#### After (Safe)
```javascript
const { CaseRepository, ClientRepository, UserRepository } = require('../repositories');

const firmId = req.user.firmId;
const caseData = await CaseRepository.findByCaseId(firmId, caseId);
const client = await ClientRepository.findByClientId(firmId, clientId);
const user = await UserRepository.findByXID(firmId, xID);
```

## Common Mistakes to Avoid

### Mistake 1: Inferring firmId from Objects

```javascript
// ❌ WRONG: firmId from populated object
const caseData = await Case.findOne({ caseId });
const firmId = caseData.firmId; // TOO LATE - already leaked data

// ✅ CORRECT: firmId first, then query
const firmId = req.user.firmId;
const caseData = await CaseRepository.findByCaseId(firmId, caseId);
```

### Mistake 2: Optional firmId

```javascript
// ❌ WRONG: firmId is optional
const query = { caseId };
if (req.user.firmId) {
  query.firmId = req.user.firmId;
}
const caseData = await Case.findOne(query);

// ✅ CORRECT: firmId is mandatory
const caseData = await CaseRepository.findByCaseId(req.user.firmId, caseId);
```

### Mistake 3: Trusting Request Data

```javascript
// ❌ WRONG: firmId from request
const { firmId, caseId } = req.body;
const caseData = await CaseRepository.findByCaseId(firmId, caseId);

// ✅ CORRECT: firmId from authenticated user
const firmId = req.user.firmId;
const { caseId } = req.body;
const caseData = await CaseRepository.findByCaseId(firmId, caseId);
```

## Enforcement

### Code Review Checklist

- [ ] No direct `Case.findOne/findById` in controllers/services
- [ ] No direct `Client.findOne/findById` in controllers/services
- [ ] No direct `User.findOne/findById` in controllers/services (except auth flows)
- [ ] All repository calls include `req.user.firmId` as first parameter
- [ ] firmId never comes from request params/body
- [ ] 404 errors don't reveal cross-firm information

### Linting (Future)

Consider adding ESLint rules to detect:
- Direct model queries in controllers/services
- Missing firmId in repository calls

## Security Impact

This architecture prevents:

1. **Cross-Tenant Data Leakage**: Users cannot view other firms' data
2. **Horizontal Privilege Escalation**: Users cannot modify other firms' resources
3. **IDOR Attacks**: Guessing IDs doesn't grant access
4. **Enumeration Attacks**: System behavior same whether resource exists or not

## Summary

- **Controllers**: Extract `firmId` from `req.user.firmId`
- **Repositories**: Enforce `firmId` on ALL queries
- **Models**: Define schema, no security logic
- **Rule**: Controllers NEVER query models directly
- **Result**: Cross-firm access is structurally impossible

---

**Last Updated**: 2026-01-10
**Author**: Security Team
**Status**: Production Security Policy
