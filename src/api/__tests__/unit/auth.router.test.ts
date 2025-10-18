import request from "supertest";
import app from "../../src/server";

import {
  CognitoIdentityProviderClient
} from "@aws-sdk/client-cognito-identity-provider";

import { SESv2Client } from "@aws-sdk/client-sesv2";

const authResult = () => ({
  AccessToken: "mock-access-token-123",
  IdToken: "mock-id-token-abc",
  RefreshToken: "mock-refresh-token-xyz",
  TokenType: "Bearer",
  ExpiresIn: 3600,
});

const isCmd = (cmd: unknown, name: string) =>
  Boolean(cmd) && (cmd as any).constructor?.name === name;

let cognitoSendSpy: jest.SpyInstance;
let sesSendSpy: jest.SpyInstance;

beforeAll(() => {
  // Spy on AWS SDK v3 client.send for Cognito and SES
  cognitoSendSpy = jest.spyOn(CognitoIdentityProviderClient.prototype, "send");
  sesSendSpy = jest.spyOn(SESv2Client.prototype, "send");
});

afterAll(() => {
  cognitoSendSpy.mockRestore();
  sesSendSpy.mockRestore();
});

beforeEach(() => {
  jest.clearAllMocks();
});

/**
 * INVITE USER
 */
describe("Auth Router - inviteUser", () => {
  it("invites NEW user: AdminGetUser -> UserNotFoundException, then AdminCreateUser, then SES email (200)", async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, "AdminGetUserCommand")) {
        const err = new Error("No such user");
        (err as any).name = "UserNotFoundException";
        throw err;
      }
      if (isCmd(command, "AdminCreateUserCommand")) {
        return {}; // created ok
      }
      return {};
    });

    sesSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, "SendEmailCommand")) {
        return {}; // email ok
      }
      return {};
    });

    const res = await request(app)
      .post("/trpc/inviteUser")
      .set("Content-Type", "application/json")
      .send({ email: "test@example.com" });

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      success: true,
      userEmail: "test@example.com",
      message:
        "User invited successfully - a custom SES email with credentials was sent.",
    });

    expect(
      cognitoSendSpy.mock.calls.some(([cmd]) =>
        isCmd(cmd, "AdminGetUserCommand")
      )
    ).toBe(true);
    expect(
      cognitoSendSpy.mock.calls.some(([cmd]) =>
        isCmd(cmd, "AdminCreateUserCommand")
      )
    ).toBe(true);
    expect(
      sesSendSpy.mock.calls.some(([cmd]) => isCmd(cmd, "SendEmailCommand"))
    ).toBe(true);
  });

  it("re-invites EXISTING user: AdminGetUser OK, AdminSetUserPassword OK, SES email OK (200)", async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, "AdminGetUserCommand")) {
        return { Username: "existing@example.com" }; // exists
      }
      if (isCmd(command, "AdminSetUserPasswordCommand")) {
        return {}; // reset ok
      }
      return {};
    });

    sesSendSpy.mockResolvedValue({});

    const res = await request(app)
      .post("/trpc/inviteUser")
      .set("Content-Type", "application/json")
      .send({ email: "existing@example.com" });

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      success: true,
      userEmail: "existing@example.com",
    });

    expect(
      cognitoSendSpy.mock.calls.some(([cmd]) =>
        isCmd(cmd, "AdminGetUserCommand")
      )
    ).toBe(true);
    expect(
      cognitoSendSpy.mock.calls.some(([cmd]) =>
        isCmd(cmd, "AdminSetUserPasswordCommand")
      )
    ).toBe(true);
    expect(
      sesSendSpy.mock.calls.some(([cmd]) => isCmd(cmd, "SendEmailCommand"))
    ).toBe(true);
  });

  it("invalid email -> 400 from Zod", async () => {
    const res = await request(app)
      .post("/trpc/inviteUser")
      .set("Content-Type", "application/json")
      .send({ email: "not-an-email" });

    expect(res.status).toBe(400);
  });
});

/**
 * SIGN IN
 */
describe("Auth Router - signIn", () => {
  it("first-time login challenge -> 200 with NEW_PASSWORD_REQUIRED", async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, "AdminInitiateAuthCommand")) {
        return {
          ChallengeName: "NEW_PASSWORD_REQUIRED",
          Session: "mock-session-token-12345",
          ChallengeParameters: {},
        };
      }
      return {};
    });

    const res = await request(app)
      .post("/trpc/signIn")
      .set("Content-Type", "application/json")
      .send({
        email: "test@example.com",
        password: "TempPassword1!", // >= 12 chars per zod
      });

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      success: false,
      challengeName: "NEW_PASSWORD_REQUIRED",
      session: "mock-session-token-12345",
    });
  });

  it("successful authentication -> 200 with tokens and sets cookies", async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, "AdminInitiateAuthCommand")) {
        return { AuthenticationResult: authResult() };
      }
      return {};
    });

    const res = await request(app)
      .post("/trpc/signIn")
      .set("Content-Type", "application/json")
      .send({
        email: "test@example.com",
        password: "ValidPassword12!",
      });

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      success: true,
      accessToken: expect.stringContaining("mock-access-token"),
      idToken: expect.stringContaining("mock-id-token"),
      refreshToken: expect.stringContaining("mock-refresh-token"),
      tokenType: "Bearer",
      expiresIn: 3600,
    });

    // Verify cookies set
    const setCookie = res.headers["set-cookie"] ?? [];
    expect(Array.isArray(setCookie)).toBe(true);
    const cookieStr = setCookie.join(";");
    expect(cookieStr).toContain("auth_access=");
    expect(cookieStr).toContain("auth_id=");
    expect(cookieStr).toContain("auth_refresh=");
  });

  it("invalid credentials -> 500 with NotAuthorizedException mapped message", async () => {
    const err = new Error("bad creds");
    (err as any).name = "NotAuthorizedException";
    cognitoSendSpy.mockRejectedValueOnce(err);

    const res = await request(app)
      .post("/trpc/signIn")
      .set("Content-Type", "application/json")
      .send({
        email: "test@example.com",
        password: "WrongPassword12!",
      });

    // tRPC maps thrown errors to 500 by default in this setup
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).toMatch(/Invalid email or password/);
  });
});

