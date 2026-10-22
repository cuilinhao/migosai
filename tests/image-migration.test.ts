import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

function upgraded() {
  const sqlite = new DatabaseSync(':memory:');
  const directory = new URL('../migrations/', import.meta.url);
  for (const name of readdirSync(directory).filter(n => n.endsWith('.sql') && n < '0007').sort()) sqlite.exec(readFileSync(new URL(name, directory), 'utf8'));
  sqlite.exec("INSERT INTO users(id,email,name,credits) VALUES('u','u@example.test','User',100)");
  sqlite.exec("INSERT INTO generations(id,user_id,idempotency_key,kind,payload,cost) VALUES('video-old','u','old-v','video','{\"provider\":\"kie\"}',8),('music-old','u','old-m','music','{}',5)");
  sqlite.exec("UPDATE generations SET status='completed',stage='terminal',provider_id='old-task',assets='[]',result_keys='[\"private-result\"]',progress=100,provider_cost=0.2,lease_owner='owner',moderation_state='{}',moderation_verdict='passed',moderation_key='private-result',moderation_etag='old-etag',moderation_cleanup_pending=1 WHERE id='video-old'");
  const rows = sqlite.prepare('SELECT * FROM generations ORDER BY id').all();
  const ledger = sqlite.prepare('SELECT * FROM credit_ledger ORDER BY id').all();
  const file = new URL('0007_image_generations.sql', directory);
  sqlite.exec('BEGIN');
  sqlite.exec(existsSync(file) ? readFileSync(file, 'utf8') : '');
  sqlite.exec('COMMIT');
  return { sqlite, rows, ledger };
}

describe('image migration preserves historical billing and fencing', () => {
  it('accepts image jobs after upgrade and debits only the new job', () => {
    const { sqlite } = upgraded();
    expect(() => sqlite.exec("INSERT INTO generations(id,user_id,idempotency_key,kind,payload,cost) VALUES('image-new','u','new-i','image','{}',12)")).not.toThrow();
    expect(sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(75);
    expect(sqlite.prepare("SELECT amount FROM credit_ledger WHERE reference_id='image-new'").get()?.amount).toBe(-12);
  });
  it('preserves every historical column and does not debit old rows again', () => {
    const { sqlite, rows, ledger } = upgraded();
    expect(sqlite.prepare('SELECT * FROM generations ORDER BY id').all()).toEqual(rows);
    expect(sqlite.prepare('SELECT * FROM credit_ledger ORDER BY id').all()).toEqual(ledger);
    expect(sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(87);
    expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
  it('retains terminal immutability, foreign keys, uniqueness, indexes and no-overdraft billing', () => {
    const { sqlite } = upgraded();
    expect(() => sqlite.exec("UPDATE generations SET status='failed' WHERE id='video-old'")).toThrow(/generation_terminal_immutable/);
    expect(() => sqlite.exec("INSERT INTO generations(id,user_id,idempotency_key,kind,payload,cost) VALUES('duplicate','u','old-v','video','{}',5)")).toThrow(/UNIQUE/);
    expect(() => sqlite.exec("INSERT INTO generations(id,user_id,idempotency_key,kind,payload,cost) VALUES('overdraft','u','more','video','{}',88)")).toThrow(/insufficient_credits/);
    expect(() => sqlite.exec("INSERT INTO generations(id,user_id,idempotency_key,kind,payload,cost) VALUES('orphan','absent','orphan','video','{}',5)")).toThrow(/FOREIGN KEY/);
    const indexes = sqlite.prepare('PRAGMA index_list(generations)').all().map(row => row.name);
    expect(indexes).toContain('generations_due');
    expect(indexes).toContain('moderation_cleanup');
    expect(sqlite.prepare('SELECT credits FROM users').get()?.credits).toBe(87);
  });
});
