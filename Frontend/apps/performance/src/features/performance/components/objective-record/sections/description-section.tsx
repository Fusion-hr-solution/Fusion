import type { ObjectiveRecord } from "../objective-record-model";
import { RECORD_SURFACE, RecordSection } from "./record-primitives";

export function DescriptionSection({ record }: { record: ObjectiveRecord }) {
  if (!record.description) return null;
  return (
    <RecordSection label="Description">
      <p className={`${RECORD_SURFACE} text-sm leading-relaxed text-foreground`}>{record.description}</p>
    </RecordSection>
  );
}
