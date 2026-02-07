import { Activity, Category, Rule, ManualEntry, Settings, DailyStats, AppUsage, CategoryUsage, HourlyActivity, DateRange, Project, Task, Goal, GoalProgress, GoalAlert, FocusSession, DomainStat, StatsResponse } from '../types';

// Tauri invoke wrapper
const invoke = async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/tauri');
  return tauriInvoke<T>(cmd, args);
};

// Helper function to convert Date to Unix timestamp
const dateToTimestamp = (date: Date): number => {
  return Math.floor(date.getTime() / 1000);
};

// Convert boolean | null to Tauri i32: 1 = true, 0 = false, -1 = neutral/null
const boolToTauriNum = (value: boolean | null | undefined): number =>
  value === true ? 1 : value === false ? 0 : -1;

// Activities API
export const activitiesApi = {
  getActivities: (range: DateRange): Promise<Activity[]> => {
    return invoke('get_activities', {
      start: dateToTimestamp(range.start),
      end: dateToTimestamp(range.end),
    });
  },
  
  getActivityById: (id: number): Promise<Activity | null> => {
    return invoke('get_activity', { id });
  },
  
  updateActivityCategory: (activityId: number, categoryId: number): Promise<void> => {
    return invoke('update_activity_category', { activityId, categoryId });
  },
  
  deleteActivity: (id: number): Promise<void> => {
    return invoke('delete_activity', { id });
  },
  
  reapplyCategorizationRules: (): Promise<void> => {
    return invoke('reapply_categorization_rules');
  },
};

// Categories API
export const categoriesApi = {
  getCategories: async (): Promise<Category[]> => {
    return invoke<Category[]>('get_categories');
  },

  createCategory: (category: Omit<Category, 'id'>): Promise<Category> => {
    return invoke('create_category', {
      name: category.name,
      color: category.color,
      icon: category.icon ?? null,
      isProductive: boolToTauriNum(category.is_productive),
      isBillable: boolToTauriNum(category.is_billable),
      hourlyRate: category.hourly_rate ?? null,
      sortOrder: category.sort_order,
      isSystem: category.is_system ?? false,
      isPinned: category.is_pinned ?? false,
      projectId: category.project_id ?? null,
      taskId: category.task_id ?? null,
    });
  },

  updateCategory: (category: Category): Promise<Category> => {
    return invoke('update_category', {
      id: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon ?? null,
      isProductive: boolToTauriNum(category.is_productive),
      isBillable: boolToTauriNum(category.is_billable),
      hourlyRate: category.hourly_rate ?? null,
      sortOrder: category.sort_order,
      isPinned: category.is_pinned ?? false,
      projectId: category.project_id ?? null,
      taskId: category.task_id ?? null,
    });
  },
  
  deleteCategory: (id: number): Promise<void> => {
    return invoke('delete_category', { id });
  },
  
  resetSystemCategory: (id: number): Promise<Category> => {
    return invoke('reset_system_category', { id });
  },
  
  getPinnedCategories: async (): Promise<Category[]> => {
    const categories = await invoke<Category[]>('get_categories');
    return categories.filter(c => c.is_pinned === true);
  },
};

// Rules API
export const rulesApi = {
  getRules: (): Promise<Rule[]> => {
    return invoke('get_rules');
  },
  
  createRule: (rule: Omit<Rule, 'id'>): Promise<Rule> => {
    return invoke('create_rule', {
      ruleType: rule.rule_type,
      pattern: rule.pattern,
      categoryId: rule.category_id,
      priority: rule.priority,
    });
  },
  
  updateRule: (rule: Rule): Promise<Rule> => {
    return invoke('update_rule', {
      id: rule.id,
      ruleType: rule.rule_type,
      pattern: rule.pattern,
      categoryId: rule.category_id,
      priority: rule.priority,
    });
  },
  
  deleteRule: (id: number): Promise<void> => {
    return invoke('delete_rule', { id });
  },
};

