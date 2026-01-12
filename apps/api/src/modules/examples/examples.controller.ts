import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { CreateExampleRequest, ExampleItem, GetExamplesResponse, UpdateExampleRequest } from '@repo/shared';

import { CreateExampleRequest as CreateExampleRequestDto } from './dto/create-example.dto';
import { GetExamplesRequest as GetExamplesRequestDto } from './dto/list-examples.query.dto';
import { UpdateExampleRequest as UpdateExampleRequestDto } from './dto/update-example.dto';
import { ExamplesService } from './examples.service';

@ApiTags('examples')
@Controller({ path: 'examples', version: '1' })
export class ExamplesController {
  constructor(private readonly examplesService: ExamplesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all examples',
    description: 'Retrieve a paginated list of examples with optional search',
  })
  @ApiOkResponse({ description: 'List of examples retrieved successfully' })
  @ApiBadRequestResponse({ description: 'Invalid query parameters' })
  async list(@Query() query: GetExamplesRequestDto): Promise<GetExamplesResponse> {
    return this.examplesService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get example by ID', description: 'Retrieve a single example by its unique identifier' })
  @ApiParam({ name: 'id', description: 'Example ID', example: 'ex_abc123' })
  @ApiOkResponse({ description: 'Example found successfully' })
  @ApiNotFoundResponse({ description: 'Example not found' })
  async getById(@Param('id') id: string): Promise<ExampleItem> {
    return this.examplesService.getById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create example', description: 'Create a new example item' })
  @ApiCreatedResponse({ description: 'Example created successfully' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async create(@Body() body: CreateExampleRequestDto): Promise<ExampleItem> {
    const request: CreateExampleRequest = { name: body.name };
    return this.examplesService.create(request);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update example', description: 'Update an existing example (partial update)' })
  @ApiParam({ name: 'id', description: 'Example ID', example: 'ex_abc123' })
  @ApiOkResponse({ description: 'Example updated successfully' })
  @ApiNotFoundResponse({ description: 'Example not found' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async update(@Param('id') id: string, @Body() body: UpdateExampleRequestDto): Promise<ExampleItem> {
    const request: UpdateExampleRequest = {
      name: body.name,
      status: body.status,
    };
    return this.examplesService.update(id, request);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete example', description: 'Permanently delete an example' })
  @ApiParam({ name: 'id', description: 'Example ID', example: 'ex_abc123' })
  @ApiNoContentResponse({ description: 'Example deleted successfully' })
  @ApiNotFoundResponse({ description: 'Example not found' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.examplesService.remove(id);
  }
}
