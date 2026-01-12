import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateExampleRequest {
  @ApiProperty({
    description: 'Name of the example',
    example: 'My Example',
    minLength: 2,
    type: String,
  })
  @IsString()
  @MinLength(2)
  name!: string;
}