// Manual Entries API
export const manualEntriesApi = {
  getManualEntries: (range: DateRange): Promise<ManualEntry[]> => {
    return invoke('get_manual_entries', {
      start: dateToTimestamp(range.start),
      end: dateToTimestamp(range.end),
    });
  },
  
  createManualEntry: (entry: {
    description: string | null;
    category_id: number | null;
    started_at: number;
    ended_at: number;
    project_id?: number | null;
    task_id?: number | null;
  }): Promise<ManualEntry> => {
    return invoke('create_manual_entry', {
      description: entry.description,
      categoryId: entry.category_id,
      project: null,
      startedAt: entry.started_at,
      endedAt: entry.ended_at,
      projectId: entry.project_id ?? null,
      taskId: entry.task_id ?? null,
    });
  },
  
  updateManualEntry: (entry: {
    id: number;
    description: string | null;
    category_id: number | null;
    started_at: number;
    ended_at: number;
    project_id?: number | null;
    task_id?: number | null;
  }): Promise<ManualEntry> => {
    return invoke('update_manual_entry', {
      id: entry.id,
      description: entry.description,
      categoryId: entry.category_id,
      project: null,
      startedAt: entry.started_at,
      endedAt: entry.ended_at,
      projectId: entry.project_id ?? null,
      taskId: entry.task_id ?? null,
    });
  },
  
  deleteManualEntry: (id: number): Promise<void> => {
    return invoke('delete_manual_entry', { id });
  },
  
  startManualEntry: (categoryId: number, description?: string): Promise<number> => {
    return invoke('start_manual_entry', { categoryId, description });
  },
  
  stopManualEntry: (): Promise<ManualEntry> => {
    return invoke('stop_manual_entry');
  },
};

// Settings API
export const settingsApi = {
  getSettings: (): Promise<Settings> => {
    return invoke('get_settings');
  },
  
  updateSettings: (settings: Partial<Settings>): Promise<Settings> => {
    return invoke('update_settings', { settings });
  },
  
  enableAutostart: (): Promise<void> => {
    return invoke('enable_autostart');
  },
  
  disableAutostart: (): Promise<void> => {
    return invoke('disable_autostart');
  },
  
  isAutostartEnabled: (): Promise<boolean> => {
    return invoke('is_autostart_enabled');
  },
};

// Statistics API
export const statsApi = {
  getDailyStats: (date: Date): Promise<DailyStats> => {
    // Get start of day timestamp
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    return invoke('get_daily_stats', { date: dateToTimestamp(startOfDay) });
  },
  
  getTopApps: (range: DateRange, limit?: number): Promise<AppUsage[]> => {
    return invoke('get_top_apps', {
      start: dateToTimestamp(range.start),
      end: dateToTimestamp(range.end),
      limit: limit || 10,
    });
  },
  
  getCategoryUsage: (range: DateRange): Promise<CategoryUsage[]> => {
    return invoke('get_category_usage', {
      start: dateToTimestamp(range.start),
      end: dateToTimestamp(range.end),
    });
  },
  
  getHourlyActivity: (date: Date): Promise<HourlyActivity[]> => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    return invoke('get_hourly_activity', { date: dateToTimestamp(startOfDay) });
  },
  
  getProductiveTime: (range: DateRange): Promise<number> => {
    return invoke('get_productive_time', {
      start: dateToTimestamp(range.start),
      end: dateToTimestamp(range.end),
    });
  },

  getStats: (range: DateRange): Promise<StatsResponse> => {
    return invoke('get_stats', {
      start: dateToTimestamp(range.start),
      end: dateToTimestamp(range.end),
    });
  },
};

// Tracking Control API
export const trackingApi = {
  getTodayTotal: (): Promise<number> => {
    return invoke('get_today_total');
  },
  
  pauseTracking: (): Promise<void> => {
    return invoke('pause_tracking');
  },
  
  resumeTracking: (): Promise<void> => {
    return invoke('resume_tracking');
  },
  
  getTrackingStatus: (): Promise<{ isTracking: boolean; isPaused: boolean; currentApp: string | null }> => {
    return invoke('get_tracking_status');
  },
  
  startThinkingMode: (): Promise<number> => {
    return invoke('start_thinking_mode');
  },
  
  stopThinkingMode: (): Promise<void> => {
    return invoke('stop_thinking_mode');
  },
};

// Idle API
export const idleApi = {
  getIdleTime: (): Promise<number> => {
    return invoke('get_idle_time');
  },
  
  classifyIdleTime: (
    idleStart: Date,
    idleEnd: Date,
    classification: string,
    description?: string
  ): Promise<void> => {
    return invoke('classify_idle_time', {
      idle_start: dateToTimestamp(idleStart),
      idle_end: dateToTimestamp(idleEnd),
      classification,
      description,
    });
  },
};

