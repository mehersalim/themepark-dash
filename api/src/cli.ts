// Run one ingestion locally: npm run ingest:once
import { getPool } from './db';
import { runIngestion } from './ingest';

const id = process.env.DESTINATION_ID;
if (!id) throw new Error('DESTINATION_ID is not set');
runIngestion(getPool(), id)
  .then((r) => console.log(`Inserted ${r.inserted} snapshots`))
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => getPool().end());
