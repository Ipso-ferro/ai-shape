import test from "node:test";
import assert from "node:assert/strict";
import { OAuth2Client } from "google-auth-library";
import { GoogleIdentityService } from "../../domain/auth/handlers/services/GoogleIdentityService";
import {
  InfrastructureError,
  UnauthorizedError,
  ValidationError,
} from "../../domain/share/Errors/AppErrors";

type VerifyIdTokenStub = (options: unknown) => Promise<{
  getPayload: () => unknown;
}>;

const oauth2Prototype = OAuth2Client.prototype as unknown as {
  verifyIdToken: VerifyIdTokenStub;
};

const withPatchedVerifyIdToken = async (
  implementation: VerifyIdTokenStub,
  run: () => Promise<void>,
): Promise<void> => {
  const originalVerifyIdToken = oauth2Prototype.verifyIdToken;
  const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;

  oauth2Prototype.verifyIdToken = implementation;
  process.env.GOOGLE_CLIENT_ID = "test-google-client-id.apps.googleusercontent.com";

  try {
    await run();
  } finally {
    oauth2Prototype.verifyIdToken = originalVerifyIdToken;

    if (typeof originalGoogleClientId === "string") {
      process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;
    } else {
      delete process.env.GOOGLE_CLIENT_ID;
    }
  }
};

test("GoogleIdentityService maps audience mismatches to a configuration error", async () => {
  await withPatchedVerifyIdToken(
    async () => {
      throw new Error("Wrong recipient, payload audience != requiredAudience");
    },
    async () => {
      const service = new GoogleIdentityService();

      await assert.rejects(
        () => service.verifyIdToken("stub-token"),
        (error: unknown) => {
          assert(error instanceof ValidationError);
          assert.equal(
            error.message,
            "Google sign-in client is misconfigured. Check GOOGLE_CLIENT_ID and VITE_GOOGLE_CLIENT_ID.",
          );
          return true;
        },
      );
    },
  );
});

test("GoogleIdentityService maps invalid Google tokens to an unauthorized error", async () => {
  await withPatchedVerifyIdToken(
    async () => {
      throw new Error("Invalid token signature: stub-token");
    },
    async () => {
      const service = new GoogleIdentityService();

      await assert.rejects(
        () => service.verifyIdToken("stub-token"),
        (error: unknown) => {
          assert(error instanceof UnauthorizedError);
          assert.equal(error.message, "Google sign-in token is invalid or expired.");
          return true;
        },
      );
    },
  );
});

test("GoogleIdentityService maps certificate fetch failures to an infrastructure error", async () => {
  await withPatchedVerifyIdToken(
    async () => {
      throw new Error("Failed to retrieve verification certificates: network unavailable");
    },
    async () => {
      const service = new GoogleIdentityService();

      await assert.rejects(
        () => service.verifyIdToken("stub-token"),
        (error: unknown) => {
          assert(error instanceof InfrastructureError);
          assert.equal(error.message, "Unable to verify Google sign-in right now.");
          return true;
        },
      );
    },
  );
});
