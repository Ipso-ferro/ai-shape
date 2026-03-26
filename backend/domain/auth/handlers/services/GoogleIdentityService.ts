import { OAuth2Client, TokenPayload } from "google-auth-library";
import {
  AppError,
  InfrastructureError,
  UnauthorizedError,
  ValidationError,
} from "../../../share/Errors/AppErrors";

const resolveGoogleClientId = (): string => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();

  if (!clientId) {
    throw new ValidationError("Google sign-in is not configured.");
  }

  return clientId;
};

const googleTokenErrorFragments = [
  "The verifyIdToken method requires an ID Token",
  "Wrong number of segments in token",
  "Can't parse token envelope",
  "Can't parse token payload",
  "No pem found for envelope",
  "Invalid token signature",
  "No issue time in token",
  "No expiration time in token",
  "iat field using invalid format",
  "exp field using invalid format",
  "Expiration time too far in future",
  "Token used too early",
  "Token used too late",
  "Invalid issuer",
];

const isGoogleTokenError = (message: string): boolean => {
  return googleTokenErrorFragments.some((fragment) => message.includes(fragment));
};

export class GoogleIdentityService {
  async verifyIdToken(idToken: string): Promise<TokenPayload> {
    if (typeof idToken !== "string" || idToken.trim().length === 0) {
      throw new ValidationError('"idToken" is required.');
    }

    const clientId = resolveGoogleClientId();
    const client = new OAuth2Client(clientId);

    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId,
      });
      const payload = ticket.getPayload();

      if (!payload?.email || !payload.sub) {
        throw new ValidationError("Google token is missing required identity fields.");
      }

      if (!payload.email_verified) {
        throw new ValidationError("Google account email is not verified.");
      }

      return payload;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.message.includes("Wrong recipient")) {
          throw new ValidationError(
            "Google sign-in client is misconfigured. Check GOOGLE_CLIENT_ID and VITE_GOOGLE_CLIENT_ID.",
          );
        }

        if (error.message.includes("Failed to retrieve verification certificates")) {
          throw new InfrastructureError("Unable to verify Google sign-in right now.");
        }

        if (isGoogleTokenError(error.message)) {
          throw new UnauthorizedError("Google sign-in token is invalid or expired.");
        }
      }

      throw new InfrastructureError("Unable to verify Google sign-in right now.");
    }
  }
}
