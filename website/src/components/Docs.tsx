import { FC } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Code, FileText, ExternalLink } from 'lucide-react';
import { getGitHubUrl } from '../config';

const Docs: FC = () => {
  const docs = [
    {
      title: 'Documentation Overview',
      description: 'Overview of the plugin system documentation structure and quick start guide. Start here to get oriented.',
      icon: FileText,
      route: '/docs/overview',
      href: getGitHubUrl('/blob/main/docs/README.md'),
      features: [
        'Documentation structure',
        'Quick start guide',
        'Key resources and links',
        'Contributing guidelines',
      ],
    },
    {
      title: 'Plugin Development Guide',
      description: 'Comprehensive tutorial-style guide for developing plugins. Learn how to build your first plugin step-by-step.',
      icon: BookOpen,
      route: '/docs/plugin-development',
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
      route: '/docs/sdk-reference',
      href: getGitHubUrl('/blob/main/docs/SDK_REFERENCE.md'),
      features: [
        'Plugin trait and required methods',
        'Plugin API interface methods',
        'Extension system (schema, model, hooks)',
        'Data structures and types',
        'FFI bindings and frontend integration',
      ],
    },
  ];

  return (
    <section className="py-16 px-4 bg-white dark:bg-gray-900">
      <div className="container mx-auto max-w-6xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-white mb-4">
          Documentation
        </h2>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-12 max-w-2xl mx-auto">
          Comprehensive guides and API references for developing plugins and extending TimeTracker
        </p>
        
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {docs.map((doc, index) => {
            const IconComponent = doc.icon;
            const content = (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <IconComponent className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                  <ExternalLink className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {doc.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                  {doc.description}
                </p>
                <ul className="space-y-2">
                  {doc.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="text-sm text-gray-500 dark:text-gray-400 flex items-start">
                      <span className="text-primary-600 dark:text-primary-400 mr-2">•</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </>
            );

            if (doc.route) {
              return (
                <Link
                  key={index}
                  to={doc.route}
                  className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 hover:border-primary-600 dark:hover:border-primary-500 hover:shadow-lg transition-all group block"
                >
                  {content}
                </Link>
              );
            }

            return (
              <a
                key={index}
                href={doc.href}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 hover:border-primary-600 dark:hover:border-primary-500 hover:shadow-lg transition-all group block"
              >
                {content}
              </a>
            );
          })}
        </div>

        <div className="bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900 dark:to-primary-800 rounded-lg p-8 border border-primary-200 dark:border-primary-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Quick Links</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <a
              href={getGitHubUrl('/tree/main/docs')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-semibold group"
            >
              <FileText className="w-5 h-5 mr-2" />
              Browse all documentation
              <ExternalLink className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </a>
            <a
              href={getGitHubUrl('/issues')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-semibold group"
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
