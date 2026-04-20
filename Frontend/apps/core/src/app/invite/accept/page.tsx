import type { Metadata } from "next";
import { InviteAcceptanceForm } from "./invite-acceptance-form";

export const metadata: Metadata = {
  title: "Accept Invitation — Fusion",
  description: "Accept your administrator invitation to join the Fusion platform.",
};

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <InviteAcceptanceForm token={token ?? null} />
  );
}
