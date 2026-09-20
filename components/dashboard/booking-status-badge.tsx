const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-200",
  CONFIRMED: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200",
  CHECKED_IN: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-200",
  SEATED: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-200",
  COMPLETED: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200",
  CANCELLED: "bg-muted text-muted-foreground dark:bg-[#102544] dark:text-[#b8c8df]",
  NO_SHOW: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200",
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
