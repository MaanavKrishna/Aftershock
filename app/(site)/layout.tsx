import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { MotionRoot } from "@/components/motion/MotionRoot";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site flex min-h-screen flex-col text-base leading-[1.6]">
      <a href="#main" className="sr-only z-50 rounded-control bg-fg px-4 py-3 text-canvas focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
      <Header />
      <MotionRoot>
        <main id="main" className="flex-1">{children}</main>
      </MotionRoot>
      <Footer />
    </div>
  );
}
