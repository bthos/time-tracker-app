import { FC } from 'react';
import { Timer, TrendingUp, Lock, HardDrive } from 'lucide-react';

const Stats: FC = () => {
  const stats = [
    {
      value: '40+',
      label: 'Hours Saved Per Month',
      description: 'Companies using time tracking',
      Icon: Timer,
    },
    {
      value: '20%',
      label: 'Profitability Increase',
      description: 'From accurate time tracking',
      Icon: TrendingUp,
    },
    {
      value: '100%',
      label: 'Privacy-First',
      description: 'GDPR compliant, local storage',
      Icon: Lock,
    },
    {
      value: '<50MB',
      label: 'RAM Usage',
      description: 'Minimal resource footprint',
      Icon: HardDrive,
    },
  ];

  return (
    <section className="py-16 px-4 bg-primary-600 text-white">
      <div className="container mx-auto max-w-6xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
          Proven Results
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => {
            const IconComponent = stat.Icon;
            return (
              <div
                key={index}
                className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20 text-center"
              >
                <div className="flex justify-center mb-3">
                  <IconComponent className="w-10 h-10" />
                </div>
                <div className="text-4xl md:text-5xl font-bold mb-2">{stat.value}</div>
                <div className="text-lg font-semibold mb-1">{stat.label}</div>
                <div className="text-sm text-white/80">{stat.description}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Stats;
