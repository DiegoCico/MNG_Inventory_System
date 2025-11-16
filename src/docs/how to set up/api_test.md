# API Testing Guide

This guide covers the basics of testing the tRPC API endpoints in this project.

## Quick Start

```bash
# Run all tests (fast, mocked)
npm test

# Run specific test file
npm test auth.router.test.ts

# Run integration tests (slow, costs money)
RUN_INTEGRATION_TESTS=true npm test
```

## tRPC Endpoint Format

All tRPC endpoints follow this pattern:

```
/trpc/{router}.{procedure}
```

### Examples:

- `POST /trpc/auth.inviteUser` - Invite a new user
- `POST /trpc/auth.signIn` - Sign in a user
- `POST /trpc/s3.uploadImage` - Upload an image
- `GET /trpc/hello.hello` - Hello world endpoint

## Request Formats

### POST Requests

For tRPC POST requests, send data directly (no `input` wrapper):

```javascript
await request(app)
  .post('/trpc/auth.inviteUser')
  .send({ email: 'user@example.com' })
  .set('Content-Type', 'application/json');

// WRONG: don't wrap in "input"
await request(app)
  .post('/trpc/auth.inviteUser')
  .send({ input: { email: 'user@example.com' } });
```

### GET Requests

For tRPC GET requests, use query parameters:

```javascript
const input = JSON.stringify({ name: 'world' });
await request(app).get(`/trpc/hello.hello?input=${encodeURIComponent(input)}`);
```

## Test Types

### Unit Tests (`__tests__/unit/`)

- Use mocked AWS services
- No real AWS calls
- Run with `npm test`

### Integration Tests (`__tests__/integration/`)

- Use real AWS services
- AWS charges apply
- Only run with `RUN_INTEGRATION_TESTS=true npm test`
- Test complete workflows
