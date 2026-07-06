# Unit Test Summary - PrivaGene Backend

## Overview
This document summarizes all unit tests created for the PrivaGene backend services. The tests use **Jest** as the testing framework and employ **mocking** to isolate units of code without requiring a real database or external dependencies.

---

## Testing Methodology

### **How Tests Are Structured**
1. **Mocking Strategy**: All external dependencies (database, bcrypt, encryption) are mocked using `jest.mock()`
2. **Isolation**: Each test is independent - `beforeEach()` clears all mocks between tests
3. **Assertions**: Tests verify:
   - Function calls (e.g., `db.run` was called)
   - Return values match expected structure
   - Error handling (throws, rejects)
   - Data transformations (encryption, boolean conversions)

### **Test Execution**
- Run all tests: `npm test`
- Tests are located in `BackEnd/Server/__tests__/`
- Jest automatically discovers `*.test.js` files

---

## Test Coverage by Service

### 1. **encryptionService.test.js** (18 tests)
**Purpose**: Verify encryption/decryption of sensitive data (risk percentages, gene lists)

#### Test Cases:
| Test | What It Tests | How It's Tested |
|------|---------------|-----------------|
| `encrypt returns encrypted string in iv:data format` | Encryption produces valid format | Encrypts text, checks for `:` separator and 2 parts |
| `decrypt correctly decrypts encrypted data` | Round-trip encryption works | Encrypt → Decrypt → Compare with original |
| `encrypt returns null for null/undefined` | Null safety | Passes null/undefined, expects null return |
| `decrypt returns null for null/undefined` | Null safety | Passes null/undefined, expects null return |
| `encrypt handles objects by converting to JSON string` | Object encryption | Encrypts object, decrypts, parses JSON, compares |
| `decrypt handles legacy unencrypted data (no colon)` | Backward compatibility | Passes plain text, expects same text back |
| `decrypt handles non-string types (legacy data)` | Type handling | Passes number, expects string conversion |
| `encryptJSON encrypts and decrypts JSON objects` | JSON encryption | Encrypts object, decrypts, compares arrays/objects |
| `encryptJSON returns null for null input` | Null safety | Passes null, expects null |
| `decryptJSON returns null for null input` | Null safety | Passes null, expects null |
| `decryptJSON handles legacy unencrypted JSON strings` | Legacy data support | Passes plain JSON string, expects parsed object |
| `encryptNumber encrypts and decrypts numbers` | Number encryption | Encrypts number, decrypts, compares values |
| `encryptNumber returns null for null/undefined` | Null safety | Passes null/undefined, expects null |
| `decryptNumber returns null for null/undefined` | Null safety | Passes null/undefined, expects null |
| `decryptNumber handles legacy unencrypted numbers` | Legacy data support | Passes plain number, expects same number |
| `decryptNumber handles invalid encrypted data gracefully` | Error handling | Passes invalid format, expects graceful failure |
| `encrypt produces different output for same input (due to random IV)` | Security: random IV | Encrypts same text twice, verifies different outputs but same decryption |
| `encryptJSON handles arrays correctly` | Array encryption | Encrypts array, decrypts, compares elements |
| `decryptNumber parses float values correctly` | Float precision | Encrypts float, decrypts, uses `toBeCloseTo` for comparison |

**Key Testing Approach**: 
- No mocking needed (pure functions)
- Tests verify encryption format, round-trip correctness, and legacy data compatibility
- Security test verifies random IV generation (same input → different ciphertext)

---

### 2. **userService.test.js** (16 tests)
**Purpose**: Test user management operations (CRUD, authentication, password hashing)

#### Test Cases:

| Test | What It Tests | How It's Tested |
|------|---------------|-----------------|
| `createUser hashes password and inserts user` | User creation with password hashing | Mocks `bcrypt.hash` and `db.run`, verifies hash called and user created |
| `authenticateUser returns null when user not found` | Authentication failure | Mocks `db.get` to return null, expects null result |
| `authenticateUser throws for deleted user` | Account status check | Mocks user with `status: 'deleted'`, expects error throw |
| `emailExists returns boolean` | Email validation | Mocks `db.get` with/without result, checks boolean return |
| `updateUserStatus updates status via run()` | Status update | Mocks `db.run` and `db.get`, verifies SQL executed and user returned |
| `getUserById retrieves user by ID` | User retrieval | Mocks `db.get` with user data, verifies `research_consent` converted (0→false) |
| `updateUser updates allowed fields` | User profile update | Mocks `db.run` and `db.get`, verifies update SQL called |
| `updateUser converts researchConsent boolean to integer` | Data type conversion | Mocks update, checks SQL contains integer value (1) for boolean true |
| `deleteUser performs soft delete` | Soft deletion | Mocks `db.get` (user exists) and `db.run`, verifies status set to 'deleted' |
| `deleteUser throws error if user not found` | Error handling | Mocks `db.get` to return null, expects error throw |
| `hardDeleteUser permanently deletes user` | Hard deletion | Mocks `db.run`, verifies DELETE SQL executed |
| `changePassword hashes new password` | Password update | Mocks `bcrypt.hash` and `db.run`, verifies hash called with correct rounds (10) |
| `getUsers returns filtered users` | User listing with filters | Mocks `db.all` with user array, verifies filtering and `research_consent` conversion |
| `getUsers excludes deleted users by default` | Default filtering | Mocks `db.all`, checks SQL contains `status != ?` clause |
| `getUsers includes deleted when includeDeleted is true` | Filter override | Mocks `db.all`, verifies SQL doesn't exclude deleted users |
| `licenseNumberExists returns boolean` | License validation | Mocks `db.get` with/without result, checks boolean return |
| `getHospitalSpecialistsByOrganization returns specialists` | Organization filtering | Mocks `db.all` with specialist array, verifies filtering by organization |

