import { FC } from 'react';
import { RefreshCw, Brain, Lightbulb, DollarSign, Lock } from 'lucide-react';

const KeyBenefits: FC = () => {
  const benefits = [
    {
      problem: "Don't know where time goes",
      solution: "Auto-tracking of active applications with native APIs",
      Icon: RefreshCw,
    },
    {
      problem: '"No mouse = slacking"',
      solution: "Smart idle detection + manual classification",
      Icon: Brain,
    },
    {
      problem: "Thinking ≠ work",
      solution: '"Thinking mode" with one button for focused work',
      Icon: Lightbulb,
    },
    {
      problem: "Lose billable hours",
      solution: "Automatic tracking with billable time calculation and revenue tracking",
      Icon: DollarSign,
    },
    {
      problem: "Privacy concerns",
      solution: "100% local storage, GDPR compliant, no cloud sync required",
      Icon: Lock,
    },
  ];

  return (
    <section className="py-16 px-4 bg-white">
      <div className="container mx-auto max-w-6xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-12">
          Solve Your Time Tracking Problems
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => {
            const IconComponent = benefit.Icon;
            return (
              <div
                key={index}
                className="bg-gray-50 rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-shadow"
              >
                <div className="mb-4">
                  <IconComponent className="w-10 h-10 text-primary-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {benefit.problem}
                </h3>
                <p className="text-gray-600">{benefit.solution}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default KeyBenefits;
