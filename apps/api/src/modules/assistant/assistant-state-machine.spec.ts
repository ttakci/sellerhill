import { AssistantConversationMode, AssistantConversationStatus } from '@repo/shared';

import { AssistantTransition, isCanonicalAssistantState, transitionAssistantState } from './assistant-state-machine';

const states = [
  { status: AssistantConversationStatus.OPEN, mode: AssistantConversationMode.AI },
  { status: AssistantConversationStatus.OPEN, mode: AssistantConversationMode.WAITING_FOR_SUPPORT },
  { status: AssistantConversationStatus.OPEN, mode: AssistantConversationMode.HUMAN },
  { status: AssistantConversationStatus.RESOLVED, mode: AssistantConversationMode.AI },
  { status: AssistantConversationStatus.ARCHIVED, mode: AssistantConversationMode.AI },
  { status: AssistantConversationStatus.DELETED, mode: AssistantConversationMode.AI },
];

const valid: Array<[number, AssistantTransition, number]> = [
  [0, AssistantTransition.REQUEST_SUPPORT, 1], [1, AssistantTransition.CANCEL_SUPPORT, 0],
  [1, AssistantTransition.CLAIM, 2], [2, AssistantTransition.RELEASE, 1],
  [2, AssistantTransition.TRANSFER, 2], [2, AssistantTransition.RETURN_TO_AI, 0],
  [0, AssistantTransition.RESOLVE, 3], [1, AssistantTransition.RESOLVE, 3], [2, AssistantTransition.RESOLVE, 3],
  [3, AssistantTransition.REOPEN_AI, 0], [3, AssistantTransition.REOPEN_SUPPORT, 1],
  [0, AssistantTransition.ARCHIVE, 4], [3, AssistantTransition.ARCHIVE, 4],
  [4, AssistantTransition.UNARCHIVE_OPEN, 0], [4, AssistantTransition.UNARCHIVE_RESOLVED, 3],
  [0, AssistantTransition.DELETE, 5], [1, AssistantTransition.DELETE, 5], [2, AssistantTransition.DELETE, 5],
  [3, AssistantTransition.DELETE, 5], [4, AssistantTransition.DELETE, 5],
  [5, AssistantTransition.RESTORE_OPEN, 0], [5, AssistantTransition.RESTORE_RESOLVED, 3], [5, AssistantTransition.RESTORE_ARCHIVED, 4],
];

describe('assistant state machine', () => {
  it.each(valid)('transitions state %s via %s to %s', (from, transition, to) => {
    expect(transitionAssistantState(states[from], transition)).toEqual(states[to]);
  });

  it('rejects every unspecified transition', () => {
    const allowed = new Set(valid.map(([from, transition]) => `${from}/${transition}`));
    for (const [from, state] of states.entries()) {
      for (const transition of Object.values(AssistantTransition)) {
        if (!allowed.has(`${from}/${transition}`)) {expect(transitionAssistantState(state, transition)).toBeNull();}
      }
    }
  });

  it('accepts only canonical combinations', () => {
    for (const state of states) {expect(isCanonicalAssistantState(state)).toBe(true);}
    expect(isCanonicalAssistantState({ status: AssistantConversationStatus.RESOLVED, mode: AssistantConversationMode.HUMAN })).toBe(false);
  });
});
