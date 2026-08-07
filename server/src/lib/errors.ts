export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public fieldErrors?: { field: string; message: string }[],
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(404, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(403, message);
  }
}

export class ValidationError extends AppError {
  constructor(fieldErrors: { field: string; message: string }[]) {
    super(422, "Validation failed", fieldErrors);
  }
}
