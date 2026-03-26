import { createHmac, timingSafeEqual } from "crypto";
import { UnauthorizedError } from "../../../share/Errors/AppErrors";
import { AuthSession, AuthTokenPayload } from "../../models/AuthSession";
import { DataUserCommand } from "../../../user/command/DataUserCommand";

const DEFAULT_TOKEN_TTL_HOURS = 24;
const DEFAULT_TOKEN_SECRET = "ai-shape-dev-token-secret";

const toBase64Url = (value: string): string => (
  Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
);

const fromBase64Url = (value: string): string => {
  const paddedValue = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");

  return Buffer.from(paddedValue, "base64").toString("utf8");
};

const resolveSecret = (): string => (
  process.env.AUTH_TOKEN_SECRET?.trim()
  || process.env.JWT_SECRET?.trim()
  || DEFAULT_TOKEN_SECRET
);

const resolveTtlHours = (): number => {
  const parsed = Number(process.env.AUTH_TOKEN_TTL_HOURS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TOKEN_TTL_HOURS;
};

export class SessionTokenService {
  private readonly secret = resolveSecret();
  private readonly ttlHours = resolveTtlHours();

  issueSession(
    user: DataUserCommand,
    account: AuthSession["account"],
  ): AuthSession {
    const now = Date.now();
    const expiresAt = new Date(now + (this.ttlHours * 60 * 60 * 1000));
    const payload: AuthTokenPayload = {
      sub: user.id,
      email: account.email,
      iat: Math.floor(now / 1000),
      exp: Math.floor(expiresAt.getTime() / 1000),
    };

    return {
      token: this.sign(payload),
      expiresAt: expiresAt.toISOString(),
      user,
      account,
    };
  }

  verifyToken(token: string): AuthTokenPayload {
    const [encodedPayload, signature] = token.split(".");

    if (!encodedPayload || !signature) {
      throw new UnauthorizedError("Invalid session token.");
    }

    const expectedSignature = this.createSignature(encodedPayload);
    const providedBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (
      providedBuffer.length !== expectedBuffer.length
      || !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedError("Invalid session token.");
    }

    let payload: AuthTokenPayload;

    try {
      payload = JSON.parse(fromBase64Url(encodedPayload)) as AuthTokenPayload;
    } catch {
      throw new UnauthorizedError("Invalid session token.");
    }

    if (
      typeof payload.sub !== "string"
      || typeof payload.email !== "string"
      || typeof payload.exp !== "number"
      || typeof payload.iat !== "number"
    ) {
      throw new UnauthorizedError("Invalid session token.");
    }

    if (payload.exp * 1000 <= Date.now()) {
      throw new UnauthorizedError("Session expired.");
    }

    return payload;
  }

  toExpiryIsoString(payload: AuthTokenPayload): string {
    return new Date(payload.exp * 1000).toISOString();
  }

  private sign(payload: AuthTokenPayload): string {
    const encodedPayload = toBase64Url(JSON.stringify(payload));
    const signature = this.createSignature(encodedPayload);

    return `${encodedPayload}.${signature}`;
  }

  private createSignature(encodedPayload: string): string {
    return createHmac("sha256", this.secret)
      .update(encodedPayload)
      .digest("hex");
  }
}
