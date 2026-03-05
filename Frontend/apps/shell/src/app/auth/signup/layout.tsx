import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up - Frontend Platform",
  description: "Create a new account",
};

export default function AuthSignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