**Key Testing Approach**:
- **Mocks**: `db.run`, `db.get`, `db.all`, `bcrypt.hash`, `bcrypt.compare`
- Tests verify SQL execution, data transformations, and error handling
- Boolean conversion tests ensure `research_consent` (0/1) ↔ boolean conversion works

---

### 3. **diseaseService.test.js** (15 tests)
**Purpose**: Test disease and gene management (CRUD, validation, bulk operations)

#### Test Cases:

| Test | What It Tests | How It's Tested |
|------|---------------|-----------------|
| `generateHash is deterministic and case-insensitive` | Hash function correctness | Calls with 'brca1' and 'BRCA1', verifies same hash output |
| `validateConstant enforces >0 and <=100` | Constant validation | Tests valid (50), invalid (0, 101) values |
| `createDisease validates constant and inserts disease and genes` | Disease creation | Mocks `db.run`, `db.get`, `db.all`, verifies disease and genes inserted |
| `checkDuplicateDisease returns boolean` | Duplicate detection | Mocks `db.get` with/without result, checks boolean return |
| `getDiseaseById returns disease with gene symbols` | Disease retrieval with genes | Mocks `db.get` (disease) and `db.all` (genes), verifies gene_symbols array populated |
| `getDiseaseById returns null when disease not found` | Not found handling | Mocks `db.get` to return null, expects null |
| `updateDisease updates disease metadata` | Disease update | Mocks `db.get` (existing) and `db.run`, verifies update SQL executed |
| `updateDisease validates constant when updating` | Constant validation on update | Mocks update with invalid constant (150), expects error throw |
| `updateDisease updates gene symbols when provided` | Gene symbol update | Mocks update with new gene array, verifies DELETE and INSERT SQL called |
| `deleteDisease returns false when disease not found` | Delete error handling | Mocks `db.get` to return null, expects false |
| `deleteDisease deletes disease when found` | Disease deletion | Mocks `db.get` (exists) and `db.run`, verifies DELETE SQL executed |
| `bulkInsertDiseases inserts valid entries` | Bulk CSV import | Mocks `db.get` (no existing) and `db.run`, verifies 2 entries inserted |
| `bulkInsertDiseases skips entries with missing required fields` | Validation in bulk import | Mocks entries with missing fields, verifies skipped count and error array |
| `bulkInsertDiseases skips entries with invalid constant` | Constant validation in bulk | Mocks entry with constant >100, verifies skipped and error reason |
| `bulkInsertDiseases handles existing diseases by reusing ID` | Duplicate disease handling | Mocks `db.get` (disease exists), verifies reuse of existing ID |
| `bulkInsertDiseases skips duplicate gene symbols` | Duplicate gene detection | Mocks `db.get` (gene exists), verifies skipped and error reason |

**Key Testing Approach**:
- **Mocks**: `db.run`, `db.get`, `db.all`
- Tests verify validation logic, SQL execution, and bulk operation error handling
- Hash function tested without mocks (pure function)

---

### 4. **psiService.test.js** (3 tests)
**Purpose**: Test Private Set Intersection (PSI) computation for secure gene matching

#### Test Cases:

| Test | What It Tests | How It's Tested |
|------|---------------|-----------------|
| `hashItem returns BigInt modulo Q` | Gene hashing | Calls `hashItem('BRCA1')`, verifies BigInt return type |
| `modExp computes power modulo` | Modular exponentiation | Tests `5^3 mod 13 = 8`, verifies correct result |
| `compute returns blinded sets` | PSI computation | Passes blinded patient list and disease genes, verifies output structure and array lengths |

**Key Testing Approach**:
- **No mocking** (pure mathematical functions)
- Tests verify BigInt operations, modular arithmetic, and output structure
- PSI computation tested with sample data to verify correct blinding

---

### 5. **riskAssessmentService.test.js** (4 tests)
**Purpose**: Test risk assessment storage and retrieval with encryption

