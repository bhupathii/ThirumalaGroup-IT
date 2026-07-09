import 'dotenv/config';

Object.defineProperty(globalThis, 'navigator', {
  value: { onLine: true },
  writable: true,
  configurable: true
});

import { createServer } from 'vite';

global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

async function runRebuild() {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });
  
  try {
    const { cdLedgerRebuildService } = await vite.ssrLoadModule('/src/services/cdLedgerRebuildService.ts');
    const loanId = '7c3b97d6-f892-40e5-abe6-25ae3b3f5c5a'; // CD127
    
    console.log("=== RUNNING REBUILD FOR CD127 ===");
    const res = await cdLedgerRebuildService.rebuildCDLoanLifecycle(loanId, 'FULL_RECALCULATE');
    console.log("Rebuild result:", res);
  } catch (e) {
    console.error("Caught error:", e);
    if (e.stack) console.error(e.stack);
  } finally {
    vite.close();
  }
}

runRebuild();
