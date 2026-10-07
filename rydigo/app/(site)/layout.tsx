import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative w-full bg-[#FFFDF6]">
      <Navbar />
      {children}
      <Footer />
    </div>
  );
}
