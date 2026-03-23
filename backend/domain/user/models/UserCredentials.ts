export interface UserCredentials {
  id: string;
  email: string;
  passwordHash: string;
  isPro: boolean;
  googleSub?: string | null;
}
