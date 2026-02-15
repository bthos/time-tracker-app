import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Header from '../components/Header';
import { scrollToElement } from '../utils/scroll';
import Hero from '../components/Hero';
import Stats from '../components/Stats';
import KeyBenefits from '../components/KeyBenefits';
import WhyChoose from '../components/WhyChoose';
import Features from '../components/Features';
import Plugins from '../components/Plugins';
import UseCases from '../components/UseCases';
import Screenshots from '../components/Screenshots';
import Trust from '../components/Trust';
import Download from '../components/Download';
import FAQ from '../components/FAQ';
import Footer from '../components/Footer';

function Home() {
  const location = useLocation();

  useEffect(() => {
    // Handle hash navigation when coming from other pages or on initial load
    const handleHashNavigation = () => {
      // First check sessionStorage for section to scroll to (from other pages)
      const scrollToSection = sessionStorage.getItem('scrollToSection');
      if (scrollToSection) {
        sessionStorage.removeItem('scrollToSection');
        // Wait for page to fully render
        setTimeout(() => {
          // Use history API to set hash without triggering route change
          window.history.replaceState(null, '', `#${scrollToSection}`);
          scrollToElement(scrollToSection);
        }, 300);
        return;
      }

      // Otherwise check hash in URL
      const hash = window.location.hash;
      if (hash) {
        const id = hash.substring(1); // Remove the # symbol
        // Wait for page to fully render
        setTimeout(() => {
          scrollToElement(id);
        }, 200);
      } else {
        // No hash - scroll to top when navigating to home page
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    // Check hash on mount with delay to ensure page is rendered
    setTimeout(handleHashNavigation, 100);

    // Also listen for hash changes
    window.addEventListener('hashchange', handleHashNavigation);

    return () => {
      window.removeEventListener('hashchange', handleHashNavigation);
    };
  }, [location]);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Header />
      <main>
        <Hero />
        <Stats />
        <KeyBenefits />
        <WhyChoose />
        <Features />
        <Plugins />
        <UseCases />
        <Screenshots />
        <Download />
        <Trust />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}

export default Home;
