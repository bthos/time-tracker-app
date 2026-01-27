import { FC } from 'react';
import { Monitor, Zap, DollarSign, Brain } from 'lucide-react';

const WhyChoose: FC = () => {
  const advantages = [
    {
      title: 'Desktop-First & Privacy',
      description: 'Works completely offline. All data stored locally (SQLite). GDPR compliant. No cloud required.',
      comparison: 'Unlike Toggl and Clockify, which require internet connection',
      Icon: Monitor,
    },
    {
      title: 'Performance',
      description: '10-100x faster tracking using native APIs. Minimal resource usage (<50MB RAM).',
      comparison: 'No constant internet connection needed like web-based solutions',
      Icon: Zap,
    },
    {
      title: 'Professional Billing Features',
      description: 'Built-in billable time tracking with revenue calculations. Export to CSV/JSON for invoicing.',
      comparison: 'More comprehensive than RescueTime, which focuses on productivity over billing',
      Icon: DollarSign,
    },
    {
      title: 'Smart Idle Detection',
      description: 'Intelligent idle time handling. Manual classification. Thinking mode for focused work.',
      comparison: 'Unique feature that solves the "no mouse = slacking" problem',
      Icon: Brain,
    },
  ];

  return (
    <section className="py-16 px-4 bg-white">
      <div className="container mx-auto max-w-6xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
          Why Choose TimeTracker Over Other Solutions?
        </h2>
        <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
          Desktop-first approach with professional billing features and complete privacy
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          {advantages.map((advantage, index) => {
            const IconComponent = advantage.Icon;
            return (
              <div
                key={index}
                className="bg-gray-50 rounded-lg p-6 border border-gray-200 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <IconComponent className="w-10 h-10 text-primary-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {advantage.title}
                    </h3>
                    <p className="text-gray-700 mb-2">{advantage.description}</p>
                    <p className="text-sm text-gray-500 italic">{advantage.comparison}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default WhyChoose;
