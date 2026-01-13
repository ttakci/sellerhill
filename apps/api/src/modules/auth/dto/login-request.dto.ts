import { ApiProperty } from '@nestjs/swagger';
import type { LoginRequest } from '@repo/shared';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginRequestDto implements LoginRequest {
  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: 'User password',
    example: 'SecurePass123',
  })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
