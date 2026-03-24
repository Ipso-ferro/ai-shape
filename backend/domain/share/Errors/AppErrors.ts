export class AppErrors extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppErrors {
  constructor(message: string) {
    super(message, 400);
  }
}

export class NotFoundError extends AppErrors {
  constructor(message: string) {
    super(message, 404);
  }
}

export class ConflictError extends AppErrors {
  constructor(message: string) {
    super(message, 409);
  }
}

export class InfrastructureError extends AppErrors {
  constructor(message = "Internal server error") {
    super(message, 500);
  }
}
