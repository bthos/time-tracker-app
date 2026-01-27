import { getAssetPath } from '../config';

export interface Screenshot {
  id: string;
  title: string;
  description: string;
  image: string;
  thumbnail: string;
  features: string[];
  alt: string;
}

export const screenshots: Screenshot[] = [
  {
    id: 'dashboard',
    title: 'Dashboard Overview',
    description: 'Comprehensive view of your tracked time, productivity metrics, billable hours, and goal progress',
    image: getAssetPath('/screenshots/dashboard.png'),
    thumbnail: getAssetPath('/screenshots/dashboard.png'),
    features: [
      'Real-time tracking (6h 9m 18s)',
      'Productivity metrics (64%)',
      'Billable hours ($15.32 revenue)',
      'Goal progress tracking',
      'Active project/task management'
    ],
    alt: 'TimeTracker Dashboard showing productivity metrics and billable hours'
  },
  {
    id: 'history',
    title: 'Activity History',
    description: 'Detailed timeline of all your activities with precise timestamps and categorization',
    image: getAssetPath('/screenshots/history.png'),
    thumbnail: getAssetPath('/screenshots/history.png'),
    features: [
      'Detailed activity log',
      'Date filtering and navigation',
      'Category tags (Work Session, Idle, Reporting)',
      'Precise time tracking',
      'Manual entry support'
    ],
    alt: 'Activity History view with detailed time entries and categorization'
  },
  {
    id: 'pomodoro',
    title: 'Pomodoro Timer',
    description: 'Built-in Pomodoro timer with focus session tracking integrated with projects and tasks',
    image: getAssetPath('/screenshots/pomodoro.png'),
    thumbnail: getAssetPath('/screenshots/pomodoro.png'),
    features: [
      'Visual countdown timer',
      'Work/break session tracking',
      'Project and task integration',
      'Session history',
      'Focus mode support'
    ],
    alt: 'Pomodoro Timer with active focus session'
  },
  {
    id: 'reports',
    title: 'Reports & Analytics',
    description: 'Visual analytics with category breakdown, top applications, project insights, and website tracking',
    image: getAssetPath('/screenshots/reports.png'),
    thumbnail: getAssetPath('/screenshots/reports.png'),
    features: [
      'Category breakdown (donut chart)',
      'Top applications ranking',
      'Project breakdown analysis',
      'Top websites tracking',
      'Billable vs non-billable insights'
    ],
    alt: 'Reports dashboard with category breakdown and top applications'
  },
  {
    id: 'settings',
    title: 'Categories Management',
    description: 'Organize and customize your activity categories with productivity flags and color coding',
    image: getAssetPath('/screenshots/settings-categories.png'),
    thumbnail: getAssetPath('/screenshots/settings-categories.png'),
    features: [
      'Custom category creation',
      'Productivity flags (Productive/Neutral)',
      'Color customization',
      'Category organization',
      'Rule-based auto-categorization'
    ],
    alt: 'Settings page for managing activity categories'
  },
];
