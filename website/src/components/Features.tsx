import { FC } from 'react';
import { Zap, Rocket, Target, DollarSign, Folder, Globe, Timer, BarChart, Lock, Monitor } from 'lucide-react';

const Features: FC = () => {
  const features = [
    {
      title: 'Automatic Tracking',
      description: 'Tracks active window (application + title) using native APIs for maximum performance',
      Icon: Zap,
    },
    {
      title: 'Performance',
      description: '10-100x faster than competitors using native APIs. Minimal resource usage (<50MB RAM)',
      Icon: Rocket,
    },
    {
      title: 'Smart Idle Detection',
      description: 'Detects inactivity and prompts for activity classification - no more "no mouse = slacking"',
      Icon: Target,
    },
    {
      title: 'Billable Time Tracking',
      description: 'Track billable hours with hourly rates and automatic revenue calculations',
      Icon: DollarSign,
    },
    {
      title: 'Project/Task Management',
      description: 'Organize your time by projects and tasks with full CRUD operations',
      Icon: Folder,
    },
    {
      title: 'Domain Tracking',
      description: 'Automatic domain extraction from browser activities for better categorization',
      Icon: Globe,
    },
    {
      title: 'Pomodoro Timer',
      description: 'Built-in Pomodoro timer with focus session tracking integrated with projects',
      Icon: Timer,
    },
    {
      title: 'Reports & Analytics',
      description: 'Daily/weekly/monthly reports with charts, category breakdown, and insights',
      Icon: BarChart,
    },
    {
      title: 'Privacy-First',
      description: '100% local storage (SQLite). GDPR compliant. No cloud sync. Your data stays on your device.',
      Icon: Lock,
    },
    {
      title: 'Cross-Platform',
      description: 'Works on Windows, macOS, and Linux with native performance',
      Icon: Monitor,
    },
  ];

  return (
    <section id="features" className="py-16 px-4 bg-gray-50">
      <div className="container mx-auto max-w-6xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
          Powerful Features
        </h2>
        <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
          Everything you need to track your time accurately and understand where it goes
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
          {features.map((feature, index) => {
            const IconComponent = feature.Icon;
            return (
              <div
                key={index}
                className="bg-white rounded-lg p-6 border border-gray-200 hover:shadow-lg transition-shadow"
              >
                <div className="mb-3">
                  <IconComponent className="w-8 h-8 text-primary-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;
