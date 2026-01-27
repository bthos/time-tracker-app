import { FC } from 'react';
import { Check } from 'lucide-react';
import { useCases } from '../data/useCases';

const UseCases: FC = () => {
  return (
    <section className="py-16 px-4 bg-gray-50">
      <div className="container mx-auto max-w-6xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
          Perfect For Every Professional
        </h2>
        <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
          Whether you're a freelancer, developer, consultant, or student - TimeTracker adapts to your workflow
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {useCases.map((useCase) => {
            const IconComponent = useCase.Icon;
            return (
              <div
                key={useCase.id}
                className="bg-white rounded-lg p-6 border border-gray-200 hover:shadow-lg transition-shadow"
              >
                <div className="mb-4">
                  <IconComponent className="w-10 h-10 text-primary-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {useCase.title}
                </h3>
                <p className="text-gray-600 mb-4">{useCase.description}</p>
                <ul className="space-y-2">
                  {useCase.features.map((feature, index) => (
                    <li key={index} className="text-sm text-gray-700 flex items-start">
                      <Check className="w-4 h-4 text-primary-600 mr-2 mt-0.5 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default UseCases;
