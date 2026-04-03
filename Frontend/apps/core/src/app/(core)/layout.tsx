import { Inter, Manrope } from "next/font/google";
import { OrganizationsProvider } from "@/modules/platform-admin/context/organizations-context";
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

export default function CoreModuleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`core-ui-root ${manrope.variable} ${inter.variable}`}>
      <OrganizationsProvider>
        <PlatformAdminAccessGate>
          <PlatformAdminChrome>{children}</PlatformAdminChrome>
        </PlatformAdminAccessGate>
      </OrganizationsProvider>
    </div>
  );
}
