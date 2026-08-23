export type UserRole = 'student' | 'teacher';

export type SubmissionStatus =
  | 'not_started'
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'failed';

export type DearStatus = 'draft' | 'active' | 'archived';

export interface Profile {
  id: string;
  email: string;
  username: string | null;
  first_name: string;
  last_name: string;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatPermission {
  id: string;
  student_a: string;
  student_b: string;
  allowed: boolean;
}

export interface Dear {
  id: string;
  teacher_id: string;
  pdf_url: string;
  term: string;
  week: string;
  due_date: string;
  status: DearStatus;
  created_at: string;
  updated_at: string;
}

export interface DearSubmission {
  id: string;
  dear_id: string;
  student_id: string;
  content: string;
  status: SubmissionStatus;
  feedback: string | null;
  ai_score: AiScore | null;
  ai_analysis: string | null;
  last_activity: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiScore {
  verdict: 'likely_human' | 'likely_ai' | 'mixed';
  ai_probability: number;
  human_probability: number;
  signals: AiSignal[];
}

export interface AiSignal {
  label: string;
  weight: 'high' | 'medium' | 'low';
  detail: string;
  points_to: 'ai' | 'human';
}

export interface Announcement {
  id: string;
  teacher_id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface AnnouncementReply {
  id: string;
  announcement_id: string;
  student_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  edited: boolean;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  student_id: string;
  action: string;
  detail: string | null;
  created_at: string;
}

export interface UserSettings {
  id: string;
  theme: ThemeConfig;
  updated_at: string;
}

export interface ThemeConfig {
  primaryColor: string;
  accentColor: string;
  mode: 'light' | 'dark';
  layout: 'default' | 'compact' | 'spacious' | 'grid';
  animations: boolean;
  glassIntensity: 'subtle' | 'medium' | 'strong';
  fontFamily: 'poppins' | 'sfpro' | 'inter' | 'roboto' | 'montserrat' | 'raleway' | 'nunito' | 'lora' | 'playfair' | 'sourceSans' | 'dmSans' | 'spaceGrotesk' | 'manrope';
}

export const DEFAULT_THEME: ThemeConfig = {
  primaryColor: '#6096B7',
  accentColor: '#8BB4D8',
  mode: 'light',
  layout: 'default',
  animations: true,
  glassIntensity: 'medium',
  fontFamily: 'poppins',
};

export const TEACHER_PIN = '6333';
