import { AssistantToolName } from '@repo/shared';

import { AssistantContextRouterService } from './assistant-context-router.service';

describe('AssistantContextRouterService', () => {
  const router = new AssistantContextRouterService();
  it('routes deterministic detail intent', async () => {
    const plan = await router.plan('show listing 123e4567-e89b-42d3-a456-426614174000');
    expect(plan.tools).toEqual([{ name: AssistantToolName.LISTING_DETAIL, resourceId: '123e4567-e89b-42d3-a456-426614174000' }]);
  });
  it('never routes destructive requests', async () => {
    const plan = await router.plan('delete order 123e4567-e89b-42d3-a456-426614174000');
    expect(plan.tools).toEqual([]);
    expect(plan.handoffRecommended).toBe(true);
  });
});
