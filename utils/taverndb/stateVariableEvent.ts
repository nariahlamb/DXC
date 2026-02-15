import { z } from 'zod';

export const STATE_VARIABLE_EVENT_OPS = ['set', 'add', 'push', 'delete', 'upsert'] as const;

export type StateVariableEventOp = typeof STATE_VARIABLE_EVENT_OPS[number];

export const StateVariableEventSchema = z.object({
  event_id: z.string().min(1),
  turn_id: z.string().min(1),
  source: z.string().min(1),
  domain: z.string().min(1),
  entity_id: z.string().min(1),
  path: z.string().min(1),
  op: z.enum(STATE_VARIABLE_EVENT_OPS),
  value: z.unknown().optional(),
  expected_version: z.number().int().min(0).optional(),
  idempotency_key: z.string().min(1),
  created_at: z.number().int().min(0)
});

export type StateVariableEvent = z.infer<typeof StateVariableEventSchema>;

export const StateVariableEventBatchEnvelopeSchema = z.object({
  batch_id: z.string().min(1),
  turn_id: z.string().min(1),
  source: z.string().min(1),
  created_at: z.number().int().min(0),
  events: z.array(StateVariableEventSchema)
});

export type StateVariableEventBatchEnvelope = z.infer<typeof StateVariableEventBatchEnvelopeSchema>;

const normalizeString = (value: unknown, fallback = ''): string => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const normalizeExpectedVersion = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.floor(value));
};

const stableStringify = (value: unknown): string => {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
};

export const buildStateVariableEventIdempotencyKey = (event: {
  turn_id: string;
  source: string;
  domain: string;
  entity_id: string;
  path: string;
  op: StateVariableEventOp;
  value?: unknown;
}): string => {
  const valueSignature = stableStringify(event.value);
  return [
    normalizeString(event.turn_id, 'turn-unknown'),
    normalizeString(event.source, 'runtime'),
    normalizeString(event.domain, 'unknown'),
    normalizeString(event.entity_id, 'entity'),
    normalizeString(event.path, 'path'),
    normalizeString(event.op, 'upsert'),
    valueSignature
  ].join('::');
};

export const createStateVariableEvent = (
  partial: Partial<StateVariableEvent> & Pick<StateVariableEvent, 'turn_id' | 'source' | 'domain' | 'entity_id' | 'path' | 'op'>
): StateVariableEvent => {
  const now = Date.now();
  const turnId = normalizeString(partial.turn_id, 'turn-unknown');
  const source = normalizeString(partial.source, 'runtime');
  const domain = normalizeString(partial.domain, 'unknown');
  const entityId = normalizeString(partial.entity_id, 'entity');
  const path = normalizeString(partial.path, 'path');
  const op = (partial.op || 'upsert') as StateVariableEventOp;
  const expectedVersion = normalizeExpectedVersion(partial.expected_version);
  const createdAt = normalizeExpectedVersion(partial.created_at) ?? now;
  const idempotencyKey = normalizeString(
    partial.idempotency_key,
    buildStateVariableEventIdempotencyKey({
      turn_id: turnId,
      source,
      domain,
      entity_id: entityId,
      path,
      op,
      value: partial.value
    })
  );
  const eventId = normalizeString(partial.event_id, `sve_${turnId}_${createdAt}_${Math.random().toString(36).slice(2, 8)}`);

  return {
    event_id: eventId,
    turn_id: turnId,
    source,
    domain,
    entity_id: entityId,
    path,
    op,
    value: partial.value,
    expected_version: expectedVersion,
    idempotency_key: idempotencyKey,
    created_at: createdAt
  };
};

export const validateStateVariableEvent = (value: unknown) => {
  return StateVariableEventSchema.safeParse(value);
};

export const normalizeStateVariableEvent = (value: unknown): StateVariableEvent => {
  if (value && typeof value === 'object') {
    const event = createStateVariableEvent(value as any);
    return StateVariableEventSchema.parse(event);
  }
  throw new Error('state variable event must be an object');
};

export const createStateVariableEventBatchEnvelope = (
  events: Array<Partial<StateVariableEvent> | StateVariableEvent>,
  meta: { turn_id: string; source: string; batch_id?: string; created_at?: number }
): StateVariableEventBatchEnvelope => {
  const createdAt = normalizeExpectedVersion(meta.created_at) ?? Date.now();
  const normalizedEvents = events.map((item) => normalizeStateVariableEvent({
    ...item,
    turn_id: normalizeString((item as any)?.turn_id, meta.turn_id),
    source: normalizeString((item as any)?.source, meta.source)
  }));
  return StateVariableEventBatchEnvelopeSchema.parse({
    batch_id: normalizeString(meta.batch_id, `svb_${meta.turn_id}_${createdAt}`),
    turn_id: normalizeString(meta.turn_id, 'turn-unknown'),
    source: normalizeString(meta.source, 'runtime'),
    created_at: createdAt,
    events: normalizedEvents
  });
};
