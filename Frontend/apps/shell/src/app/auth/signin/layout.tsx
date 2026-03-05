import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In - Frontend Platform",
  description: "Sign in to your account",
};

export default function AuthSignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
