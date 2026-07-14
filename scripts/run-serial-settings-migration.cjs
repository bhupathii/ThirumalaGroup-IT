const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runMigration() {
  console.log('🔄 Loading serial settings migration...');
  const migrationPath = path.join(__dirname, '../supabase/migrations/20260714160000_serial_settings.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('📡 Running migration via RPC exec_sql...');
  const { data, error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }

  console.log('✅ Migration applied successfully!');
}

runMigration();
