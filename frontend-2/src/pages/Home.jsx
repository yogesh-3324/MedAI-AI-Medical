import { useRef } from "react";
import HeroSection from "../components/HeroSection";
import FeatureGrid from "../components/FeatureGrid";
import DetailedFeatures from "../components/DetailedFeatures";
import Testimonials from "../components/Testimonials";
import Footer from "../components/Footer";

export default function Home() {
  const featRef = useRef(null);
  const scrollToFeatures = () => featRef.current?.scrollIntoView({ behavior: "smooth" });

  return (
    <div style={{ paddingBottom: 0 }}>
      {/* We use negative margins on Footer or just let App layout handle it. App layout padBottom is 24px, we may want to remove it for Home or let it be. */}
      <HeroSection scrollToFeatures={scrollToFeatures} />
      <DetailedFeatures />
      <FeatureGrid ref={featRef} />
      <Testimonials />
      <Footer />
    </div>
  );
}