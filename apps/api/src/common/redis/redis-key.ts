import { Injectable } from '@nestjs/common';

@Injectable()
export class RedisKeyService {
  constructor(private readonly prefix: string) {}

  key(...parts: Array<string | number>): string {
    const normalized = parts.map((part) => String(part).split(':').join('_'));
    return [this.prefix, ...normalized].join(':');
  }
}
