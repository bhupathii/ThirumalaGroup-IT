-- User Access Management Database Schema Enhancements

-- 1. Add extra columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status text CHECK (status IN ('Active', 'Disabled', 'Locked', 'Deleted', 'Suspended')) DEFAULT 'Active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS designation text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS branch text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_password_change timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count integer DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts integer DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS temp_password text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_expired boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_expiry_date timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_by text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_reason text;

-- Sync existing is_active with status
UPDATE users SET status = 'Disabled' WHERE is_active = false AND status = 'Active';

-- 2. Login History Table
CREATE TABLE IF NOT EXISTS login_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  username text NOT NULL,
  login_time timestamptz DEFAULT now(),
  logout_time timestamptz,
  ip_address text,
  browser text,
  device text,
  os text,
  session_duration text,
  success boolean DEFAULT true,
  failure_reason text,
  created_at timestamptz DEFAULT now()
);

-- 3. User Activities Table
CREATE TABLE IF NOT EXISTS user_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  username text NOT NULL,
  activity_type text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- 4. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  changed_by text NOT NULL,
  target_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  target_username text NOT NULL,
  field text NOT NULL,
  old_value text,
  new_value text,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to perform operations
DROP POLICY IF EXISTS "Allow authenticated full access to login_history" ON login_history;
CREATE POLICY "Allow authenticated full access to login_history" ON login_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access to user_activities" ON user_activities;
CREATE POLICY "Allow authenticated full access to user_activities" ON user_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated full access to audit_logs" ON audit_logs;
CREATE POLICY "Allow authenticated full access to audit_logs" ON audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
