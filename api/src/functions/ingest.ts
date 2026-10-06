import { app, InvocationContext, Timer } from '@azure/functions';
import { getPool } from '../db';
import { runIngestion } from '../ingest';

// NCRONTAB (6 fields): every 10 minutes
app.timer('ingest', {
  schedule: '0 */10 * * * *',
  handler: async (_timer: Timer, ctx: InvocationContext): Promise<void> => {
    const destinationId = process.env.DESTINATION_ID;
    if (!destinationId) throw new Error('DESTINATION_ID is not set');
    const { inserted } = await runIngestion(getPool(), destinationId);
    ctx.log(`Ingested ${inserted} snapshots`);
  },
});
