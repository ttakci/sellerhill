import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Custom Business Logic Exception
 *
 * Use this for domain-specific errors that should return 400 Bad Request
 *
 * Example:
 * throw new BusinessException('User already exists', 'error.userExists', { email: 'test@test.com' });
 */
export class BusinessException extends HttpException {
  constructor(
    message: string,
    public readonly errorCode?: string,
    public readonly details?: unknown
  ) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message,
        error: 'Business Logic Error',
        errorCode,
        details,
      },
      HttpStatus.BAD_REQUEST
    );
  }
}

/**
 * Resource Not Found Exception
 *
 * Use this when a requested resource doesn't exist
 *
 * Example:
 * throw new ResourceNotFoundException('Example', id, 'error.exampleNotFound');
 */
export class ResourceNotFoundException extends HttpException {
  constructor(
    resourceName: string,
    identifier: string | number,
    public readonly errorCode?: string
  ) {
    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        message: `${resourceName} with ID '${identifier}' not found`,
        error: 'Not Found',
        errorCode: errorCode || 'error.resourceNotFound',
        details: { resourceName, resourceId: identifier },
      },
      HttpStatus.NOT_FOUND
    );
  }
}

/**
 * Validation Exception
 *
 * Use this for custom validation errors beyond class-validator
 *
 * Example:
 * throw new ValidationException(['Field must be unique'], 'error.validationFailed');
 */
export class ValidationException extends HttpException {
  constructor(
    errors: string[],
    public readonly errorCode?: string,
    public readonly validationErrors?: Array<{ field: string; message: string; code?: string }>
  ) {
    super(
      {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        message: errors,
        error: 'Validation Error',
        errorCode: errorCode || 'error.validationFailed',
        details: validationErrors,
      },
      HttpStatus.UNPROCESSABLE_ENTITY
    );
  }
}

/**
 * Unauthorized Exception
 *
 * Use this for authentication/authorization errors
 *
 * Example:
 * throw new UnauthorizedException('Invalid credentials', 'error.invalidCredentials');
 */
export class UnauthorizedException extends HttpException {
  constructor(
    message = 'Unauthorized access',
    public readonly errorCode?: string,
    public readonly details?: unknown
  ) {
    super(
      {
        statusCode: HttpStatus.UNAUTHORIZED,
        message,
        error: 'Unauthorized',
        errorCode: errorCode || 'error.unauthorized',
        details,
      },
      HttpStatus.UNAUTHORIZED
    );
  }
}

/**
 * Forbidden Exception
 *
 * Use this when user is authenticated but doesn't have permission
 *
 * Example:
 * throw new ForbiddenException('Insufficient permissions', 'error.insufficientPermissions');
 */
export class ForbiddenException extends HttpException {
  constructor(
    message = 'Forbidden resource',
    public readonly errorCode?: string,
    public readonly details?: unknown
  ) {
    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        message,
        error: 'Forbidden',
        errorCode: errorCode || 'error.forbidden',
        details,
      },
      HttpStatus.FORBIDDEN
    );
  }
}
