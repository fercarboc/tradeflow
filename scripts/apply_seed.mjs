// Applies seed SQL via Supabase Management API
import { readFileSync } from 'fs';

const PROJECT_ID = 'dqqjaujnulutinskmqsu';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error('Set SUPABASE_ACCESS_TOKEN env var');
  process.exit(1);
}

async function executeSQL(sql, batchName) {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`${batchName} FAILED [${res.status}]:`, text.slice(0, 500));
    return false;
  }
  console.log(`${batchName} OK`);
  return true;
}

const batches = ['batch1', 'batch2', 'batch3', 'batch4'];
for (const b of batches) {
  const sql = readFileSync(`c:/tradeflow/scripts/${b}.sql`, 'utf8');
  const ok = await executeSQL(sql, b);
  if (!ok) process.exit(1);
}

// Verify
const countRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/database/query`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'SELECT oficio, COUNT(*) FROM trade_actuaciones GROUP BY oficio ORDER BY oficio' }),
});
console.log('Final count:', await countRes.text());
