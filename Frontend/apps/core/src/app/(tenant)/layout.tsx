import { Inter, Manrope } from "next/font/google";
import { TenantAdminAccessGate } from "@/modules/platform-admin/components/tenant-admin-access-gate";

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

/**
 * Tenant-scoped layout — for pages that tenant HR Admins access
 * (e.g., Admin Activation Home after accepting invite).
 */
export default function TenantLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`core-ui-root ${manrope.variable} ${inter.variable}`}>
      <TenantAdminAccessGate>{children}</TenantAdminAccessGate>
    </div>
  );
}
