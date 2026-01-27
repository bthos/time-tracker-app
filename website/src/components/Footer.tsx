import { FC } from 'react';
import { Timer, Heart } from 'lucide-react';
import { getGitHubUrl, config } from '../config';

const Footer: FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-gray-300 py-12 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Timer className="w-6 h-6 text-primary-400" />
              <span className="text-xl font-bold text-white">TimeTracker</span>
            </div>
            <p className="text-sm text-gray-400">
              Automatic time tracking for Windows, macOS, and Linux.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#features" className="hover:text-white transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#screenshots" className="hover:text-white transition-colors">
                  Screenshots
                </a>
              </li>
              <li>
                <a href="#download" className="hover:text-white transition-colors">
                  Download
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4">Resources</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href={getGitHubUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href={getGitHubUrl('/releases')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Releases
                </a>
              </li>
              <li>
                <a
                  href={getGitHubUrl('/issues')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Issues
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href={getGitHubUrl('/blob/main/LICENSE')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  MIT License
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-white transition-colors">
                  FAQ
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-gray-400">
            © {currentYear} TimeTracker. All rights reserved.
          </p>
          <p className="text-sm text-gray-400 mt-4 md:mt-0 flex items-center">
            Made with <Heart className="w-4 h-4 mx-1 text-red-500 fill-red-500" /> by{' '}
            <a
              href={`https://github.com/${config.github.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors ml-1"
            >
              bthos
            </a>
          </p>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-800">
          <p className="text-xs text-gray-500 text-center">
            Special thanks to Anastasiya Murenka, Aliaksei Berkau, and Andrei Zhytkevich for the ideas.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
