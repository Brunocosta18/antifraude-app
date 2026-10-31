import { DatabaseSync } from 'node:sqlite';

import type { FeedbackEntry, FeedbackStore, FeedbackSummary } from '../core/feedback/types.js';

/**
 * Armazenamento do feedback anônimo em SQLite (`node:sqlite`, sem dependências).
 * Sem colunas de IP, user-agent, UUID ou conteúdo; só a data (sem hora) para não correlacionar com logs de acesso.
 * `:memory:` (padrão) zera a cada restart.
 */
export function createSqliteFeedbackStore(path: string): FeedbackStore {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS feedbacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('SCAM_REPORT','FALSE_POSITIVE')),
      target_type TEXT NOT NULL CHECK (target_type IN ('message','url')),
      target_ref TEXT NOT NULL CHECK (length(target_ref) = 64),
      level TEXT NOT NULL CHECK (level IN ('HIGH_RISK','NEEDS_ATTENTION','NO_KNOWN_INDICATORS')),
      signal_ids TEXT NOT NULL,
      created_on TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_feedbacks_target ON feedbacks(target_ref);
  `);

  const insert = db.prepare(
    'INSERT INTO feedbacks (type, target_type, target_ref, level, signal_ids, created_on) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const count = db.prepare('SELECT type, COUNT(*) AS total FROM feedbacks WHERE target_ref = ? GROUP BY type');
  const countAll = db.prepare('SELECT type, COUNT(*) AS total FROM feedbacks GROUP BY type');

  const toSummary = (rows: unknown[]): FeedbackSummary => {
    const result: FeedbackSummary = { scamReports: 0, falsePositives: 0 };
    for (const row of rows as { type: string; total: number }[]) {
      if (row.type === 'SCAM_REPORT') result.scamReports = Number(row.total);
      else if (row.type === 'FALSE_POSITIVE') result.falsePositives = Number(row.total);
    }
    return result;
  };

  return {
    save(entry: FeedbackEntry): void {
      insert.run(
        entry.type,
        entry.targetType,
        entry.targetRef,
        entry.level,
        JSON.stringify(entry.signalIds),
        new Date().toISOString().slice(0, 10),
      );
    },
    summary(targetRef: string): FeedbackSummary {
      return toSummary(count.all(targetRef));
    },
    totals(): FeedbackSummary {
      return toSummary(countAll.all());
    },
    close(): void {
      db.close();
    },
  };
}
