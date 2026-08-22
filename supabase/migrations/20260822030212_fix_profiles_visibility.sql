-- Fix profiles RLS: allow teachers to see all students, students to see all teachers
-- Previously only auth.uid() = id (own profile only), which broke messaging and student management

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_visible" ON profiles;

-- Users can see: their own profile, all teachers (if student), all students (if teacher)
CREATE POLICY "profiles_select_visible" ON profiles FOR SELECT TO authenticated USING (
  auth.uid() = id
  OR (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'teacher') AND role = 'student')
  OR (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'student') AND role = 'teacher')
);
