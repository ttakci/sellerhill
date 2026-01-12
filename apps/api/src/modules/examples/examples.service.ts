import { randomUUID } from 'crypto';

import { Injectable } from '@nestjs/common';
import {
  EXAMPLE_STATUS,
  type CreateExampleRequest,
  type ExampleItem,
  type GetExamplesRequest,
  type GetExamplesResponse,
  type UpdateExampleRequest,
} from '@repo/shared';

import { ResourceNotFoundException, BusinessException } from '../../common/exceptions/custom.exceptions';

type ExampleEntity = ExampleItem;

@Injectable()
export class ExamplesService {
  // TODO(DB): replace with repository implementation
  private items: ExampleEntity[] = [];

  list(params: GetExamplesRequest): Promise<GetExamplesResponse> {
    const { q, page = 1, limit = 20 } = params;

    // TODO(DB): Replace with database query
    const filtered = q ? this.items.filter((x) => x.name.toLowerCase().includes(q.toLowerCase())) : this.items;

    const total = filtered.length;
    const start = (page - 1) * limit;
    const data = filtered.slice(start, start + limit);

    return Promise.resolve({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }

  getById(id: string): Promise<ExampleItem> {
    // TODO(DB): await this.repository.findOne({ where: { id } })
    const item = this.items.find((x) => x.id === id);
    if (!item) {
      throw new ResourceNotFoundException('Example', id, 'error.exampleNotFound');
    }
    return Promise.resolve(item);
  }

  create(request: CreateExampleRequest): Promise<ExampleItem> {
    // Business validation example
    if (request.name.length < 3) {
      throw new BusinessException('Example name must be at least 3 characters long', 'error.exampleNameTooShort', {
        minLength: 3,
      });
    }

    const now = new Date().toISOString();

    const item: ExampleEntity = {
      id: `ex_${randomUUID()}`,
      name: request.name,
      status: EXAMPLE_STATUS.ACTIVE,
      createdAt: now,
      updatedAt: now,
    };

    // TODO(DB): await this.repository.save(item)
    this.items.unshift(item);
    return Promise.resolve(item);
  }

  update(id: string, request: UpdateExampleRequest): Promise<ExampleItem> {
    // TODO(DB): const item = await this.repository.findOne({ where: { id } })
    const item = this.items.find((x) => x.id === id);
    if (!item) {
      throw new ResourceNotFoundException('Example', id, 'error.exampleNotFound');
    }

    // Update fields
    if (request.name !== undefined) {
      item.name = request.name;
    }
    if (request.status !== undefined) {
      item.status = request.status;
    }

    item.updatedAt = new Date().toISOString();

    // TODO(DB): await this.repository.save(item)
    return Promise.resolve(item);
  }

  remove(id: string): Promise<void> {
    // TODO(DB): const result = await this.repository.delete({ id })
    const exists = this.items.find((x) => x.id === id);
    if (!exists) {
      throw new ResourceNotFoundException('Example', id, 'error.exampleNotFound');
    }

    // TODO(DB): Check result.affected
    this.items = this.items.filter((x) => x.id !== id);
    return Promise.resolve();
  }
}
