import { useState, FC } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Timer, Store, BookOpen } from 'lucide-react';
import { getGitHubUrl } from '../config';
import ThemeToggle from './ThemeToggle';
import { scrollToElement } from '../utils/scroll';

const Header: FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleHomeClick = (e: React.MouseEvent) => {
    setIsMenuOpen(false);
    
    // If we're already on the home page, scroll to top
    if (location.pathname === '/' || location.pathname === '') {
      e.preventDefault();
      window.history.replaceState(null, '', '/');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // Otherwise, Link component will handle navigation
  };

  const handleSectionClick = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    setIsMenuOpen(false);
    
    // If we're on the home page, scroll directly
    if (location.pathname === '/' || location.pathname === '') {
      // Use history API to update hash without triggering route change
      window.history.replaceState(null, '', `#${id}`);
      setTimeout(() => {
        scrollToElement(id);
      }, 10);
    } else {
      // Navigate to home page first, then scroll after navigation completes
      sessionStorage.setItem('scrollToSection', id);
      navigate('/', { replace: false });
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-sm z-50">
      <nav className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" onClick={handleHomeClick} className="flex items-center space-x-2">
            <Timer className="w-6 h-6 text-primary-600" />
            <span className="text-xl font-bold text-gray-900 dark:text-white">TimeTracker</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              to="/"
              onClick={handleHomeClick}
              className="text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              Home
            </Link>
            <a
              href="#features"
              onClick={(e) => handleSectionClick('features', e)}
              className="text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              Features
            </a>
            <a
              href="#screenshots"
              onClick={(e) => handleSectionClick('screenshots', e)}
              className="text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              Screenshots
            </a>
            <a
              href="#download"
              onClick={(e) => handleSectionClick('download', e)}
              className="text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              Download
            </a>
            <Link
              to="/marketplace"
              className="p-2 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              title="Marketplace"
              aria-label="Marketplace"
            >
              <Store className="w-5 h-5" />
            </Link>
            <Link
              to="/docs"
              className="p-2 text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              title="Documentation"
              aria-label="Documentation"
            >
              <BookOpen className="w-5 h-5" />
            </Link>
            <a
              href="#faq"
              onClick={(e) => handleSectionClick('faq', e)}
              className="text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              FAQ
            </a>
            <ThemeToggle />
            <a
              href={getGitHubUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
            >
              View on GitHub
            </a>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <button
              className="text-gray-700 dark:text-gray-300"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden mt-4 space-y-4 pb-4">
            <Link
              to="/"
              onClick={(e) => {
                setIsMenuOpen(false);
                handleHomeClick(e);
              }}
              className="block w-full text-left text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              Home
            </Link>
            <a
              href="#features"
              onClick={(e) => handleSectionClick('features', e)}
              className="block w-full text-left text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              Features
            </a>
            <a
              href="#screenshots"
              onClick={(e) => handleSectionClick('screenshots', e)}
              className="block w-full text-left text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              Screenshots
            </a>
            <a
              href="#download"
              onClick={(e) => handleSectionClick('download', e)}
              className="block w-full text-left text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              Download
            </a>
            <Link
              to="/marketplace"
              onClick={() => setIsMenuOpen(false)}
              className="block w-full text-left text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              Marketplace
            </Link>
            <Link
              to="/docs"
              onClick={() => setIsMenuOpen(false)}
              className="block w-full text-left text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              Docs
            </Link>
            <a
              href="#faq"
              onClick={(e) => handleSectionClick('faq', e)}
              className="block w-full text-left text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              FAQ
            </a>
            <a
              href={getGitHubUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors text-center"
            >
              View on GitHub
            </a>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Header;
