export interface CreateUserRecordCommand {
  id: string;
  email: string;
  passwordHash: string;
  isPro: boolean;
}
