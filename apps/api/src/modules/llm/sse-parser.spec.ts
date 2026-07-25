// apps/api/src/modules/llm/sse-parser.spec.ts
import { parseSseChunk } from './sse-parser';

describe('parseSseChunk', () => {
  it('parses a complete single data event', () => {
    const { events, rest } = parseSseChunk('data: {"a":1}\n\n');
    expect(events).toEqual([{ data: '{"a":1}' }]);
    expect(rest).toBe('');
  });

  it('carries incomplete trailing bytes as rest', () => {
    const { events, rest } = parseSseChunk('data: {"a":');
    expect(events).toEqual([]);
    expect(rest).toBe('data: {"a":');
  });

  it('handles split across two calls', () => {
    const first = parseSseChunk('data: {"x":');
    const second = parseSseChunk(first.rest + '1}\n\n');
    expect(second.events).toEqual([{ data: '{"x":1}' }]);
    expect(second.rest).toBe('');
  });

  it('parses [DONE]', () => {
    const { events } = parseSseChunk('data: [DONE]\n\n');
    expect(events).toEqual([{ data: '[DONE]' }]);
  });

  it('ignores keep-alive comment lines', () => {
    const { events, rest } = parseSseChunk(': keep-alive\n\ndata: hi\n\n');
    expect(events).toEqual([{ data: 'hi' }]);
    expect(rest).toBe('');
  });

  it('parses multiple events in one buffer', () => {
    const { events } = parseSseChunk('data: a\n\ndata: b\n\n');
    expect(events).toEqual([{ data: 'a' }, { data: 'b' }]);
  });
});
