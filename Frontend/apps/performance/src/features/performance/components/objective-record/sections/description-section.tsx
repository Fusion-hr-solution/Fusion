import type { ObjectiveRecord } from "../objective-record-model";
import { RECORD_SURFACE, RecordSection } from "./record-primitives";
import { useTranslations } from "next-intl";

export function DescriptionSection({ record }: { record: ObjectiveRecord }) {
  const t = useTranslations("objective.DescriptionSection");
  if (!record.description) return null;
  return (
    <RecordSection label={t("description")}>
      <p className={`${RECORD_SURFACE} text-sm leading-relaxed text-foreground`}>{record.description}</p>
    </RecordSection>
  );
}
