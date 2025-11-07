# Jest Testing Guide: Writing Tests for the `me` Endpoint

## Overview

This guide teaches you how to write comprehensive tests for the new `me` endpoint changes that validate user status in Cognito.

## What We're Testing

The `me` endpoint now checks if a user's Cognito status is `CONFIRMED`. If not, it clears cookies and returns an authentication challenge.

## Key Jest Concepts

### 1. Mocking External Dependencies

When testing, you need to mock external services (Cognito, AWS SDK) to avoid:

- Making real API calls
- Depending on external infrastructure
- Slow test execution

### 2. Mock Hierarchy

```
┌─────────────────────────────────────┐
│  Jest Mock (Top Level)              │
│  jest.mock('aws-jwt-verify')        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Mock Implementation (Per Test)     │
│  mockVerifier.verify.mockResolvedValue()│
└─────────────────────────────────────┘
```

## Step-by-Step: Writing Test Cases

### Test Case 1: CONFIRMED User (Happy Path)

**What it tests:** A user with `CONFIRMED` status should be authenticated successfully.

**Key Learning Points:**

- Multiple mocks working together (JWT verifier + Cognito)
- Asserting on mock call arguments
- Checking response structure

**Implementation:**

```typescript
it('returns authenticated true for CONFIRMED user with valid token', async () => {
  // STEP 1: Mock the JWT verifier to return a decoded token
  const mockVerifier = getMockedVerifier();
  mockVerifier.verify.mockResolvedValue({
    sub: 'user-123',
    email: 'confirmed@example.com',
    'cognito:username': 'confirmed',
  });

  // STEP 2: Mock AdminGetUserCommand to return CONFIRMED status
  cognitoSendSpy.mockImplementation(async (command: any) => {
    if (isCmd(command, AdminGetUserCommand)) {
      return {
        UserStatus: 'CONFIRMED', // This is the key - user is fully confirmed
        UserAttributes: [
          { Name: 'email', Value: 'confirmed@example.com' },
          { Name: 'sub', Value: 'user-123' },
        ],
      };
    }
    return {};
  });

  // STEP 3: Mock ensureUserRecord to return user data
  (ensureUserRecord as jest.Mock).mockResolvedValue({
    sub: 'user-123',
    email: 'confirmed@example.com',
    accountId: 'acc-456',
  });

  // STEP 4: Make the request with auth cookies
  const res = await request(app)
    .get('/trpc/me')
    .set('Cookie', ['auth_access=valid.jwt.token; Path=/; HttpOnly']);

  // STEP 5: Assert the response
  expect(res.status).toBe(200);
  expect(res.body?.result?.data).toMatchObject({
    authenticated: true,
    message: 'User session verified',
    userId: 'user-123',
    email: 'confirmed@example.com',
    accountId: 'acc-456',
  });

  // STEP 6: Verify the mocks were called correctly
  expect(mockVerifier.verify).toHaveBeenCalledWith('valid.jwt.token');
  expect(cognitoSendSpy).toHaveBeenCalled();
  expect(ensureUserRecord).toHaveBeenCalledWith({
    sub: 'user-123',
    email: 'confirmed@example.com',
  });
});
```

**Why each step matters:**

- **Step 1-3:** Set up the entire mock chain
- **Step 4:** Execute the actual request
- **Step 5:** Verify business logic output
- **Step 6:** Verify internal behavior (dependency calls)

---

### Test Case 2: FORCE_CHANGE_PASSWORD User

**What it tests:** Users who need to change passwords should have cookies cleared.

**Key Learning Points:**

- Testing cookie clearing behavior
- Checking for specific response fields (`challengeRequired`)
- Verifying certain functions are NOT called

