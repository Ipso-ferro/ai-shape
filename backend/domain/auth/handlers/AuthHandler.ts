import { randomBytes, randomUUID } from "crypto";
import { AddNewUserCommand } from "../../user/command/AddNewUserCommand";
import { GetDataUserQuery } from "../../user/queries/GetDataUserQuery";
import { RepositoryUser } from "../../user/repositories/RepositoryUser";
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from "../../share/Errors/AppErrors";
import { PasswordHasherService } from "../../user/handlers/services/PasswordHasherService";
import { AuthSession, AuthTokenPayload } from "../models/AuthSession";
import { LoginUserCommand } from "../command/LoginUserCommand";
import { GoogleAuthCommand } from "../command/GoogleAuthCommand";
import { SessionTokenService } from "./services/SessionTokenService";
import { GoogleIdentityService } from "./services/GoogleIdentityService";

export class AuthHandler {
  constructor(
    private readonly repositoryUser: RepositoryUser,
    private readonly passwordHasherService = new PasswordHasherService(),
    private readonly sessionTokenService = new SessionTokenService(),
    private readonly googleIdentityService = new GoogleIdentityService(),
  ) {}

  async register(command: AddNewUserCommand): Promise<AuthSession> {
    this.assertEmail(command.email);
    this.assertPassword(command.password);

    const userId = randomUUID();
    const passwordHash = await this.passwordHasherService.hash(command.password);

    await this.repositoryUser.addNewUser({
      id: userId,
      email: command.email.trim().toLowerCase(),
      passwordHash,
      isPro: false,
    });

    const user = await this.getUser({ id: userId });

    return this.sessionTokenService.issueSession(user, {
      email: command.email.trim().toLowerCase(),
      provider: "password",
    });
  }

  async login(command: LoginUserCommand): Promise<AuthSession> {
    this.assertEmail(command.email);
    this.assertPassword(command.password);

    const credentials = await this.repositoryUser.getUserCredentialsByEmail({
      email: command.email.trim().toLowerCase(),
    });

    if (!credentials) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    const passwordMatches = await this.passwordHasherService.compare(
      command.password,
      credentials.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    const user = await this.getUser({ id: credentials.id });

    return this.sessionTokenService.issueSession(user, {
      email: credentials.email,
      provider: credentials.googleSub ? "google" : "password",
    });
  }

  async authenticateWithGoogle(command: GoogleAuthCommand): Promise<AuthSession> {
    const googlePayload = await this.googleIdentityService.verifyIdToken(command.idToken);
    const email = googlePayload.email?.trim().toLowerCase();
    const googleSub = googlePayload.sub?.trim();

    if (!email || !googleSub) {
      throw new ValidationError("Google sign-in payload is invalid.");
    }

    const credentials = await this.repositoryUser.getUserCredentialsByEmail({ email });

    if (!credentials) {
      const passwordHash = await this.passwordHasherService.hash(randomBytes(24).toString("hex"));
      const userId = randomUUID();

      await this.repositoryUser.addNewUser({
        id: userId,
        email,
        passwordHash,
        isPro: false,
      });
      await this.repositoryUser.saveUserGoogleSub(userId, googleSub);

      const user = await this.getUser({ id: userId });
      return this.sessionTokenService.issueSession(user, {
        email,
        provider: "google",
      });
    }

    if (credentials.googleSub && credentials.googleSub !== googleSub) {
      throw new ConflictError("This email is already linked to a different Google account.");
    }

    if (!credentials.googleSub) {
      await this.repositoryUser.saveUserGoogleSub(credentials.id, googleSub);
    }

    const user = await this.getUser({ id: credentials.id });

    return this.sessionTokenService.issueSession(user, {
      email,
      provider: "google",
    });
  }

  async getSession(payload: AuthTokenPayload): Promise<AuthSession> {
    const user = await this.getUser({ id: payload.sub });
    const credentials = await this.repositoryUser.getUserCredentialsByEmail({
      email: payload.email,
    });

    return {
      token: "",
      expiresAt: this.sessionTokenService.toExpiryIsoString(payload),
      user,
      account: {
        email: payload.email,
        provider: credentials?.googleSub ? "google" : "password",
      },
    };
  }

  verifyToken(token: string): AuthTokenPayload {
    return this.sessionTokenService.verifyToken(token);
  }

  private async getUser(query: GetDataUserQuery) {
    const user = await this.repositoryUser.getDataUser(query);

    if (!user) {
      throw new NotFoundError(`User with id "${query.id}" was not found.`);
    }

    return user;
  }

  private assertEmail(email: string): void {
    if (typeof email !== "string" || email.trim().length === 0) {
      throw new ValidationError('"email" is required.');
    }
  }

  private assertPassword(password: string): void {
    if (typeof password !== "string" || password.trim().length < 6) {
      throw new ValidationError('"password" must be at least 6 characters.');
    }
  }
}
