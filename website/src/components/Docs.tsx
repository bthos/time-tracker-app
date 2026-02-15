import { FC } from 'react';
import { BookOpen, Code, FileText, ExternalLink } from 'lucide-react';
import { getGitHubUrl } from '../config';

const Docs: FC = () => {
  const docs = [
    {
      title: 'Plugin Development Guide',
      description: 'Comprehensive tutorial-style guide for developing plugins. Start here if you\'re new to plugin development.',
      icon: BookOpen,
      href: getGitHubUrl('/blob/main/docs/PLUGIN_DEVELOPMENT.md'),
      features: [
        'Getting started with plugin development',
        'Plugin architecture and lifecycle',
        'Step-by-step implementation guides',
        'Building, packaging, and publishing plugins',
        'Best practices and examples',
      ],
    },
    {
      title: 'SDK Reference',
      description: 'Complete API reference for the Plugin SDK. Use this as a reference when implementing plugins.',
      icon: Code,
      href: getGitHubUrl('/blob/main/docs/SDK_REFERENCE.md'),
      features: [
        'Plugin trait and required methods',
        'Plugin API interface methods',
        'Extension system (schema, model, hooks)',
        'Data structures and types',
        'FFI bindings and frontend integration',
      ],
    },
    {
      title: 'Documentation Overview',
      description: 'Overview of the plugin system documentation structure and quick start guide.',
      icon: FileText,
      href: getGitHubUrl('/blob/main/docs/README.md'),
      features: [
        'Documentation structure',
        'Quick start guide',
        'Key resources and links',
        'Contributing guidelines',
      ],
    },
  ];

  return (
    <section id="docs" className="py-16 px-4 bg-white">
      <div className="container mx-auto max-w-6xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
          Documentation
        </h2>
        <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
          Comprehensive guides and API references for developing plugins and extending TimeTracker
        </p>
        
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {docs.map((doc, index) => {
            const IconComponent = doc.icon;
            return (
              <a
                key={index}
                href={doc.href}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-50 rounded-lg p-6 border border-gray-200 hover:border-primary-600 hover:shadow-lg transition-all group"
              >
                <div className="mb-4 flex items-center justify-between">
                  <IconComponent className="w-8 h-8 text-primary-600" />
                  <ExternalLink className="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition-colors" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors">
                  {doc.title}
                </h3>
                <p className="text-gray-600 text-sm mb-4">
                  {doc.description}
                </p>
                <ul className="space-y-2">
                  {doc.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="text-sm text-gray-500 flex items-start">
                      <span className="text-primary-600 mr-2">•</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </a>
            );
          })}
        </div>

        <div className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-lg p-8 border border-primary-200">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Quick Links</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <a
              href={getGitHubUrl('/tree/main/docs')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-primary-600 hover:text-primary-700 font-semibold group"
            >
              <FileText className="w-5 h-5 mr-2" />
              Browse all documentation
              <ExternalLink className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </a>
            <a
              href={getGitHubUrl('/issues')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-primary-600 hover:text-primary-700 font-semibold group"
            >
              <FileText className="w-5 h-5 mr-2" />
              Report documentation issues
              <ExternalLink className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Docs;