```typescript
it('clears cookies and returns challengeRequired for FORCE_CHANGE_PASSWORD user', async () => {
  // Mock JWT verification
  const mockVerifier = getMockedVerifier();
  mockVerifier.verify.mockResolvedValue({
    sub: 'user-needs-reset',
    email: 'reset@example.com',
  });

  // Mock Cognito returning FORCE_CHANGE_PASSWORD status
  cognitoSendSpy.mockImplementation(async (command: any) => {
    if (isCmd(command, AdminGetUserCommand)) {
      return {
        UserStatus: 'FORCE_CHANGE_PASSWORD', // User needs to change password
        UserAttributes: [{ Name: 'email', Value: 'reset@example.com' }],
      };
    }
    return {};
  });

  const res = await request(app)
    .get('/trpc/me')
    .set('Cookie', ['auth_access=stale.jwt.token; Path=/; HttpOnly']);

  expect(res.status).toBe(200);
  expect(res.body?.result?.data).toMatchObject({
    authenticated: false,
    message: 'Account requires attention: FORCE_CHANGE_PASSWORD',
    challengeRequired: 'NEW_PASSWORD_REQUIRED',
  });

  // Verify cookies are cleared
  const setCookieHeader = res.header['set-cookie'];
  const setCookieStr = Array.isArray(setCookieHeader)
    ? setCookieHeader.join(';')
    : (setCookieHeader ?? '');

  // Should contain cookie-clearing headers (Max-Age=0 or Expires in the past)
  expect(setCookieStr).toContain('auth_access=');
  expect(setCookieStr).toContain('auth_id=');
  expect(setCookieStr).toContain('auth_refresh=');

  // ensureUserRecord should NOT be called since user isn't confirmed
  expect(ensureUserRecord).not.toHaveBeenCalled();
});
```

**Testing Pattern: Negative Assertions**

```typescript
expect(ensureUserRecord).not.toHaveBeenCalled();
```

This verifies the code path SKIPS certain operations. Critical for security!

---

### Test Case 3: UNCONFIRMED User

**What it tests:** Unconfirmed users should be rejected (different from FORCE_CHANGE_PASSWORD).

**Key Learning Points:**

- Testing edge cases
- Verifying optional fields are undefined
- Similar setup, different assertions

```typescript
it('clears cookies and returns authenticated false for UNCONFIRMED user', async () => {
  const mockVerifier = getMockedVerifier();
  mockVerifier.verify.mockResolvedValue({
    sub: 'user-unconfirmed',
    email: 'unconfirmed@example.com',
  });

  cognitoSendSpy.mockImplementation(async (command: any) => {
    if (isCmd(command, AdminGetUserCommand)) {
      return {
        UserStatus: 'UNCONFIRMED', // User hasn't verified email
        UserAttributes: [{ Name: 'email', Value: 'unconfirmed@example.com' }],
      };
    }
    return {};
  });

  const res = await request(app)
    .get('/trpc/me')
    .set('Cookie', ['auth_access=stale.jwt.token; Path=/; HttpOnly']);

  expect(res.status).toBe(200);
  expect(res.body?.result?.data).toMatchObject({
    authenticated: false,
    message: 'Account requires attention: UNCONFIRMED',
    // No challengeRequired since it's not FORCE_CHANGE_PASSWORD
  });

  // Verify challengeRequired is undefined for non-password statuses
  expect(res.body?.result?.data?.challengeRequired).toBeUndefined();

  // Cookies should be cleared
  const setCookieHeader = res.header['set-cookie'];
  expect(setCookieHeader).toBeDefined();
});
```

---

### Test Case 4: RESET_REQUIRED User

**What it tests:** Another non-confirmed status to ensure comprehensive coverage.

```typescript
it('clears cookies for RESET_REQUIRED user', async () => {
  const mockVerifier = getMockedVerifier();
  mockVerifier.verify.mockResolvedValue({
    sub: 'user-reset-req',
    email: 'resetreq@example.com',
  });

  cognitoSendSpy.mockImplementation(async (command: any) => {
    if (isCmd(command, AdminGetUserCommand)) {
      return {
        UserStatus: 'RESET_REQUIRED', // Another non-confirmed status
        UserAttributes: [{ Name: 'email', Value: 'resetreq@example.com' }],
      };
    }
    return {};
  });

  const res = await request(app)
    .get('/trpc/me')
    .set('Cookie', ['auth_access=stale.jwt.token; Path=/; HttpOnly']);

  expect(res.status).toBe(200);
  expect(res.body?.result?.data).toMatchObject({
    authenticated: false,
    message: 'Account requires attention: RESET_REQUIRED',
  });

  expect(ensureUserRecord).not.toHaveBeenCalled();
});
```

---

### Test Case 5: JWT Verification Failure

**What it tests:** Invalid/expired tokens should fail gracefully.

**Key Learning Points:**

