"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import { Info, Send } from "lucide-react";
import { CoreInput, CorePrimaryButton, CoreTextarea } from "@/components/core-ui";
import { useOrganizations } from "../context/organizations-context";
import { PlatformAdminBreadcrumbs } from "./platform-admin-breadcrumbs";

const ARCH_HERO_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCwvTOwcHVJcxzaNdlRUb7iNzlv3eP36xk9suorK6nUnI7YbQl3dS_SKCizFT1zHZPqo-pfGNFufC10LIGVNufvk3fz_l7OTzqIcoAtesAECWs5-2Y0u9emIMznmVgYZTB7jB5p1kKaCXb730gio4U6EdXb4p8aOLvB01UcVBDYGqz-RGUvRebVYgHoVHDCxwrwRlUZycHVSzb0QsVz_U0hyWXp4BQNbBiQmtAzHOWPCNyWlIr5lBeIWwGzvD8-5GrO3-J6eoSbd5w";

export function CreateOrganizationForm() {
  const router = useRouter();
  const { addOrganization } = useOrganizations();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [busy, setBusy] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setBusy(true);
    const created = addOrganization({
      name: name.trim(),
      adminEmail: email.trim(),
      adminName: adminName.trim() || undefined,
      internalNotes: internalNotes.trim() || undefined,
    });
    router.push(`/organizations/${encodeURIComponent(created.id)}`);
  }

  return (
    <div className="bg-ch-surface font-chBody text-ch-on-surface">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <PlatformAdminBreadcrumbs
            items={[
              { label: "Admin console", href: "/" },
              { label: "Organizations", href: "/organizations" },
              { label: "Create" },
            ]}
          />
        </div>

        <header className="mb-12">
          <h1 className="mb-2 font-chHeadline text-4xl font-extrabold tracking-tight text-ch-on-surface lg:text-5xl">
            Create Organization
          </h1>
          <p className="font-chBody text-lg text-ch-on-surface-variant">
            Provision a new dedicated environment and invite the primary
            administrator.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7">
            <section className="rounded-ch-lg border-0 bg-ch-surface-container-lowest p-8 shadow-sm">
              <form className="space-y-8" onSubmit={onSubmit}>
                <div>
                  <label className="mb-3 block text-[11px] font-bold uppercase tracking-widest text-ch-on-surface-variant">
                    Organization Name
                  </label>
                  <CoreInput
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Acme Corp Operations"
                    className="bg-ch-surface-container-low p-4"
                  />
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <label className="mb-3 block text-[11px] font-bold uppercase tracking-widest text-ch-on-surface-variant">
                      First Admin Email
                    </label>
                    <CoreInput
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@acme.com"
                      className="bg-ch-surface-container-low p-4"
                    />
                  </div>
                  <div>
                    <label className="mb-3 block text-[11px] font-bold uppercase tracking-widest text-ch-on-surface-variant">
                      First Admin Name{" "}
                      <span className="font-normal lowercase opacity-50">
                        (optional)
                      </span>
                    </label>
                    <CoreInput
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="John Doe"
                      className="bg-ch-surface-container-low p-4"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-3 block text-[11px] font-bold uppercase tracking-widest text-ch-on-surface-variant">
                    Internal Notes
                  </label>
                  <CoreTextarea
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    placeholder="Mention contract details or internal reference numbers..."
                    rows={4}
                    className="resize-none bg-ch-surface-container-low p-4"
                  />
                </div>

                <div className="pt-4">
                  <CorePrimaryButton
                    type="submit"
                    disabled={busy}
                    className="gap-3 px-10 lg:w-auto"
                  >
                    <span>{busy ? "Provisioning…" : "Create & Send Invite"}</span>
                    <Send className="h-5 w-5" aria-hidden />
                  </CorePrimaryButton>
                  <p className="mt-4 text-[10px] leading-relaxed text-ch-on-surface-variant">
                    By clicking create, the system will immediately provision a new
                    database partition, storage bucket, and dispatch an automated
                    onboarding email to the primary administrator specified above.
                  </p>
                </div>
              </form>
            </section>
          </div>

          <div className="space-y-6 lg:col-span-5">
            <div className="rounded-ch-lg bg-ch-surface-container-low p-8">
              <h3 className="mb-4 flex items-center gap-2 font-chHeadline text-lg font-bold text-ch-on-surface">
                <Info className="h-5 w-5 shrink-0 text-ch-primary" aria-hidden />
                Deployment Logistics
              </h3>
              <ul className="space-y-6">
                <li className="flex gap-4">
                  <span className="font-chHeadline text-2xl font-black text-ch-primary-fixed-dim opacity-40">
                    01
                  </span>
                  <div>
                    <p className="font-chBody text-sm font-semibold text-ch-on-surface">
                      Environment Isolation
                    </p>
                    <p className="mt-1 font-chBody text-xs text-ch-on-surface-variant">
                      Orgs are logically separated at the database level to ensure
                      maximum security and zero cross-contamination.
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="font-chHeadline text-2xl font-black text-ch-primary-fixed-dim opacity-40">
                    02
                  </span>
                  <div>
                    <p className="font-chBody text-sm font-semibold text-ch-on-surface">
                      Admin Provisioning
                    </p>
                    <p className="mt-1 font-chBody text-xs text-ch-on-surface-variant">
                      The first admin will receive full owner permissions and can
                      create secondary roles upon login.
                    </p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="font-chHeadline text-2xl font-black text-ch-primary-fixed-dim opacity-40">
                    03
                  </span>
                  <div>
                    <p className="font-chBody text-sm font-semibold text-ch-on-surface">
                      Billing Anchor
                    </p>
                    <p className="mt-1 font-chBody text-xs text-ch-on-surface-variant">
                      This organization will be attached to your master ledger.
                      Usage metrics start aggregating immediately.
                    </p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="group relative h-64 overflow-hidden rounded-ch-lg shadow-sm">
              <div className="absolute inset-0 z-10 bg-stone-900/40 transition-colors duration-500 group-hover:bg-stone-900/20" />
              <Image
                src={ARCH_HERO_IMAGE}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 480px"
              />
              <div className="absolute bottom-0 left-0 z-20 p-6">
                <span className="mb-2 inline-block rounded bg-ch-primary-container px-3 py-1 font-chBody text-[10px] font-bold uppercase tracking-widest text-ch-on-primary-container">
                  Architectural Standard
                </span>
                <h4 className="font-chHeadline text-xl font-bold text-white">
                  Built for Scale
                </h4>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
