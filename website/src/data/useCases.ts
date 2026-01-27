import { Briefcase, Code, Building2, Rocket, GraduationCap, LucideIcon } from 'lucide-react';

export interface UseCase {
  id: string;
  title: string;
  description: string;
  Icon: LucideIcon;
  features: string[];
  targetAudience: string;
}

export const useCases: UseCase[] = [
  {
    id: 'freelancers',
    title: 'For Freelancers & Consultants',
    description: 'Never lose billable hours. Track time across multiple clients with automatic revenue calculations and seamless invoicing.',
    Icon: Briefcase,
    features: [
      'Billable hours tracking with hourly rates',
      'Project and client management',
      'CSV export for invoicing',
      'Manual entry for offline meetings'
    ],
    targetAudience: 'Freelancers, Independent Consultants'
  },
  {
    id: 'developers',
    title: 'For Developers & IT Professionals',
    description: 'Understand where your coding time goes. Track IDE usage, GitHub activity, and project tasks with precision.',
    Icon: Code,
    features: [
      'IDE and application tracking',
      'Domain tracking (GitHub, Stack Overflow)',
      'Pomodoro timer for focused work',
      'Project and task integration'
    ],
    targetAudience: 'Developers, IT Specialists, Software Engineers'
  },
  {
    id: 'consultants',
    title: 'For Consultants & Agencies',
    description: 'Accurate time tracking for transparent client billing. Detailed reports and project insights for better profitability analysis.',
    Icon: Building2,
    features: [
      'Client reporting and transparency',
      'Project breakdown analysis',
      'Billable vs non-billable insights',
      'Export to CSV/JSON for accounting'
    ],
    targetAudience: 'Consulting Firms, Agencies, Service Providers'
  },
  {
    id: 'business',
    title: 'For Small Business & Startups',
    description: 'Understand team productivity. Optimize processes and control project budgets with local data storage for complete privacy.',
    Icon: Rocket,
    features: [
      'Team productivity tracking',
      'Budget control and monitoring',
      '100% local data storage',
      'Minimal resource usage (<50MB RAM)'
    ],
    targetAudience: 'Small Businesses, Startups, Teams'
  },
  {
    id: 'students',
    title: 'For Students & Researchers',
    description: 'Track study time and research activities. Set goals and improve focus with Pomodoro timer and productivity analytics.',
    Icon: GraduationCap,
    features: [
      'Goal setting (daily/weekly/monthly)',
      'Pomodoro timer for study sessions',
      'Productivity analytics',
      'Research activity tracking'
    ],
    targetAudience: 'Students, Researchers, Academics'
  },
];