#### Test Cases:

| Test | What It Tests | How It's Tested |
|------|---------------|-----------------|
| `createAssessment encrypts fields and inserts row` | Assessment creation | Mocks `db.run` and `encryptionService`, verifies encryption called and assessment returned |
| `getAssessmentsByUser decrypts stored fields` | Assessment retrieval with decryption | Mocks `db.all` with encrypted data, verifies decryption called and plain values returned |
| `getAssessmentById decrypts single assessment` | Single assessment retrieval | Mocks `db.get` with encrypted data, verifies decryption and correct structure |
| `deleteAssessment returns boolean based on db.run changes` | Assessment deletion | Mocks `db.run` with `changes: 1` and `changes: 0`, verifies boolean return |

**Key Testing Approach**:
- **Mocks**: `db.run`, `db.get`, `db.all`, `encryptionService` (all methods)
- Tests verify encryption on write, decryption on read, and deletion success/failure
- Mock encryption service returns prefixed strings (e.g., `enc:80`) for easy verification

---

### 6. **middleware.test.js** (4 tests)
**Purpose**: Test Express middleware (authentication and CORS)

#### Test Cases:

| Test | What It Tests | How It's Tested |
|------|---------------|-----------------|
| `rejects when X-Role header missing` | Authentication failure | Creates mock req/res/next, calls middleware, verifies 401 response and next not called |
| `allows mapped admin role` | Role mapping | Sets `X-Role: system_admin`, verifies mapped to `admin` and `req.context` set |
| `sets CORS headers for allowed origin` | CORS header setting | Creates mock req/res with origin, calls middleware, verifies headers set and next called |
| `responds to OPTIONS with 204` | Preflight request handling | Sets method to OPTIONS, verifies 204 status, end() called, next not called |

**Key Testing Approach**:
- **No mocking** (tests middleware directly)
- Creates mock Express request/response objects
- Tests verify HTTP status codes, headers, and middleware chain (next() called/not called)

---

## Test Statistics

| Service | Test Count | Lines of Code | Coverage Focus |
|---------|------------|---------------|----------------|
| encryptionService | 18 | 141 | Security, legacy data compatibility |
| userService | 16 | 231 | CRUD, authentication, data conversion |
| diseaseService | 15 | 280 | Validation, bulk operations, gene management |
| psiService | 3 | 33 | Mathematical operations, PSI protocol |
| riskAssessmentService | 4 | 108 | Encryption integration, CRUD |
| middleware | 4 | 83 | HTTP middleware, role mapping |
| **TOTAL** | **60** | **876** | **Core business logic & security** |

---

## Testing Patterns Used

### 1. **Mocking External Dependencies**
```javascript
jest.mock('../../DBMS/db/db', () => ({
  run: jest.fn(),
  get: jest.fn(),
  all: jest.fn(),
}));
```
- Prevents real database calls
- Allows control over return values
- Verifies function calls

### 2. **Async/Await Testing**
```javascript
test('createUser hashes password', async () => {
  db.run.mockResolvedValue({});
  const result = await userService.createUser({...});
  expect(result).toHaveProperty('id');
});
```
- All database operations are async
- Tests use `async/await` or `.resolves/.rejects`

### 3. **Error Testing**
```javascript
await expect(
  userService.authenticateUser('deleted@example.com', 'password')
).rejects.toThrow('This account has been deleted');
```
- Tests verify errors are thrown with correct messages

### 4. **Data Transformation Testing**
```javascript
expect(user.research_consent).toBe(false); // Should convert 0 to false
```
- Tests verify database integers (0/1) ↔ JavaScript booleans

### 5. **SQL Verification**
```javascript
expect(db.run).toHaveBeenCalledWith(
  expect.stringContaining('DELETE FROM users'),
  ['1']
);
```
- Tests verify correct SQL is generated and parameters passed

---

## Running the Tests

### Command
```bash
cd BackEnd/Server
npm test
```

### Expected Output
```
PASS  __tests__/encryptionService.test.js
PASS  __tests__/userService.test.js
PASS  __tests__/diseaseService.test.js
PASS  __tests__/psiService.test.js
PASS  __tests__/riskAssessmentService.test.js
PASS  __tests__/middleware.test.js

Test Suites: 6 passed, 6 total
Tests:       60 passed, 60 total
```

---

## Key Testing Principles Applied

1. **Isolation**: Each test is independent, mocks are cleared between tests
2. **Fast Execution**: No real database, all operations are mocked
3. **Comprehensive Coverage**: Tests cover happy paths, error cases, edge cases, and data transformations
4. **Security Focus**: Encryption service thoroughly tested (critical for sensitive genetic data)
5. **Real-world Scenarios**: Tests simulate actual usage patterns (e.g., bulk CSV import, legacy data handling)

---


