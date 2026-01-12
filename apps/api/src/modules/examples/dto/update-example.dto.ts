import { ApiProperty } from '@nestjs/swagger';
import { EXAMPLE_STATUS } from '@repo/shared';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateExampleRequest {
  @ApiProperty({
    description: 'Name of the example',
    example: 'Updated Example',
    minLength: 2,
    required: false,
    type: String,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiProperty({
    description: 'Status of the example',
    enum: [EXAMPLE_STATUS.ACTIVE, EXAMPLE_STATUS.ARCHIVED],
    example: EXAMPLE_STATUS.ACTIVE,
    required: false,
  })
  @IsOptional()
  @IsIn([EXAMPLE_STATUS.ACTIVE, EXAMPLE_STATUS.ARCHIVED])
  status?: (typeof EXAMPLE_STATUS)[keyof typeof EXAMPLE_STATUS];
}
