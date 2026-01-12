# Error Handling

This template includes a robust error handling system with custom exceptions and a global exception filter.

## Custom Exceptions

All custom exceptions extend NestJS's `HttpException` and provide semantic error handling:

### BusinessException (400 Bad Request)
For business logic violations that aren't caught by validation.

```typescript
throw new BusinessException('Cannot delete example with active dependencies');
```

### ResourceNotFoundException (404 Not Found)
When a requested resource doesn't exist.

```typescript
throw new ResourceNotFoundException('Example', id);
// Returns: "Example with ID '123' not found"
```

### ValidationException (422 Unprocessable Entity)
For validation errors that bypass class-validator (e.g., cross-field validation).

```typescript
throw new ValidationException('End date must be after start date');
```

### UnauthorizedException (401 Unauthorized)
For authentication failures.

```typescript
throw new UnauthorizedException('Invalid credentials');
```

### ForbiddenException (403 Forbidden)
For authorization failures.

```typescript
throw new ForbiddenException('You do not have permission to delete this resource');
```

## Usage Example

See `examples.service.ts` for practical usage:

```typescript
import { ResourceNotFoundException, BusinessException } from '../../common/exceptions/custom.exceptions';

async getById(id: string): Promise<ExampleItem> {
  const item = this.items.find((x) => x.id === id);
  if (!item) {
    throw new ResourceNotFoundException('Example', id);
  }
  return item;
}

async create(request: CreateExampleRequest): Promise<ExampleItem> {
  if (request.name.length < 3) {
    throw new BusinessException('Example name must be at least 3 characters long');
  }
  // ... create logic
}
```

## Error Response Format

All errors are standardized by `HttpExceptionFilter`:

```json
{
  "statusCode": 404,
  "timestamp": "2024-01-15T10:30:45.123Z",
  "path": "/api/examples/ex_123",
  "method": "GET",
  "message": "Example with ID 'ex_123' not found",
  "error": "Not Found"
}
```

## Benefits

1. **Semantic Error Handling**: Clear intent with custom exception classes
2. **Consistent Responses**: All errors follow the same format
3. **Better Logging**: Errors are automatically logged with context
4. **Type Safety**: TypeScript ensures proper error handling
5. **Cleaner Controllers**: No manual error response handling needed
