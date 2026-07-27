import { AssistantToolName } from '@repo/shared';

import { AssistantToolService } from './assistant-tool.service';

describe('AssistantToolService tenant and PII safety', () => {
  it('injects authoritative tenant scope and maps only explicit safe fields', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const service = new AssistantToolService({ query } as never);
    await service.execute('123e4567-e89b-42d3-a456-426614174000', { name: AssistantToolName.ORDER_DETAIL, resourceId: '123e4567-e89b-42d3-a456-426614174001' });
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0] as [string, string[]];
    expect(sql).toContain('id=$2 AND user_id=$1');
    expect(params[0]).toBe('123e4567-e89b-42d3-a456-426614174000');
    expect(sql).not.toMatch(/buyer_|shipping_address|email|password|token|evidence/i);
  });
  it('rejects injected resource identifiers before SQL', async () => {
    const query = jest.fn();
    const service = new AssistantToolService({ query } as never);
    const result = await service.execute('123e4567-e89b-42d3-a456-426614174000', { name: AssistantToolName.LISTING_DETAIL, resourceId: "' OR 1=1 --" });
    expect(result.resultCount).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });
});