/**
 * RESPOND TO CHALLENGE
 */
describe("Auth Router - respondToChallenge", () => {
  it("completes NEW_PASSWORD_REQUIRED and returns tokens (200)", async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, "AdminRespondToAuthChallengeCommand")) {
        return { AuthenticationResult: authResult() };
      }
      return {};
    });

    const res = await request(app)
      .post("/trpc/respondToChallenge")
      .set("Content-Type", "application/json")
      .send({
        challengeName: "NEW_PASSWORD_REQUIRED",
        session: "mock-session",
        newPassword: "NewPassword123!",
        email: "test@example.com",
      });

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toMatchObject({
      success: true,
      accessToken: expect.stringContaining("mock-access-token"),
      message: "Password updated and sign in successful",
    });

    // cookies set as well
    const setCookie = res.headers["set-cookie"] ?? [];
    expect(Array.isArray(setCookie)).toBe(true);
    const cookieStr = setCookie.join(";");
    expect(cookieStr).toContain("auth_access=");
    expect(cookieStr).toContain("auth_id=");
    expect(cookieStr).toContain("auth_refresh=");
  });
});

/**
 * ME
 */
describe("Auth Router - me", () => {
  it("returns authenticated=false when no session cookies", async () => {
    const res = await request(app)
      .get("/trpc/me")
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toEqual({
      authenticated: false,
      message: "No session",
    });
  });

  it("returns authenticated=true when any auth cookie is present", async () => {
    const res = await request(app)
      .get("/trpc/me")
      .set("Cookie", ["auth_access=fake-access"]) // could use auth_id or auth_refresh too
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toEqual({
      authenticated: true,
      message: "User session found",
    });
  });
});

/**
 * REFRESH
 */
describe("Auth Router - refresh", () => {
  it("returns refreshed=false when no refresh token cookie", async () => {
    const res = await request(app)
      .post("/trpc/refresh")
      .set("Content-Type", "application/json")
      .send({});

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toEqual({
      refreshed: false,
      message: "No refresh token",
    });

    // No Cognito calls made
    expect(
      cognitoSendSpy.mock.calls.some(([cmd]) => isCmd(cmd, "InitiateAuthCommand"))
    ).toBe(false);
  });

  it("calls Cognito InitiateAuth and sets cookies when refresh succeeds", async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, "InitiateAuthCommand")) {
        return { AuthenticationResult: authResult() };
      }
      return {};
    });

    const res = await request(app)
      .post("/trpc/refresh")
      .set("Cookie", ["auth_refresh=mock-refresh-token-xyz"])
      .set("Content-Type", "application/json")
      .send({});

    expect(res.status).toBe(200);
    expect(
      cognitoSendSpy.mock.calls.some(([cmd]) => isCmd(cmd, "InitiateAuthCommand"))
    ).toBe(true);

    // Body
    expect(res.body?.result?.data).toMatchObject({
      refreshed: true,
      expiresIn: 3600,
    });

    // Cookies should be (re)set for access/id (refresh is not reissued here)
    const setCookie = res.headers["set-cookie"] ?? [];
    expect(Array.isArray(setCookie)).toBe(true);
    const cookieStr = setCookie.join(";");
    expect(cookieStr).toContain("auth_access=");
    expect(cookieStr).toContain("auth_id=");
  });

  it("returns refreshed=false when Cognito responds without AuthenticationResult", async () => {
    cognitoSendSpy.mockImplementation(async (command: any) => {
      if (isCmd(command, "InitiateAuthCommand")) {
        return {}; // no AuthenticationResult
      }
      return {};
    });

    const res = await request(app)
      .post("/trpc/refresh")
      .set("Cookie", ["auth_refresh=mock-refresh-token-xyz"])
      .set("Content-Type", "application/json")
      .send({});

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toEqual({
      refreshed: false,
      message: "Token refresh failed",
    });

    // No cookies set on failure
    const setCookie = res.headers["set-cookie"] ?? [];
    expect(setCookie?.length ?? 0).toBe(0);
  });
});

/**
 * LOGOUT
 */
describe("Auth Router - logout", () => {
  it("clears auth cookies and returns success", async () => {
    const res = await request(app)
      .post("/trpc/logout")
      .set("Cookie", ["auth_access=aaa", "auth_id=bbb", "auth_refresh=ccc"])
      .set("Content-Type", "application/json")
      .send({});

    expect(res.status).toBe(200);
    expect(res.body?.result?.data).toEqual({
      success: true,
      message: "Signed out",
    });

    // Expect cookies cleared (typically empty with past expiration)
    const setCookie = res.headers["set-cookie"] ?? [];
    expect(Array.isArray(setCookie)).toBe(true);
    const cookieStr = setCookie.join(";");
    expect(cookieStr).toContain("auth_access=");
    expect(cookieStr).toContain("auth_id=");
    expect(cookieStr).toContain("auth_refresh=");
  });
});
