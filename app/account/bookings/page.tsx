import { listBookingsForBuyer } from "@/lib/actions/account";
import { Calendar, Clock } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
  CONFIRMED: "bg-blue-50 text-blue-700 ring-blue-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CANCELLED: "bg-gray-100 text-gray-600 ring-gray-200",
  NO_SHOW: "bg-red-50 text-red-700 ring-red-200",
};

export default async function BookingsPage() {
  const bookings = await listBookingsForBuyer();

  if (bookings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center">
        <Calendar className="mx-auto mb-3 h-8 w-8 text-slate-300" />
        <p className="text-sm text-slate-500">No bookings yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {bookings.map((b) => (
        <div key={b.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">{b.service.name}</div>
            <div className="text-xs text-slate-500">{b.store.name}</div>
            <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
              <Clock className="h-3 w-3" />
              {new Date(b.scheduledAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${STATUS_STYLES[b.status] ?? STATUS_STYLES.PENDING}`}>
            {b.status}
          </span>
        </div>
      ))}
    </div>
  );
}
