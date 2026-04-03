import { Inter, Manrope } from "next/font/google";
import { OrganizationsProvider } from "@/modules/corehr/context/organizations-context";
import { CoreHrChrome } from "@/modules/corehr/components/core-hr-chrome";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-ch-headline",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-ch-body",
  display: "swap",
});

export default function CoreHrLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`${manrope.variable} ${inter.variable}`}>
      <OrganizationsProvider>
        <CoreHrChrome>{children}</CoreHrChrome>
      </OrganizationsProvider>
    </div>
  );
}
