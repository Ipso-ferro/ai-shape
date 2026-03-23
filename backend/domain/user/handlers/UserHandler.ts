import { randomUUID } from "crypto";
import { AddNewUserCommand } from "../command/AddNewUserCommand";
import { DataUserCommand } from "../command/DataUserCommand";
import { SaveDataUserCommand } from "../command/SaveDataUserCommand";
import { HandlerResponse } from "../models/HandlerResponse";
import { UserCredentials } from "../models/UserCredentials";
import { GetDataUserQuery } from "../queries/GetDataUserQuery";
import { GetUserCredentialsByEmailQuery } from "../queries/GetUserCredentialsByEmailQuery";
import { RepositoryUser } from "../repositories/RepositoryUser";
import { NotFoundError } from "../../share/Errors/AppErrors";
import { NutritionGoalCalculatorService } from "./services/NutritionGoalCalculatorService";
import { PasswordHasherService } from "./services/PasswordHasherService";
import { UserHandlerService } from "./services/UserHandlerService";

export class UserHandler {
  constructor(
    private readonly repositoryUser: RepositoryUser,
    private readonly userHandlerService = new UserHandlerService(),
    private readonly nutritionGoalCalculatorService = new NutritionGoalCalculatorService(),
    private readonly passwordHasherService = new PasswordHasherService(),
  ) {}

  async addNewUser(
    command: AddNewUserCommand,
  ): Promise<HandlerResponse<{ id: string }>> {
    const id = randomUUID();
    const passwordHash = await this.passwordHasherService.hash(command.password);

    await this.repositoryUser.addNewUser({
      id,
      email: command.email,
      passwordHash,
      isPro: false,
    });

    return this.userHandlerService.success("User created successfully", 201, {
      id,
    });
  }

  async saveDataUser(command: SaveDataUserCommand): Promise<HandlerResponse> {
    const currentUser = await this.repositoryUser.getDataUser({ id: command.id });

    if (!currentUser) {
      throw new NotFoundError(`User with id "${command.id}" was not found.`);
    }

    const userData = {
      ...command,
      ...this.nutritionGoalCalculatorService.calculate(command),
      isPro: currentUser.isPro,
    };

    await this.repositoryUser.saveDataUser(userData);
    return this.userHandlerService.success("User data saved successfully");
  }

  async getDataUser(query: GetDataUserQuery): Promise<DataUserCommand> {
    const user = await this.repositoryUser.getDataUser(query);

    if (!user) {
      throw new NotFoundError(`User with id "${query.id}" was not found.`);
    }

    return user;
  }

  getAllUsers(): Promise<DataUserCommand[]> {
    return this.repositoryUser.getAllUsers();
  }

  getUserCredentialsByEmail(
    query: GetUserCredentialsByEmailQuery,
  ): Promise<UserCredentials | null> {
    return this.repositoryUser.getUserCredentialsByEmail(query);
  }
}
