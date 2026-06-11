import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Invitation Required - Frontend Platform",
  description: "Platform access requires an invitation from an administrator.",
};

export default function AuthSignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
