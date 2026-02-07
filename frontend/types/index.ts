// Activity types
export interface Activity {
  id: number;
  app_name: string;
  window_title: string | null;
  domain: string | null;
  category_id: number | null;
  project_id: number | null;
  task_id: number | null;
  started_at: number; // Unix timestamp
  duration_sec: number;
  is_idle: boolean;
}

export interface ActivityWithCategory extends Activity {
  category: Category | null;
}

// Category types
// TODO: Consider billable logic unification - both Category and Project have is_billable and hourly_rate fields.
// This creates ambiguity: which one should take precedence? Should they be combined?
// See TODO comments in database.rs and Dashboard.tsx for more discussion.
export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
  is_productive: boolean | null;
  is_billable: boolean | null;
  hourly_rate: number | null;
  sort_order: number;
  is_system?: boolean;
  is_pinned?: boolean;
  project_id?: number | null;
  task_id?: number | null;
}

// Rule types
export type RuleType = 'app_name' | 'window_title' | 'domain';

export interface Rule {
  id: number;
  rule_type: RuleType;
  pattern: string;
  category_id: number;
  priority: number;
}

// Manual entry types
export interface ManualEntry {
  id: number;
  description: string | null;
  category_id: number | null;
  project: string | null; // Legacy field
  project_id: number | null;
  task_id: number | null;
  started_at: number;
  ended_at: number;
}

// Settings types
export interface Settings {
  idle_threshold_minutes: number;
  idle_prompt_threshold_minutes: number;
  autostart: boolean;
  minimize_to_tray: boolean;
  show_notifications: boolean;
  date_format: string;
  time_format: '12h' | '24h';
  // Exact seconds for precision (optional, calculated from minutes if not provided)
  idle_threshold_seconds?: number;
  idle_prompt_threshold_seconds?: number;
  // Pomodoro settings
  pomodoro_work_duration_minutes?: number;
  pomodoro_short_break_minutes?: number;
  pomodoro_long_break_minutes?: number;
  pomodoro_sessions_until_long_break?: number;
  pomodoro_auto_transition_delay_seconds?: number;
  // Exact seconds for precision (optional, calculated from minutes if not provided)
  pomodoro_work_duration_seconds?: number;
  pomodoro_short_break_seconds?: number;
  pomodoro_long_break_seconds?: number;
  // Legacy properties for compatibility
  idleThreshold?: number;
  pollingInterval?: number;
  idlePromptThreshold?: number;
  autoStart?: boolean;
  startMinimized?: boolean;
  showInTray?: boolean;
  theme?: 'system' | 'light' | 'dark';
  defaultCategory?: number | null;
  shortIdleAsThinking?: boolean;
  darkMode?: boolean;
  autoCategorizationEnabled?: boolean;
}

// Statistics types
export interface DailyStats {
  total_duration_sec: number;
  productive_duration_sec: number;
  categories: CategoryStats[];
  top_apps: AppStats[];
}

export interface CategoryStats {
  category: Category;
  duration_sec: number;
  percentage: number;
}

export interface AppStats {
  app_name: string;
  duration_sec: number;
  category: Category | null;
}

/** Response from get_stats (aggregated stats for any date range) */
export interface StatsResponse {
  total_seconds: number;
  productive_seconds: number;
  category_breakdown: { category_id: number; category_name: string; color: string; seconds: number }[];
  app_breakdown: { app_name: string; seconds: number }[];
}

// Timeline types
export interface TimelineBlock {
  start: number;
  end: number;
  app_name: string;
  domain: string | null;
  category: Category | null;
  project: Project | null;
  task: Task | null;
  is_idle: boolean;
  is_manual: boolean;
  is_billable: boolean;
}

// Date range types
export type DateRangePreset = 'today' | 'week' | 'month' | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
}

// Window info from Rust backend
export interface WindowInfo {
  app_name: string;
  window_title: string;
}

// Tracker status
export interface TrackerStatus {
  is_tracking: boolean;
  is_idle: boolean;
  current_app: string | null;
  today_total_sec: number;
}

// Project types
// TODO: See Category interface TODO - both Category and Project have is_billable and hourly_rate.
// Need to decide on unified logic for determining billable status and rates.
export interface Project {
  id: number;
  name: string;
  color: string | null;
  is_archived: boolean;
  created_at: number;
  client_name?: string | null;
  is_billable?: boolean | null;
  hourly_rate?: number | null;
  budget_hours?: number | null;
}

// Task types
export interface Task {
  id: number;
  project_id: number;
  name: string;
  description: string | null;
  is_archived: boolean;
  created_at: number;
}

// Goal types
export interface Goal {
  id: number;
  goal_type: 'daily' | 'weekly' | 'monthly';
  target_seconds: number;
  category_id: number | null;
  project_id: number | null;
  start_date: number;
  end_date: number | null;
  active: boolean;
  created_at: number;
  name?: string | null;
}

export interface GoalProgress {
  goal: Goal;
  current_seconds: number;
  percentage: number;
  remaining_seconds: number;
}

export interface GoalAlert {
  goal_id: number;
  goal_name: string;
  alert_type: string; // "completed" or "warning"
  percentage: number;
  current_seconds: number;
  target_seconds: number;
}

// Focus Session types
export interface FocusSession {
  id: number;
  pomodoro_type: string;
  project_id: number | null;
  task_id: number | null;
  started_at: number;
  ended_at: number | null;
  duration_sec: number;
  completed: boolean;
}

export interface PomodoroStatus {
  is_running?: boolean;
  is_active: boolean;
  session_id: number | null;
  pomodoro_type: string;
  started_at: number | null;
  duration_sec?: number;
  remaining_sec: number;
  total_sec: number;
}

// Domain statistics
export interface DomainStat {
  domain: string;
  duration_sec: number;
  count: number;
}

// Statistics types (additional)
export interface AppUsage {
  app_name: string;
  duration_sec: number;
  count: number;
  category: Category | null;
}

export interface CategoryUsage {
  category: Category;
  duration_sec: number;
  percentage: number;
}

export interface HourlyActivity {
  hour: number;
  duration_sec: number;
  productive_duration_sec: number;
}
