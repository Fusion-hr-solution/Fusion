import { Inter, Manrope } from "next/font/google";
import { PlatformAdminChrome } from "@/modules/platform-admin/components/platform-admin-chrome";
import { PlatformAdminAccessGate } from "@/modules/platform-admin/components/platform-admin-access-gate";

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

export default function MainModuleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`core-ui-root ${manrope.variable} ${inter.variable}`}>
      <PlatformAdminAccessGate>
        <PlatformAdminChrome>{children}</PlatformAdminChrome>
      </PlatformAdminAccessGate>
    </div>
  );
}
