import { FC } from 'react';
import { Shield, FileText, Lock, WifiOff } from 'lucide-react';

const Trust: FC = () => {
  const trustPoints = [
    {
      title: 'GDPR Compliant',
      description: '100% local data storage. No cloud sync. Your data never leaves your device.',
      Icon: Shield,
    },
    {
      title: 'Open Source',
      description: 'MIT License. Free to use, modify, and distribute. Transparent and auditable code.',
      Icon: FileText,
    },
    {
      title: 'Privacy-First',
      description: 'All data encrypted at rest. No tracking, no analytics, no data collection.',
      Icon: Lock,
    },
    {
      title: 'Offline-First',
      description: 'Works completely offline. No internet connection required for any functionality.',
      Icon: WifiOff,
    },
  ];

  return (
    <section className="py-16 px-4 bg-gray-900 text-white">
      <div className="container mx-auto max-w-6xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
          Your Privacy & Security Matter
        </h2>
        <p className="text-center text-gray-300 mb-12 max-w-2xl mx-auto">
          Built with privacy and security as core principles. Your data belongs to you, always.
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {trustPoints.map((point, index) => {
            const IconComponent = point.Icon;
            return (
              <div
                key={index}
                className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center"
              >
                <div className="flex justify-center mb-4">
                  <IconComponent className="w-10 h-10 text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{point.title}</h3>
                <p className="text-sm text-gray-300">{point.description}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-12 text-center">
          <p className="text-gray-400 text-sm">
            Perfect for European businesses (GDPR), sensitive client data, and anyone who values privacy.
          </p>
        </div>
      </div>
    </section>
  );
};

export default Trust;
