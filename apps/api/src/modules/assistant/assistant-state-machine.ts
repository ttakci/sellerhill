import { AssistantConversationMode, AssistantConversationStatus } from '@repo/shared';

export interface AssistantState {
  mode: AssistantConversationMode;
  status: AssistantConversationStatus;
}

export enum AssistantTransition {
  REQUEST_SUPPORT = 'request_support',
  CANCEL_SUPPORT = 'cancel_support',
  CLAIM = 'claim',
  RELEASE = 'release',
  TRANSFER = 'transfer',
  RETURN_TO_AI = 'return_to_ai',
  RESOLVE = 'resolve',
  REOPEN_AI = 'reopen_ai',
  REOPEN_SUPPORT = 'reopen_support',
  ARCHIVE = 'archive',
  UNARCHIVE_OPEN = 'unarchive_open',
  UNARCHIVE_RESOLVED = 'unarchive_resolved',
  DELETE = 'delete',
  RESTORE_OPEN = 'restore_open',
  RESTORE_RESOLVED = 'restore_resolved',
  RESTORE_ARCHIVED = 'restore_archived',
}

const AI_OPEN: AssistantState = { mode: AssistantConversationMode.AI, status: AssistantConversationStatus.OPEN };
const WAITING: AssistantState = { mode: AssistantConversationMode.WAITING_FOR_SUPPORT, status: AssistantConversationStatus.OPEN };
const HUMAN: AssistantState = { mode: AssistantConversationMode.HUMAN, status: AssistantConversationStatus.OPEN };
const RESOLVED: AssistantState = { mode: AssistantConversationMode.AI, status: AssistantConversationStatus.RESOLVED };
const ARCHIVED: AssistantState = { mode: AssistantConversationMode.AI, status: AssistantConversationStatus.ARCHIVED };
const DELETED: AssistantState = { mode: AssistantConversationMode.AI, status: AssistantConversationStatus.DELETED };

const key = (state: AssistantState): string => `${state.status}/${state.mode}`;
const transitions = new Map<AssistantTransition, ReadonlyMap<string, AssistantState>>([
  [AssistantTransition.REQUEST_SUPPORT, new Map([[key(AI_OPEN), WAITING]])],
  [AssistantTransition.CANCEL_SUPPORT, new Map([[key(WAITING), AI_OPEN]])],
  [AssistantTransition.CLAIM, new Map([[key(WAITING), HUMAN]])],
  [AssistantTransition.RELEASE, new Map([[key(HUMAN), WAITING]])],
  [AssistantTransition.TRANSFER, new Map([[key(HUMAN), HUMAN]])],
  [AssistantTransition.RETURN_TO_AI, new Map([[key(HUMAN), AI_OPEN]])],
  [AssistantTransition.RESOLVE, new Map([[key(AI_OPEN), RESOLVED], [key(WAITING), RESOLVED], [key(HUMAN), RESOLVED]])],
  [AssistantTransition.REOPEN_AI, new Map([[key(RESOLVED), AI_OPEN]])],
  [AssistantTransition.REOPEN_SUPPORT, new Map([[key(RESOLVED), WAITING]])],
  [AssistantTransition.ARCHIVE, new Map([[key(AI_OPEN), ARCHIVED], [key(RESOLVED), ARCHIVED]])],
  [AssistantTransition.UNARCHIVE_OPEN, new Map([[key(ARCHIVED), AI_OPEN]])],
  [AssistantTransition.UNARCHIVE_RESOLVED, new Map([[key(ARCHIVED), RESOLVED]])],
  [AssistantTransition.DELETE, new Map([[key(AI_OPEN), DELETED], [key(WAITING), DELETED], [key(HUMAN), DELETED], [key(RESOLVED), DELETED], [key(ARCHIVED), DELETED]])],
  [AssistantTransition.RESTORE_OPEN, new Map([[key(DELETED), AI_OPEN]])],
  [AssistantTransition.RESTORE_RESOLVED, new Map([[key(DELETED), RESOLVED]])],
  [AssistantTransition.RESTORE_ARCHIVED, new Map([[key(DELETED), ARCHIVED]])],
]);

export function transitionAssistantState(state: AssistantState, transition: AssistantTransition): AssistantState | null {
  return transitions.get(transition)?.get(key(state)) ?? null;
}

export function isCanonicalAssistantState(state: AssistantState): boolean {
  return [AI_OPEN, WAITING, HUMAN, RESOLVED, ARCHIVED, DELETED].some((candidate) => key(candidate) === key(state));
}
