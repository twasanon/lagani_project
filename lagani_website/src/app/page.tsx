import Image from "next/image"; // Import Next Image
import Iphone15Pro from "@/components/magicui/iphone-15-pro";
import { WordRotate } from "@/components/magicui/word-rotate";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { cn } from "@/lib/utils"; // shadcn utility for classnames
import { FaGooglePlay } from "react-icons/fa"; // Icons
import { SiAppstore } from "react-icons/si"; // App Store icon
import {
  FaChartPie,
  FaExchangeAlt,
  FaBell,
  FaNewspaper,
} from "react-icons/fa";
import { Marquee } from "@/components/magicui/marquee";
import { ClientGridPattern } from "@/components/client-grid-pattern";

// Example stock symbols (replace with actual data if needed)
const stockSymbols = [
  "NABIL", "NICA", "HDL", "SHIVM", "CIT", "NLIC",
  "UPPER", "API", "CHCL", "GBIME", "SCB", "EBL"
];

const StockCard = ({ symbol }: { symbol: string }) => (
  <div className="relative h-16 w-32 overflow-hidden rounded-xl border border-gray-600 bg-gray-900/50 p-3 mr-4 ">
    <p className="font-medium text-white">
      {symbol}
    </p>
    {/* Placeholder for potential price/change - add later if needed */}
    {/* <p className="text-xs text-muted-foreground">+1.23%</p> */}
  </div>
);

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-black text-white font-sans">
      {/* Header */}
      <header className="w-full">
        <div className="container mx-auto flex items-center justify-between mt-4 px-4 md:px-8 pt-4">
          <a href="#" className="flex items-center gap-3">
            <Image
              src="/lagani_logo.png"
              alt="Lagani Logo"
              width={48}
              height={48}
              className="object-contain"
            />
            <span className="text-5xl font-bold text-white">Lagani</span>
          </a>
          <div></div>
        </div>
      </header>

      {/* Marquee Section - Full width */}
      <div className="absolute z-10 w-full pt-2">
        <div className="relative flex h-full w-full mt-2 flex-col items-center justify-center overflow-hidden">
          <Marquee pauseOnHover className="[--duration:40s]">
            {stockSymbols.map((symbol) => (
              <StockCard key={symbol} symbol={symbol} />
            ))}
          </Marquee>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-1/6 bg-gradient-to-r from-black"></div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/6 bg-gradient-to-l from-black"></div>
        </div>
      </div>

      {/* Hero Section - Reduced vertical spacing */}
      <section className="relative w-full flex items-center justify-center overflow-hidden py-4 md:py-6 lg:min-h-[calc(100vh-5rem)]">
        {/* Background Grid */}
        <ClientGridPattern
          numSquares={90}
          maxOpacity={0.7}
          duration={1.5}
          className={cn(
            "[mask-image:radial-gradient(ellipse_at_center,white,transparent_80%)]",
            "absolute inset-0 h-full w-full skew-y-12 z-0",
          )}
        />
        
        {/* Content Wrapper */}
        <div className="container relative z-10 mx-auto flex flex-col lg:flex-row items-center gap-6 px-4 md:px-8">
          {/* Left Column: Text & Buttons */}
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left lg:w-1/2">
            <div className="min-h-[140px] md:min-h-[140px] flex items-center lg:items-start justify-center lg:justify-start">
              <WordRotate
                className="text-4xl md:text-5xl lg:text-6xl font-bold text-white"
                words={[
                  "Master the NEPSE Market.",
                  "Your Smart Investment Hub.",
                  "Track. Analyze. Grow.",
                  "Paper Trade with Real Data.",
                  "Stay Ahead with Market News.",
                ]}
              />
            </div>
            <p className="mt-6 text-base md:text-lg max-w-lg text-gray-300">
              Seamlessly track your Nepal stock investments, simulate trades, and stay informed with real-time data and news. All in one place.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center lg:justify-start space-y-4 sm:space-y-0 sm:space-x-4">
              <ShimmerButton className="shadow-lg whitespace-pre-wrap bg-[#10b981] hover:bg-[#0d9668] border border-gray-600 px-6 py-3 text-base rounded-md">
                <a
                  href="#"
            target="_blank"
            rel="noopener noreferrer"
                  className="flex items-center gap-2"
          >
                  <SiAppstore className="h-5 w-5 text-[#3d87f5]" />
                  Download on the App Store
          </a>
              </ShimmerButton>
              <ShimmerButton className="shadow-lg whitespace-pre-wrap bg-[#10b981] hover:bg-[#0d9668] border border-gray-600 px-6 py-3 text-base rounded-md">
        <a
                  href="#"
          target="_blank"
          rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <FaGooglePlay className="h-5 w-5 text-[#01c8f7]" />
                  Get it on Google Play
                </a>
              </ShimmerButton>
            </div>
          </div>

          {/* Right Column: iPhone Mockup - Made 3% smaller */}
          <div className="flex items-start justify-center lg:w-1/2 mt-8 lg:mt-16 max-w-full">
            <div className="scale-[0.77] sm:scale-[0.87] lg:scale-[0.97]">
                <Iphone15Pro
                    src="./app_home.png"
                />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full max-w-6xl mx-auto py-12 md:py-16 px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-10 text-white">
          Everything You Need to Navigate NEPSE
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Portfolio Tracking */}
          <div className="rounded-xl overflow-hidden bg-purple-400/80 shadow-lg p-6 flex flex-col">
            <FaChartPie className="h-8 w-8 mb-3 text-white" />
            <h3 className="text-lg font-bold text-white mb-1">Portfolio Tracking</h3>
            <p className="text-sm text-gray-100 mb-4">Manually log trades and monitor your holdings&apos; performance.</p>
          </div>
          
          {/* Paper Trading - Double width */}
          <div className="rounded-xl overflow-hidden bg-purple-400/80 shadow-lg p-6 flex flex-col col-span-1 md:col-span-2 lg:col-span-2">
            <FaExchangeAlt className="h-8 w-8 mb-3 text-white" />
            <h3 className="text-lg font-bold text-white mb-1">Paper Trading</h3>
            <p className="text-sm text-gray-100 mb-4">Practice trading NEPSE stocks with a virtual balance.</p>
          </div>
          
          {/* Price Alerts - Double width */}
          <div className="rounded-xl overflow-hidden bg-purple-400/80 shadow-lg p-6 flex flex-col col-span-1 md:col-span-2 lg:col-span-2">
            <FaBell className="h-8 w-8 mb-3 text-white" />
            <h3 className="text-lg font-bold text-white mb-1">Price Alerts</h3>
            <p className="text-sm text-gray-100 mb-4">Set price targets and get notified when they&apos;re hit.</p>
          </div>
          
          {/* Market News */}
          <div className="rounded-xl overflow-hidden bg-purple-400/80 shadow-lg p-6 flex flex-col">
            <FaNewspaper className="h-8 w-8 mb-3 text-white" />
            <h3 className="text-lg font-bold text-white mb-1">Market News</h3>
            <p className="text-sm text-gray-100 mb-4">Stay updated with the latest headlines from Nepal&apos;s market.</p>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="w-full py-16 md:py-24 bg-gradient-to-b from-black to-gray-900">
        <div className="container mx-auto flex flex-col items-center text-center px-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
            Ready to Take Control?
          </h2>
          <p className="text-gray-300 mb-8 max-w-xl">
            Download Lagani today and start managing your NEPSE investments like never before.
          </p>
          <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4">
            <ShimmerButton className="shadow-lg whitespace-pre-wrap bg-[#10b981] hover:bg-[#0d9668] border border-gray-600 px-6 py-3 text-base rounded-md">
              <a
                href="#"
          target="_blank"
          rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <SiAppstore className="h-5 w-5 text-[#3d87f5]" />
                Download on the App Store
              </a>
            </ShimmerButton>
            <ShimmerButton className="shadow-lg whitespace-pre-wrap bg-[#10b981] hover:bg-[#0d9668] border border-gray-600 px-6 py-3 text-base rounded-md">
              <a
                href="#"
          target="_blank"
          rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <FaGooglePlay className="h-5 w-5 text-[#01c8f7]" />
                Get it on Google Play
              </a>
            </ShimmerButton>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full py-6 border-t border-gray-800">
        <div className="container mx-auto text-center text-gray-400 text-sm px-4">
          © {new Date().getFullYear()} Lagani. All rights reserved. | 
          <a href="#" className="hover:text-[#10b981] hover:underline underline-offset-2 ml-1 mr-1">Privacy Policy</a> |
          <a href="#" className="hover:text-[#10b981] hover:underline underline-offset-2 ml-1">Terms of Service</a>
        </div>
      </footer>

    </div>
  );
}
