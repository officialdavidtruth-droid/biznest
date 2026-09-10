"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  Mail,
  Phone,
  Plus,
  Search,
  Target,
  Users,
  XCircle,
} from "lucide-react";
import { createCrmLead, updateCrmLeadStatus } from "@/lib/actions/seo-crm";

type LeadActivity = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  createdAt: Date;
};

type Lead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string;
  status: string;
  value: any;
  currency: string;
  notes: string | null;
  nextFollowUpAt: Date | null;
  activities: LeadActivity[];
};

const stages = [
  ["NEW", "New"],
  ["CONTACTED", "Contacted"],
  ["QUALIFIED", "Qualified"],
  ["PROPOSAL", "Proposal"],
  ["WON", "Won"],
  ["LOST", "Lost"],
] as const;

const stageTone: Record<string, string> = {
  NEW: "bg-slate-100 text-slate-700",
  CONTACTED: "bg-blue-100 text-blue-700",
  QUALIFIED: "bg-violet-100 text-violet-700",
  PROPOSAL: "bg-amber-100 text-amber-700",
  WON: "bg-emerald-100 text-emerald-700",
  LOST: "bg-rose-100 text-rose-700",
};

export function CrmWorkspace({
  slug,
  initial,
}: {
  slug: string;
  initial: {
    leads: Lead[];
    customerCount: number;
    wonCount: number;
    wonValue: number;
  };
}) {
  const [leads, setLeads] = useState<Lead[]>(initial.leads);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  const filtered = leads.filter((lead) => {
    const haystack = [lead.name, lead.email, lead.phone, lead.company]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  const move = (id: string, status: string) => {
    start(async () => {
      const result = await updateCrmLeadStatus(slug, id, status);
      if (result.success) {
        setLeads((current) =>
          current.map((lead) =>
            lead.id === id ? { ...lead, status } : lead,
          ),
        );
        setSelected((current) =>
          current && current.id === id ? { ...current, status } : current,
        );
      } else {
        setMsg(result.error || "Could not update lead.");
      }
    });
  };

  const add = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    start(async () => {
      const result = await createCrmLead(slug, {
        name: String(form.get("name") || ""),
        email: String(form.get("email") || ""),
        phone: String(form.get("phone") || ""),
        company: String(form.get("company") || ""),
        source: String(form.get("source") || "MANUAL"),
        value: Number(form.get("value") || 0),
        notes: String(form.get("notes") || ""),
      });

      if (result.success) {
        setShowNew(false);
        window.location.reload();
      } else {
        setMsg(result.error || "Could not create lead.");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={Users}
          label="Customer records"
          value={initial.customerCount.toLocaleString()}
          sub="All known customers"
        />
        <Metric
          icon={Target}
          label="Open leads"
          value={leads
            .filter((lead) => !["WON", "LOST"].includes(lead.status))
            .length.toLocaleString()}
          sub="Active opportunities"
        />
        <Metric
          icon={CheckCircle2}
          label="Won deals"
          value={initial.wonCount.toLocaleString()}
          sub="Closed successfully"
        />
        <Metric
          icon={ArrowRight}
          label="Won value"
          value={`₦${initial.wonValue.toLocaleString()}`}
          sub="Pipeline revenue"
        />
      </div>

      <div className="rounded-3xl border bg-background shadow-sm">
        <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold">Sales pipeline</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Move every opportunity from first contact to closed deal.
            </p>
          </div>

          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search leads..."
                className="w-64 rounded-xl border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowNew(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              Add lead
            </button>
          </div>
        </div>

        <div className="grid gap-4 overflow-x-auto p-5 xl:grid-cols-6">
          {stages.map(([key, label]) => (
            <div
              key={key}
              className="min-w-[220px] rounded-2xl bg-muted/35 p-3"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      key === "WON"
                        ? "bg-emerald-500"
                        : key === "LOST"
                          ? "bg-rose-500"
                          : "bg-primary"
                    }`}
                  />
                  <span className="text-xs font-bold">{label}</span>
                </div>
                <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold">
                  {filtered.filter((lead) => lead.status === key).length}
                </span>
              </div>

              <div className="space-y-2">
                {filtered
                  .filter((lead) => lead.status === key)
                  .map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => setSelected(lead)}
                      className="w-full rounded-xl border bg-background p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="line-clamp-1 text-sm font-semibold">
                          {lead.name}
                        </span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                            stageTone[lead.status] || stageTone.NEW
                          }`}
                        >
                          {lead.source}
                        </span>
                      </div>

                      {lead.company && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          {lead.company}
                        </p>
                      )}

                      <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>
                          {lead.value
                            ? `₦${Number(lead.value).toLocaleString()}`
                            : "No value"}
                        </span>
                        {lead.nextFollowUpAt && (
                          <span className="flex items-center gap-1">
                            <CalendarClock className="h-3 w-3" />
                            {new Date(lead.nextFollowUpAt).toLocaleDateString(
                              "en-NG",
                            )}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {msg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {msg}
        </div>
      )}

      {showNew && (
        <Modal title="Add a new lead" onClose={() => setShowNew(false)}>
          <form onSubmit={add} className="grid gap-3">
            <Input name="name" label="Full name *" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input name="email" label="Email" />
              <Input name="phone" label="Phone" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input name="company" label="Company" />
              <label className="grid gap-1.5 text-xs font-medium">
                Source
                <select
                  name="source"
                  className="rounded-xl border bg-background px-3 py-2.5 text-sm font-normal"
                >
                  <option value="MANUAL">Manual</option>
                  <option value="WEBSITE">Website</option>
                  <option value="FORM">Form</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="REFERRAL">Referral</option>
                  <option value="SOCIAL">Social</option>
                </select>
              </label>
            </div>
            <Input name="value" label="Estimated value (₦)" type="number" />
            <label className="grid gap-1.5 text-xs font-medium">
              Notes
              <textarea
                name="notes"
                rows={3}
                className="rounded-xl border bg-background p-3 text-sm font-normal"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="mt-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
            >
              {pending ? "Saving…" : "Create lead"}
            </button>
          </form>
        </Modal>
      )}

      {selected && (
        <Modal title={selected.name} onClose={() => setSelected(null)}>
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  stageTone[selected.status] || stageTone.NEW
                }`}
              >
                {selected.status}
              </span>

              {selected.email && (
                <a
                  href={`mailto:${selected.email}`}
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold"
                >
                  <Mail className="h-3 w-3" />
                  Email
                </a>
              )}

              {selected.phone && (
                <a
                  href={`tel:${selected.phone}`}
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold"
                >
                  <Phone className="h-3 w-3" />
                  Call
                </a>
              )}
            </div>

            <label className="grid gap-1.5 text-xs font-medium">
              Move stage
              <select
                value={selected.status}
                onChange={(event) => {
                  const nextStatus = event.target.value;
                  setSelected({ ...selected, status: nextStatus });
                  move(selected.id, nextStatus);
                }}
                className="rounded-xl border bg-background px-3 py-2.5 text-sm"
              >
                <option value={selected.status}>{selected.status}</option>
                {stages
                  .filter(([stage]) => stage !== selected.status)
                  .map(([stage, stageLabel]) => (
                    <option key={stage} value={stage}>
                      {stageLabel}
                    </option>
                  ))}
              </select>
            </label>

            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Activity
              </h3>

              {selected.activities.length > 0 ? (
                <div className="space-y-3">
                  {selected.activities.map((activity) => (
                    <div key={activity.id} className="rounded-xl border p-3">
                      <p className="text-sm font-medium">{activity.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {activity.body}
                      </p>
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        {new Date(activity.createdAt).toLocaleString("en-NG")}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed p-5 text-center text-xs text-muted-foreground">
                  No activity yet.
                </p>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: any;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border bg-background p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function Input({
  name,
  label,
  type = "text",
}: {
  name: string;
  label: string;
  type?: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-medium">
      {label}
      <input
        name={name}
        type={type}
        className="rounded-xl border bg-background px-3 py-2.5 text-sm font-normal outline-none focus:border-primary"
      />
    </label>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-3xl border bg-background p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 hover:bg-muted"
            aria-label="Close"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
