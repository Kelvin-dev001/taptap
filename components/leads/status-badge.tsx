import { Badge } from "@/components/ui";
import { STATUS_META, type LeadStatus } from "@/lib/leads";

export function StatusBadge({ status }: { status: LeadStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.new;
  return (
    <Badge variant={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}
