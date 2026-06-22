"use client";

import { Link2, Linkedin, Mail, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui";
import { toast } from "sonner";
import {
  gmailComposeUrl,
  linkedInAddToProfileUrl,
  outlookComposeUrl,
  verificationUrl,
} from "@/lib/certificate-share";
import type { MyCertificate } from "@/types";

export function CertificateShareMenu({
  certificate,
}: {
  certificate: MyCertificate;
}) {
  const t = useTranslations("certificates.share");

  function openInNewTab(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        verificationUrl(certificate.certificateNumber)
      );
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyError"));
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t("buttonAria")}>
          <Share2 className="mr-1.5 h-4 w-4" aria-hidden="true" /> {t("button")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => openInNewTab(linkedInAddToProfileUrl(certificate))}
        >
          <Linkedin className="mr-2 h-4 w-4" aria-hidden="true" />{" "}
          {t("linkedin")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => openInNewTab(gmailComposeUrl(certificate))}
        >
          <Mail className="mr-2 h-4 w-4" aria-hidden="true" /> Gmail
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => openInNewTab(outlookComposeUrl(certificate))}
        >
          <Mail className="mr-2 h-4 w-4" aria-hidden="true" /> Outlook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyLink}>
          <Link2 className="mr-2 h-4 w-4" aria-hidden="true" /> {t("copyLink")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
