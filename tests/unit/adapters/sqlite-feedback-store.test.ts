import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { createSqliteFeedbackStore } from '../../../src/adapters/sqlite-feedback-store.js';
import type { FeedbackEntry } from '../../../src/core/feedback/types.js';

const REF = 'a'.repeat(64);
const entry = (over: Partial<FeedbackEntry> = {}): FeedbackEntry => ({
  type: 'SCAM_REPORT',
  targetType: 'url',
  targetRef: REF,
  level: 'HIGH_RISK',
  signalIds: ['DOM-TEST'],
  ...over,
});

describe('createSqliteFeedbackStore', () => {
  it('salva e resume por targetRef', () => {
    const store = createSqliteFeedbackStore(':memory:');
    store.save(entry());
    store.save(entry());
    store.save(entry({ type: 'FALSE_POSITIVE' }));
    store.save(entry({ targetRef: 'b'.repeat(64) }));
    expect(store.summary(REF)).toEqual({ scamReports: 2, falsePositives: 1 });
    expect(store.summary('c'.repeat(64))).toEqual({ scamReports: 0, falsePositives: 0 });
    store.close();
  });

  it('rejeita dados fora do esquema (CHECK)', () => {
    const store = createSqliteFeedbackStore(':memory:');
    expect(() => store.save(entry({ targetRef: 'curta' }))).toThrow();
    expect(() => store.save(entry({ type: 'X' as never }))).toThrow();
    expect(() => store.save(entry({ level: 'X' as never }))).toThrow();
    store.close();
  });

  it('tem só as colunas esperadas (sem IP, user-agent, UUID ou conteúdo) e data sem hora', () => {
    const dir = mkdtempSync(join(tmpdir(), 'feedback-'));
    const path = join(dir, 'f.db');
    try {
      const store = createSqliteFeedbackStore(path);
      store.save(entry());
      store.close();

      const db = new DatabaseSync(path);
      const columns = (db.prepare('PRAGMA table_info(feedbacks)').all() as { name: string }[]).map((c) => c.name);
      expect(columns).toEqual(['id', 'type', 'target_type', 'target_ref', 'level', 'signal_ids', 'created_on']);
      const row = db.prepare('SELECT created_on FROM feedbacks').get() as { created_on: string };
      expect(row.created_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
    }
  });
});
