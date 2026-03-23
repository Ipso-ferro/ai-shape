import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { ValidationError } from "../../../share/Errors/AppErrors";

const scrypt = promisify(scryptCallback);
const SALT_LENGTH = 16;
const KEY_LENGTH = 64;

export class PasswordHasherService {
  async hash(password: string): Promise<string> {
    if (password.trim().length === 0) {
      throw new ValidationError('"password" is required.');
    }

    const salt = randomBytes(SALT_LENGTH).toString("hex");
    const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;

    return `${salt}:${derivedKey.toString("hex")}`;
  }

  async compare(password: string, passwordHash: string): Promise<boolean> {
    const [salt, storedKey] = passwordHash.split(":");

    if (!salt || !storedKey) {
      return false;
    }

    const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
    const storedBuffer = Buffer.from(storedKey, "hex");

    if (storedBuffer.length !== derivedKey.length) {
      return false;
    }

    return timingSafeEqual(derivedKey, storedBuffer);
  }
}
