import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Header from '../components/Header';
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
        const element = document.getElementById(scrollToSection);
        if (element) {
          window.location.hash = scrollToSection;
          setTimeout(() => {
            element.scrollIntoView({ behavior: 'smooth' });
          }, 200);
          return;
        }
      }

      // Otherwise check hash in URL
      const hash = window.location.hash;
      if (hash) {
        const id = hash.substring(1); // Remove the # symbol
        const element = document.getElementById(id);
        if (element) {
          // Small delay to ensure page is rendered
          setTimeout(() => {
            element.scrollIntoView({ behavior: 'smooth' });
          }, 200);
        }
      }
    };

    // Check hash on mount
    handleHashNavigation();

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
        <Trust />
        <Download />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}

export default Home;
