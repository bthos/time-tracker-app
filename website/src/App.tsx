import Header from './components/Header';
import Hero from './components/Hero';
import Stats from './components/Stats';
import KeyBenefits from './components/KeyBenefits';
import WhyChoose from './components/WhyChoose';
import Features from './components/Features';
import UseCases from './components/UseCases';
import Screenshots from './components/Screenshots';
import Trust from './components/Trust';
import Download from './components/Download';
import FAQ from './components/FAQ';
import Footer from './components/Footer';

function App() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>
        <Hero />
        <Stats />
        <KeyBenefits />
        <WhyChoose />
        <Features />
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

export default App;
