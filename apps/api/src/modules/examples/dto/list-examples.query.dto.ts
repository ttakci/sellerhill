import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GetExamplesRequest {
  @ApiProperty({
    description: 'Search query to filter examples by name',
    example: 'example',
    required: false,
    type: String,
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    required: false,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
    minimum: 1,
    maximum: 200,
    required: false,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
