/*
# DEAR Hub - Initial Schema

Creates the core tables for the DEAR Hub homeschooling platform:
- profiles: extends auth.users with student/teacher info
- dears: DEAR assignments created by the teacher
- dear_submissions: student work on each DEAR
- announcements: teacher announcements
- announcement_replies: student replies to announcements
- messages: private chat between student and teacher
- activity_logs: student activity tracking
- settings: per-user customization preferences

All tables use RLS with auth.uid()-based ownership checks.
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher')),
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- DEARS table
CREATE TABLE IF NOT EXISTS dears (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  pdf_url text NOT NULL,
  term text NOT NULL,
  week text NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE dears ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dears_select_all" ON dears;
CREATE POLICY "dears_select_all" ON dears FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "dears_insert_teacher" ON dears;
CREATE POLICY "dears_insert_teacher" ON dears FOR INSERT TO authenticated WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "dears_update_teacher" ON dears;
CREATE POLICY "dears_update_teacher" ON dears FOR UPDATE TO authenticated USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "dears_delete_teacher" ON dears;
CREATE POLICY "dears_delete_teacher" ON dears FOR DELETE TO authenticated USING (auth.uid() = teacher_id);

-- Submissions table
CREATE TABLE IF NOT EXISTS dear_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dear_id uuid NOT NULL REFERENCES dears(id) ON DELETE CASCADE,
  student_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'draft', 'submitted', 'approved', 'failed')),
  feedback text,
  ai_score jsonb,
  ai_analysis text,
  last_activity timestamptz DEFAULT now(),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(dear_id, student_id)
);

ALTER TABLE dear_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "submissions_select_own_or_teacher" ON dear_submissions;
CREATE POLICY "submissions_select_own_or_teacher" ON dear_submissions FOR SELECT TO authenticated USING (
  auth.uid() = student_id OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
);

DROP POLICY IF EXISTS "submissions_insert_own" ON dear_submissions;
CREATE POLICY "submissions_insert_own" ON dear_submissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "submissions_update_own_or_teacher" ON dear_submissions;
CREATE POLICY "submissions_update_own_or_teacher" ON dear_submissions FOR UPDATE TO authenticated
  USING (auth.uid() = student_id OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'))
  WITH CHECK (auth.uid() = student_id OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'));

DROP POLICY IF EXISTS "submissions_delete_own" ON dear_submissions;
CREATE POLICY "submissions_delete_own" ON dear_submissions FOR DELETE TO authenticated USING (auth.uid() = student_id);

-- Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ann_select_all" ON announcements;
CREATE POLICY "ann_select_all" ON announcements FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ann_insert_teacher" ON announcements;
CREATE POLICY "ann_insert_teacher" ON announcements FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'));

DROP POLICY IF EXISTS "ann_update_teacher" ON announcements;
CREATE POLICY "ann_update_teacher" ON announcements FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'));

DROP POLICY IF EXISTS "ann_delete_teacher" ON announcements;
CREATE POLICY "ann_delete_teacher" ON announcements FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'));

-- Announcement replies
CREATE TABLE IF NOT EXISTS announcement_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  student_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE announcement_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "replies_select_all" ON announcement_replies;
CREATE POLICY "replies_select_all" ON announcement_replies FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "replies_insert_own" ON announcement_replies;
CREATE POLICY "replies_insert_own" ON announcement_replies FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "replies_update_own" ON announcement_replies;
CREATE POLICY "replies_update_own" ON announcement_replies FOR UPDATE TO authenticated USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "replies_delete_own" ON announcement_replies;
CREATE POLICY "replies_delete_own" ON announcement_replies FOR DELETE TO authenticated USING (auth.uid() = student_id);

-- Messages (chat)
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  edited boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "msg_select_participants" ON messages;
CREATE POLICY "msg_select_participants" ON messages FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "msg_insert_own" ON messages;
CREATE POLICY "msg_insert_own" ON messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "msg_update_own" ON messages;
CREATE POLICY "msg_update_own" ON messages FOR UPDATE TO authenticated USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "msg_delete_own" ON messages;
CREATE POLICY "msg_delete_own" ON messages FOR DELETE TO authenticated USING (auth.uid() = sender_id);

-- Activity logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  detail text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "logs_select_own_or_teacher" ON activity_logs;
CREATE POLICY "logs_select_own_or_teacher" ON activity_logs FOR SELECT TO authenticated USING (
  auth.uid() = student_id OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
);

DROP POLICY IF EXISTS "logs_insert_own" ON activity_logs;
CREATE POLICY "logs_insert_own" ON activity_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);

-- User settings (customization)
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  theme jsonb NOT NULL DEFAULT '{"primaryColor":"#3b82f6","accentColor":"#8b5cf6","layout":"default","animations":true,"glassIntensity":"medium"}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_select_own" ON user_settings;
CREATE POLICY "settings_select_own" ON user_settings FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "settings_insert_own" ON user_settings;
CREATE POLICY "settings_insert_own" ON user_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "settings_update_own" ON user_settings;
CREATE POLICY "settings_update_own" ON user_settings FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Storage bucket for PDFs and avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('dear-files', 'dear-files', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "storage_read_all" ON storage.objects;
CREATE POLICY "storage_read_all" ON storage.objects FOR SELECT TO authenticated USING (bucket_id IN ('dear-files', 'avatars'));

DROP POLICY IF EXISTS "storage_insert_own" ON storage.objects;
CREATE POLICY "storage_insert_own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('dear-files', 'avatars'));

DROP POLICY IF EXISTS "storage_update_own" ON storage.objects;
CREATE POLICY "storage_update_own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id IN ('dear-files', 'avatars'));

DROP POLICY IF EXISTS "storage_delete_own" ON storage.objects;
CREATE POLICY "storage_delete_own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN ('dear-files', 'avatars'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dears_teacher_id ON dears(teacher_id);
CREATE INDEX IF NOT EXISTS idx_submissions_dear_id ON dear_submissions(dear_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON dear_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_announcement_replies_ann ON announcement_replies(announcement_id);
