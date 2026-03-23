import { OAuth2Client, TokenPayload } from "google-auth-library";
import { ValidationError } from "../../../share/Errors/AppErrors";

const resolveGoogleClientId = (): string => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();

  if (!clientId) {
    throw new ValidationError("Google sign-in is not configured.");
  }

  return clientId;
};

export class GoogleIdentityService {
  async verifyIdToken(idToken: string): Promise<TokenPayload> {
    if (typeof idToken !== "string" || idToken.trim().length === 0) {
      throw new ValidationError('"idToken" is required.');
    }

    const clientId = resolveGoogleClientId();
    const client = new OAuth2Client(clientId);

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
  }
}
