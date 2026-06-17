import { CertificateVerificationView } from "@/components";

export const dynamic = "force-dynamic";

interface VerifyPageProps {
  params: Promise<{ number: string }>;
}

export default async function VerifyPage({ params }: VerifyPageProps) {
  const { number } = await params;
  return <CertificateVerificationView certificateNumber={number} />;
}
