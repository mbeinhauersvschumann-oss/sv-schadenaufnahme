import { CapacitorSQLite } from '@capacitor-community/sqlite';

const DB = 'svschu_queue';
const TABLE = 'pending';

export async function initQueue() {
  const db = await CapacitorSQLite.open({ database: DB });
  await db.execute(`CREATE TABLE IF NOT EXISTS ${TABLE}(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    payload TEXT NOT NULL
  )`);
  await db.close();
}

export async function enqueue(payload: any) {
  const db = await CapacitorSQLite.open({ database: DB });
  await db.run(`INSERT INTO ${TABLE}(ts,payload) VALUES(?,?)`, [Date.now(), JSON.stringify(payload)]);
  await db.close();
}

export async function dequeue(id: number) {
  const db = await CapacitorSQLite.open({ database: DB });
  await db.run(`DELETE FROM ${TABLE} WHERE id=?`, [id]);
  await db.close();
}

export async function iterateAll(): Promise<Array<{id:number,payload:any}>> {
  const db = await CapacitorSQLite.open({ database: DB });
  const res = await db.query(`SELECT id,payload FROM ${TABLE} ORDER BY id ASC`);
  await db.close();
  return (res.values || []).map((r:any) => ({ id: r.id, payload: JSON.parse(r.payload) }));
}

export async function flushQueueCount(): Promise<number> {
  const db = await CapacitorSQLite.open({ database: DB });
  const res = await db.query(`SELECT COUNT(*) as c FROM ${TABLE}`);
  await db.close();
  return res.values?.[0]?.c ?? 0;
}
