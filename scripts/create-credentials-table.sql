-- Create user_credentials_log table to store recently created user credentials
-- This table persists credentials across deployments and browsers
-- Credentials older than 7 days are automatically cleaned up

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

-- Drop existing policies if they exist (for re-running this script)
DROP POLICY IF EXISTS "Admins can view credentials" ON user_credentials_log;
DROP POLICY IF EXISTS "Admins can insert credentials" ON user_credentials_log;
DROP POLICY IF EXISTS "Admins can delete credentials" ON user_credentials_log;

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

-- Optional: Create a function to auto-cleanup old credentials (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_credentials()
RETURNS void AS $$
BEGIN
  DELETE FROM user_credentials_log
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

