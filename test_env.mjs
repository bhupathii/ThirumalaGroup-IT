import 'dotenv/config';
import { createServer } from 'vite';

async function test() {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });
  
  try {
    const { supabaseDB } = await vite.ssrLoadModule('/src/lib/supabaseDatabase.ts');
    console.log("VITE_SUPABASE_URL from process.env:", process.env.VITE_SUPABASE_URL);
    console.log("supabaseDB.isOnline:", supabaseDB.isOnline);
    console.log("navigator type:", typeof navigator);
  } catch (e) {
    console.error(e);
  } finally {
    vite.close();
  }
}

test();