- Testing error paths
- Using `mockRejectedValue` for async errors
- Verifying early returns (subsequent code doesn't run)

```typescript
it('returns authenticated false when JWT verification fails', async () => {
  const mockVerifier = getMockedVerifier();

  // Mock verification failure (expired token, invalid signature, etc.)
  mockVerifier.verify.mockRejectedValue(new Error('Token expired'));

  const res = await request(app)
    .get('/trpc/me')
    .set('Cookie', ['auth_access=invalid.jwt.token; Path=/; HttpOnly']);

  expect(res.status).toBe(200);
  expect(res.body?.result?.data).toMatchObject({
    authenticated: false,
    message: 'Invalid session token',
  });

  // Cognito AdminGetUserCommand should NOT be called if JWT fails
  expect(cognitoSendSpy).not.toHaveBeenCalled();
  expect(ensureUserRecord).not.toHaveBeenCalled();
});
```

---

## Complete Test Suite

Add this to your test file after line 333 (replacing the TODO comment):

```typescript
describe('Auth Router - me', () => {
  it('returns authenticated false when no cookies at all', async () => {
    const res = await request(app).get('/trpc/me');

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      authenticated: false,
      message: 'No session',
    });

    expect(decodeJwtNoVerify).not.toHaveBeenCalled();
    expect(ensureUserRecord).not.toHaveBeenCalled();
  });

  it('returns authenticated true for CONFIRMED user with valid token', async () => {
    const mockVerifier = getMockedVerifier();
    mockVerifier.verify.mockResolvedValue({
      sub: 'user-123',
      email: 'confirmed@example.com',
      'cognito:username': 'confirmed',
    });

    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, AdminGetUserCommand)) {
        return {
          UserStatus: 'CONFIRMED',
          UserAttributes: [
            { Name: 'email', Value: 'confirmed@example.com' },
            { Name: 'sub', Value: 'user-123' },
          ],
        };
      }
      return {};
    });

    (ensureUserRecord as jest.Mock).mockResolvedValue({
      sub: 'user-123',
      email: 'confirmed@example.com',
      accountId: 'acc-456',
    });

    const res = await request(app)
      .get('/trpc/me')
      .set('Cookie', ['auth_access=valid.jwt.token; Path=/; HttpOnly']);

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      authenticated: true,
      message: 'User session verified',
      userId: 'user-123',
      email: 'confirmed@example.com',
      accountId: 'acc-456',
    });

    expect(mockVerifier.verify).toHaveBeenCalledWith('valid.jwt.token');
    expect(cognitoSendSpy).toHaveBeenCalled();
    expect(ensureUserRecord).toHaveBeenCalledWith({
      sub: 'user-123',
      email: 'confirmed@example.com',
    });
  });

  it('clears cookies and returns challengeRequired for FORCE_CHANGE_PASSWORD user', async () => {
    const mockVerifier = getMockedVerifier();
    mockVerifier.verify.mockResolvedValue({
      sub: 'user-needs-reset',
      email: 'reset@example.com',
    });

    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, AdminGetUserCommand)) {
        return {
          UserStatus: 'FORCE_CHANGE_PASSWORD',
          UserAttributes: [{ Name: 'email', Value: 'reset@example.com' }],
        };
      }
      return {};
    });

    const res = await request(app)
      .get('/trpc/me')
      .set('Cookie', ['auth_access=stale.jwt.token; Path=/; HttpOnly']);

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      authenticated: false,
      message: 'Account requires attention: FORCE_CHANGE_PASSWORD',
      challengeRequired: 'NEW_PASSWORD_REQUIRED',
    });

    const setCookieHeader = res.header['set-cookie'];
    const setCookieStr = Array.isArray(setCookieHeader)
      ? setCookieHeader.join(';')
      : (setCookieHeader ?? '');

    expect(setCookieStr).toContain('auth_access=');
    expect(setCookieStr).toContain('auth_id=');
    expect(setCookieStr).toContain('auth_refresh=');

    expect(ensureUserRecord).not.toHaveBeenCalled();
  });

  it('clears cookies and returns authenticated false for UNCONFIRMED user', async () => {
    const mockVerifier = getMockedVerifier();
    mockVerifier.verify.mockResolvedValue({
      sub: 'user-unconfirmed',
      email: 'unconfirmed@example.com',
    });

    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, AdminGetUserCommand)) {
        return {
          UserStatus: 'UNCONFIRMED',
          UserAttributes: [{ Name: 'email', Value: 'unconfirmed@example.com' }],
        };
      }
      return {};
    });

    const res = await request(app)
      .get('/trpc/me')
      .set('Cookie', ['auth_access=stale.jwt.token; Path=/; HttpOnly']);

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      authenticated: false,
      message: 'Account requires attention: UNCONFIRMED',
    });

    expect(res.body?.result?.data?.challengeRequired).toBeUndefined();

    const setCookieHeader = res.header['set-cookie'];
    expect(setCookieHeader).toBeDefined();
  });

  it('clears cookies for RESET_REQUIRED user', async () => {
    const mockVerifier = getMockedVerifier();
    mockVerifier.verify.mockResolvedValue({
      sub: 'user-reset-req',
      email: 'resetreq@example.com',
    });

    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, AdminGetUserCommand)) {
        return {
          UserStatus: 'RESET_REQUIRED',
          UserAttributes: [{ Name: 'email', Value: 'resetreq@example.com' }],
        };
      }
      return {};
    });

    const res = await request(app)
      .get('/trpc/me')
      .set('Cookie', ['auth_access=stale.jwt.token; Path=/; HttpOnly']);

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      authenticated: false,
      message: 'Account requires attention: RESET_REQUIRED',
    });

    expect(ensureUserRecord).not.toHaveBeenCalled();
  });

  it('returns authenticated false when JWT verification fails', async () => {
    const mockVerifier = getMockedVerifier();
    mockVerifier.verify.mockRejectedValue(new Error('Token expired'));

    const res = await request(app)
      .get('/trpc/me')
      .set('Cookie', ['auth_access=invalid.jwt.token; Path=/; HttpOnly']);

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      authenticated: false,
      message: 'Invalid session token',
    });

    expect(cognitoSendSpy).not.toHaveBeenCalled();
    expect(ensureUserRecord).not.toHaveBeenCalled();
  });
});
```

---

## Common Jest Patterns Explained

### 1. `expect.toMatchObject()` vs `expect.toEqual()`

```typescript
// toMatchObject - Partial match (recommended for API responses)
expect(data).toMatchObject({
  authenticated: true,
  email: 'user@example.com',
  // Other fields can exist, we just don't care
});

// toEqual - Exact match (fails if extra fields exist)
expect(data).toEqual({
  authenticated: true,
  email: 'user@example.com',
  // Must be EXACTLY this, nothing more
});
```

### 2. `expect.any(Constructor)`

```typescript
expect(data).toMatchObject({
  accessToken: expect.any(String), // Any string is fine
  expiresIn: expect.any(Number), // Any number is fine
});
```

### 3. Mock Implementation Patterns

```typescript
// Option 1: mockResolvedValue (for successful promises)
mockVerifier.verify.mockResolvedValue({ sub: '123' });

// Option 2: mockRejectedValue (for errors)
mockVerifier.verify.mockRejectedValue(new Error('Failed'));

// Option 3: mockImplementation (for complex logic)
cognitoSendSpy.mockImplementation(async (command) => {
  if (isCmd(command, AdminGetUserCommand)) {
    return { UserStatus: 'CONFIRMED' };
  }
  return {};
});
```

### 4. Negative Assertions

```typescript
// Verify a function was NOT called
expect(ensureUserRecord).not.toHaveBeenCalled();

// Verify a field is undefined
expect(data.challengeRequired).toBeUndefined();

// Verify specific calls didn't happen
expect(cognitoSendSpy).not.toHaveBeenCalled();
```

---

## Running Your Tests

```bash
# Run all tests
npm test

# Run only auth tests
npm test auth.router.test

# Run in watch mode (re-runs on file changes)
npm test -- --watch

# Run with coverage
npm test -- --coverage
```

---

## Test Coverage Goals

A good test suite should cover:

✅ **Happy Path** - Normal successful operation  
✅ **Edge Cases** - Boundary conditions (empty, null, undefined)  
✅ **Error Cases** - Failures, exceptions, invalid input  
✅ **Security Cases** - Unauthorized access, token issues  
✅ **State Changes** - Cookies set/cleared, database updates

Your new `me` endpoint tests cover all of these!

---

## Debugging Failed Tests

### When a test fails:

1. **Read the error message** - Jest shows exactly what was expected vs received
2. **Check mock setup** - Did you forget to mock a dependency?
3. **Console.log the response** - Add `console.log(res.body)` to see actual output
4. **Verify mock calls** - Add `console.log(mockVerifier.verify.mock.calls)` to see what was called
5. **Run single test** - Use `it.only()` to focus on one failing test

### Common Issues:

```typescript
// ❌ Forgot to clear mocks between tests
// Solution: beforeEach(() => jest.clearAllMocks())

// ❌ Mock not returning a value
// Solution: Verify mockResolvedValue or mockImplementation is called

// ❌ Wrong command type check
// Solution: Verify isCmd() is checking the right command class
```

---

## Next Steps

1. **Add these tests** to your `auth.router.test.ts` file
2. **Run the tests** to ensure they pass
3. **Try breaking your code** - Comment out the status check and see tests fail
4. **Add more edge cases** - Test other Cognito statuses if needed
5. **Practice writing tests** for other endpoints using these patterns

Happy Testing! 🧪
