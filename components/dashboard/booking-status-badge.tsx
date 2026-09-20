const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-[var(--bn-admin-orange-soft)] text-[var(--bn-admin-orange)] dark:bg-[var(--bn-admin-orange-soft)] dark:text-[var(--bn-admin-orange)]",
  CONFIRMED: "bg-[var(--bn-admin-surface-2)] text-[var(--bn-admin-orange)] dark:bg-[var(--bn-admin-surface-2)] dark:text-[var(--bn-admin-orange)]",
  CHECKED_IN: "bg-[var(--bn-admin-surface-2)] text-[var(--bn-admin-orange)] dark:bg-[var(--bn-admin-surface-2)] dark:text-[var(--bn-admin-orange)]",
  SEATED: "bg-[var(--bn-admin-surface-2)] text-[var(--bn-admin-orange)] dark:bg-[var(--bn-admin-surface-2)] dark:text-[var(--bn-admin-orange)]",
  COMPLETED: "bg-[var(--bn-admin-surface-2)] text-[var(--bn-admin-orange)] dark:bg-[var(--bn-admin-surface-2)] dark:text-[var(--bn-admin-orange)]",
  CANCELLED: "bg-muted text-muted-foreground dark:bg-[var(--bn-admin-page)] dark:text-[var(--bn-admin-muted)]",
  NO_SHOW: "bg-[var(--bn-admin-danger-soft)] text-[var(--bn-admin-danger)] dark:bg-[var(--bn-admin-danger-soft)] dark:text-[var(--bn-admin-danger)]",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Upcoming",
  CONFIRMED: "Upcoming",
  CHECKED_IN: "Checked In",
  SEATED: "Seated",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No Show",
};

export function BookingStatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? "bg-muted text-muted-foreground"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
