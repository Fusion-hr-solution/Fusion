import type { MyCertificate } from "@/types";

/** The public verification URL for a certificate (origin resolved at call time in the browser). */
export function verificationUrl(certificateNumber: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://fusionhr.ey.com";
  return `${origin}/learning/verify/${encodeURIComponent(certificateNumber)}`;
}

/**
 * LinkedIn "Add to Profile" deep link (certification schema). No OAuth — opens LinkedIn's
 * pre-filled add-certification flow. See linkedin.com/help/linkedin/answer/124006.
 */
export function linkedInAddToProfileUrl(cert: MyCertificate): string {
  const issued = new Date(cert.issuedAt);
  const params = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: cert.trainingTitle,
    organizationName: "EY",
    issueYear: String(issued.getFullYear()),
    issueMonth: String(issued.getMonth() + 1),
    certId: cert.certificateNumber,
    certUrl: verificationUrl(cert.certificateNumber),
  });
  return `https://www.linkedin.com/profile/add?${params.toString()}`;
}

function emailParts(cert: MyCertificate): { subject: string; body: string } {
  const url = verificationUrl(cert.certificateNumber);
  return {
    subject: `My EY certificate — ${cert.trainingTitle}`,
    body:
      `I earned an EY certificate for "${cert.trainingTitle}".\n\n` +
      `Verify it here: ${url}\nCertificate number: ${cert.certificateNumber}`,
  };
}

/** Gmail web compose (opens a pre-filled draft in a new tab — no desktop mail client needed). */
export function gmailComposeUrl(cert: MyCertificate): string {
  const { subject, body } = emailParts(cert);
  return `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Outlook (Microsoft 365) web compose. */
export function outlookComposeUrl(cert: MyCertificate): string {
  const { subject, body } = emailParts(cert);
  return `https://outlook.office.com/mail/deeplink/compose?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