// Export API
export const exportApi = {
  exportToCsv: (range: DateRange, filePath: string): Promise<void> => {
    return invoke('export_to_csv', {
      start: dateToTimestamp(range.start),
      end: dateToTimestamp(range.end),
      filePath: filePath,
    });
  },
  
  exportToJson: (range: DateRange, filePath: string): Promise<void> => {
    return invoke('export_to_json', {
      start: dateToTimestamp(range.start),
      end: dateToTimestamp(range.end),
      filePath: filePath,
    });
  },
};

// Window API
export const windowApi = {
  showMainWindow: (): Promise<void> => {
    return invoke('show_main_window');
  },
  
  hideMainWindow: (): Promise<void> => {
    return invoke('hide_main_window');
  },
  
  showIdlePrompt: (idleDuration: number, idleStart: Date): Promise<void> => {
    return invoke('show_idle_prompt', {
      idle_duration: idleDuration,
      idle_start: dateToTimestamp(idleStart),
    });
  },
};

// Projects API
export const projectsApi = {
  getProjects: (includeArchived?: boolean): Promise<Project[]> => {
    const includeArchivedValue = includeArchived ?? false;
    return invoke('get_projects', { includeArchived: includeArchivedValue });
  },
  
  createProject: (project: Omit<Project, 'id' | 'created_at' | 'is_archived'>): Promise<Project> => {
    return invoke('create_project', {
      name: project.name,
      clientName: project.client_name ?? null,
      color: project.color ?? '#888888',
      isBillable: project.is_billable ?? false,
      hourlyRate: project.hourly_rate ?? 0.0,
      budgetHours: project.budget_hours ?? null,
    });
  },
  
  updateProject: (project: Project): Promise<Project> => {
    const isArchivedValue = project.is_archived === undefined ? null : project.is_archived;
    return invoke('update_project', {
      id: project.id,
      name: project.name,
      clientName: project.client_name ?? null,
      color: project.color ?? '#888888',
      isBillable: project.is_billable ?? false,
      hourlyRate: project.hourly_rate ?? 0.0,
      budgetHours: project.budget_hours ?? null,
      // Explicitly pass false for active projects, true for archived, null only if not set
      isArchived: isArchivedValue,
    });
  },
  
  deleteProject: (id: number): Promise<void> => {
    return invoke('delete_project', { id });
  },
};

// Tasks API
export const tasksApi = {
  getTasks: (projectId?: number, includeArchived?: boolean): Promise<Task[]> => {
    const includeArchivedValue = includeArchived ?? false;
    return invoke('get_tasks', {
      projectId: projectId ?? null,
      includeArchived: includeArchivedValue,
    });
  },
  
  createTask: (task: Omit<Task, 'id' | 'created_at' | 'is_archived'>): Promise<Task> => {
    return invoke('create_task', {
      projectId: task.project_id,
      name: task.name,
      description: task.description ?? null,
    });
  },
  
  updateTask: (task: Task): Promise<Task> => {
    return invoke('update_task', {
      id: task.id,
      name: task.name,
      description: task.description ?? null,
      archived: task.is_archived ?? null,
    });
  },
  
  deleteTask: (id: number): Promise<void> => {
    return invoke('delete_task', { id });
  },
};

// Billable Time API
export const billableApi = {
  getBillableHours: (range: DateRange): Promise<number> => {
    return invoke('get_billable_hours', {
      start: dateToTimestamp(range.start),
      end: dateToTimestamp(range.end),
    });
  },
  
  getBillableRevenue: (range: DateRange): Promise<number> => {
    return invoke('get_billable_revenue', {
      start: dateToTimestamp(range.start),
      end: dateToTimestamp(range.end),
    });
  },
};

// Domains API
export const domainsApi = {
  getTopDomains: (range: DateRange, limit?: number): Promise<DomainStat[]> => {
    return invoke('get_top_domains', {
      start: dateToTimestamp(range.start),
      end: dateToTimestamp(range.end),
      limit: limit ?? 10,
    });
  },
};

