require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createCredentialsTable() {
  console.log('🚀 Creating user_credentials_log table...\n');

  try {
    // Check if table already exists by trying to select from it
    const { error: checkError } = await supabase
      .from('user_credentials_log')
      .select('id')
      .limit(1);

    if (!checkError) {
      console.log('✅ Table user_credentials_log already exists');
      return;
    }

    // Table doesn't exist, create it via SQL
    // Note: This requires service_role key or manual creation in Supabase dashboard
    console.log('📋 Creating user_credentials_log table...');
    console.log('\n⚠️  Please run this SQL in your Supabase SQL Editor:\n');
    console.log(`
CREATE TABLE IF NOT EXISTS user_credentials_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT false,
  features TEXT[] DEFAULT '{}',
  features_by_mode JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_credentials_log_created_at 
ON user_credentials_log(created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE user_credentials_log ENABLE ROW LEVEL SECURITY;

-- Create policy to allow admins to read their own credentials
CREATE POLICY "Admins can view credentials"
ON user_credentials_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.username = auth.jwt() ->> 'username' 
    AND users.is_admin = true
  )
);

-- Create policy to allow admins to insert credentials
CREATE POLICY "Admins can insert credentials"
ON user_credentials_log
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.username = auth.jwt() ->> 'username' 
    AND users.is_admin = true
  )
);

-- Create policy to allow admins to delete old credentials
CREATE POLICY "Admins can delete credentials"
ON user_credentials_log
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.username = auth.jwt() ->> 'username' 
    AND users.is_admin = true
  )
);
    `);

    console.log('\n✅ SQL script ready. Please execute it in Supabase SQL Editor.');
    console.log('📝 After creating the table, credentials will be stored in the database');
    console.log('   and will persist across deployments and browsers.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createCredentialsTable();