// Pomodoro API
export const pomodoroApi = {
  startPomodoro: (pomodoroType: string, projectId?: number, taskId?: number): Promise<number> => {
    return invoke('start_pomodoro', {
      pomodoroType: pomodoroType,
      projectId: projectId ?? null,
      taskId: taskId ?? null,
    });
  },
  
  stopPomodoro: (sessionId: number, durationSec: number, completed: boolean): Promise<void> => {
    // Use camelCase - Tauri will automatically convert to snake_case for Rust
    return invoke('stop_pomodoro', {
      sessionId: sessionId,
      durationSec: durationSec,
      completed,
    });
  },
  
  getFocusSessions: (range: DateRange): Promise<FocusSession[]> => {
    return invoke('get_focus_sessions', {
      start: dateToTimestamp(range.start),
      end: dateToTimestamp(range.end),
    });
  },
  
  getCompletedWorkSessionsCountToday: (): Promise<number> => {
    return invoke('get_completed_work_sessions_count_today');
  },
  
  getActivePomodoroSession: (): Promise<FocusSession | null> => {
    return invoke('get_active_pomodoro_session');
  },
  
  deleteFocusSession: (id: number): Promise<void> => {
    return invoke('delete_focus_session', { id });
  },
};

// Active Project/Task API
export const activeProjectApi = {
  set: (projectId: number | null): Promise<void> => {
    return invoke('set_active_project', { projectId: projectId ?? null });
  },
  
  get: (): Promise<number | null> => {
    return invoke('get_active_project');
  },
};

export const activeTaskApi = {
  set: (taskId: number | null): Promise<void> => {
    return invoke('set_active_task', { taskId: taskId ?? null });
  },
  
  get: (): Promise<number | null> => {
    return invoke('get_active_task');
  },
};

// Goals API
export const goalsApi = {
  getGoals: (activeOnly?: boolean): Promise<Goal[]> => {
    const activeOnlyValue = activeOnly ?? true;
    return invoke('get_goals', { activeOnly: activeOnlyValue });
  },
  
  createGoal: (goal: Omit<Goal, 'id' | 'created_at'>): Promise<number> => {
    return invoke('create_goal', {
      goalType: goal.goal_type,
      targetSeconds: goal.target_seconds,
      categoryId: goal.category_id ?? null,
      projectId: goal.project_id ?? null,
      startDate: goal.start_date,
      endDate: goal.end_date ?? null,
      name: goal.name ?? null,
    });
  },
  
  updateGoal: (goal: Goal): Promise<void> => {
    return invoke('update_goal', {
      id: goal.id,
      goalType: goal.goal_type,
      targetSeconds: goal.target_seconds,
      categoryId: goal.category_id ?? null,
      projectId: goal.project_id ?? null,
      startDate: goal.start_date,
      endDate: goal.end_date ?? null,
      active: goal.active,
      name: goal.name ?? null,
    });
  },
  
  deleteGoal: (id: number): Promise<void> => {
    return invoke('delete_goal', { id });
  },
  
  getGoalProgress: (goalId: number, range: DateRange): Promise<GoalProgress> => {
    return invoke('get_goal_progress', {
      goalId: goalId,
      start: dateToTimestamp(range.start),
      end: dateToTimestamp(range.end),
    });
  },
  
  checkGoalAlerts: (): Promise<GoalAlert[]> => {
    return invoke('check_goal_alerts');
  },
};

// Standalone exports for convenience
export const getRules = rulesApi.getRules;
export const createRule = rulesApi.createRule;
export const deleteRule = rulesApi.deleteRule;
export const getSettings = settingsApi.getSettings;
export const updateSettings = settingsApi.updateSettings;

// Combined API object
export const api = {
  activities: activitiesApi,
  categories: categoriesApi,
  rules: rulesApi,
  manualEntries: manualEntriesApi,
  settings: settingsApi,
  stats: statsApi,
  tracking: trackingApi,
  idle: idleApi,
  export: exportApi,
  window: windowApi,
  projects: projectsApi,
  tasks: tasksApi,
  billable: billableApi,
  domains: domainsApi,
  pomodoro: pomodoroApi,
  goals: goalsApi,
  activeProject: activeProjectApi,
  activeTask: activeTaskApi,
  // Convenience methods
  getRules: rulesApi.getRules,
  createRule: rulesApi.createRule,
  updateRule: rulesApi.updateRule,
  deleteRule: rulesApi.deleteRule,
};

export default api;
