"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  BedDouble,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  Clock3,
  CreditCard,
  DoorOpen,
  Download,
  Hotel,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  UserRound,
  Users,
  WalletCards,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  cancelReservation,
  checkInReservation,
  checkOutReservation,
  createGuest,
  createReservation,
  createRoom,
  chargeReservationDeposit,
  markReservationNoShow,
  updateRoomStatus,
} from "@/lib/actions/pms";

const ROOM_STATUSES = ["AVAILABLE", "OCCUPIED", "RESERVED", "DIRTY", "CLEANING", "MAINTENANCE", "OUT_OF_SERVICE"] as const;

type PmsWorkspaceProps = {
  slug: string;
  storeName: string;
  rooms: any[];
  guests: any[];
  reservations: any[];
};

type Tab = "dashboard" | "reservations" | "calendar" | "frontdesk" | "rooms" | "housekeeping" | "guests" | "billing";

const nav: Array<{ id: Tab; label: string; icon: any }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "reservations", label: "Reservations", icon: ClipboardCheck },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "frontdesk", label: "Front Desk", icon: DoorOpen },
  { id: "rooms", label: "Rooms", icon: BedDouble },
  { id: "housekeeping", label: "Housekeeping", icon: Sparkles },
  { id: "guests", label: "Guests", icon: Users },
  { id: "billing", label: "Billing & Payments", icon: CreditCard },
];

function money(value: number) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

function date(value: string | Date) {
  return new Date(value).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function dateTime(value: string | Date) {
  return new Date(value).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/(^| )\w/g, (m) => m.toUpperCase());
}

function statusClass(value: string) {
  if (value === "AVAILABLE" || value === "CHECKED_IN" || value === "PAID" || value === "INSPECTED") return "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
  if (value === "RESERVED" || value === "CONFIRMED" || value === "PENDING") return "bg-sky-500/10 text-sky-300 border-sky-500/20";
  if (value === "DIRTY" || value === "CLEANING") return "bg-amber-500/10 text-amber-300 border-amber-500/20";
  if (value === "MAINTENANCE" || value === "OUT_OF_SERVICE" || value === "CANCELLED") return "bg-rose-500/10 text-rose-300 border-rose-500/20";
  return "bg-white/5 text-white/70 border-white/10";
}

export function PmsWorkspace({ slug, storeName, rooms: initialRooms, guests: initialGuests, reservations: initialReservations }: PmsWorkspaceProps) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [rooms, setRooms] = useState(initialRooms);
  const [guests, setGuests] = useState(initialGuests);
  const [reservations, setReservations] = useState(initialReservations);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [showReservationForm, setShowReservationForm] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomType, setRoomType] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestId, setGuestId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");

  const stats = useMemo(() => {
    const activeReservations = reservations.filter((r) => ["PENDING", "CONFIRMED", "CHECKED_IN"].includes(r.status));
    const occupied = rooms.filter((r) => r.status === "OCCUPIED").length;
    const sellable = rooms.filter((r) => !["OUT_OF_SERVICE", "MAINTENANCE"].includes(r.status)).length;
    const occupancy = sellable ? Math.round((occupied / sellable) * 100) : 0;
    const arrivals = reservations.filter((r) => r.status === "CONFIRMED" && new Date(r.checkIn).toDateString() === new Date().toDateString()).length;
    const departures = reservations.filter((r) => r.status === "CHECKED_IN" && new Date(r.checkOut).toDateString() === new Date().toDateString()).length;
    return { activeReservations, occupied, sellable, occupancy, arrivals, departures };
  }, [rooms, reservations]);

  const filteredReservations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reservations;
    return reservations.filter((r) => `${r.guest?.fullName} ${r.room?.name} ${r.id} ${r.status}`.toLowerCase().includes(q));
  }, [reservations, search]);

  async function run(action: () => Promise<any>, success = "Saved") {
    setBusy(true);
    try {
      const result = await action();
      if (!result.success) toast.error(result.error);
      else toast.success(success);
      return result;
    } finally {
      setBusy(false);
    }
  }

  async function addRoom(e: React.FormEvent) {
    e.preventDefault();
    const result = await run(() => createRoom(slug, { name: roomName, roomType }), "Room added");
    if (result?.success) { setRoomName(""); setRoomType(""); setShowRoomForm(false); window.location.reload(); }
  }

  async function addGuest(e: React.FormEvent) {
    e.preventDefault();
    const result = await run(() => createGuest(slug, { fullName: guestName, email: guestEmail, phone: guestPhone }), "Guest created");
    if (result?.success) { setGuestName(""); setGuestEmail(""); setGuestPhone(""); setShowGuestForm(false); window.location.reload(); }
  }

  async function addReservation(e: React.FormEvent) {
    e.preventDefault();
    const result = await run(() => createReservation(slug, { guestId, roomId, checkIn, checkOut }), "Reservation confirmed");
    if (result?.success) { setShowReservationForm(false); window.location.reload(); }
  }

  async function roomStatus(room: any, status: string) {
    const result = await run(() => updateRoomStatus(slug, room.id, status as any), "Room status updated");
    if (result?.success) setRooms((items) => items.map((r) => r.id === room.id ? { ...r, status } : r));
  }

  async function requestPayment(reservation: any) {
    const amountStr = window.prompt("Deposit amount to request (NGN):", reservation.depositAmount ? String(Number(reservation.depositAmount)) : "");
    if (!amountStr) return;
    const amount = Number(amountStr);
    if (!Number.isFinite(amount) || amount <= 0) { toast.error("Enter a valid amount."); return; }
    const result = await run(() => chargeReservationDeposit(slug, reservation.id, amount, reservation.guest?.email), "Payment link created");
    if (result?.success) {
      await navigator.clipboard?.writeText(result.data.authorizationUrl).catch(() => {});
      window.open(result.data.authorizationUrl, "_blank");
    }
  }

  async function reservationAction(action: () => Promise<any>, reservationId: string, message: string) {
    const result = await run(action, message);
    if (result?.success) {
      if (message === "Checked in") setReservations((items) => items.map((r) => r.id === reservationId ? { ...r, status: "CHECKED_IN", guestPresence: "IN" } : r));
      if (message === "Checked out") setReservations((items) => items.map((r) => r.id === reservationId ? { ...r, status: "CHECKED_OUT", guestPresence: "OUT" } : r));
      if (["Reservation cancelled", "Marked no-show"].includes(message)) setReservations((items) => items.map((r) => r.id === reservationId ? { ...r, status: message === "Marked no-show" ? "NO_SHOW" : "CANCELLED" } : r));
    }
  }

  return (
    <div className="flex min-h-screen bg-[#07130e] text-white">
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/10 bg-[#091711] transition-transform lg:static lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300"><Hotel className="h-5 w-5" /></div>
          <div className="min-w-0"><p className="text-sm font-semibold tracking-wide">BIZNEST PMS</p><p className="text-[11px] text-white/45">Property Management System</p></div>
          <button className="ml-auto lg:hidden" onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <div className="mx-4 mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Property</p>
          <p className="mt-1 truncate text-sm font-semibold">{storeName}</p>
          <p className="mt-0.5 text-xs text-emerald-300">Business Mogul · PMS Active</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          {nav.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => { setTab(item.id); setMobileOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${tab === item.id ? "bg-emerald-400/10 text-emerald-300" : "text-white/60 hover:bg-white/[0.04] hover:text-white"}`}><Icon className="h-4 w-4" /><span>{item.label}</span></button>; })}
          <div className="my-4 border-t border-white/10" />
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/60 hover:bg-white/[0.04] hover:text-white"><Wrench className="h-4 w-4" />Maintenance</button>
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/60 hover:bg-white/[0.04] hover:text-white"><Activity className="h-4 w-4" />Reports & Analytics</button>
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/60 hover:bg-white/[0.04] hover:text-white"><Settings className="h-4 w-4" />PMS Settings</button>
        </nav>
        <div className="border-t border-white/10 p-4"><a href={`/${slug}/admin`} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-white/50 hover:bg-white/[0.04] hover:text-white"><ChevronLeft className="h-4 w-4" />Back to BizNest Admin</a></div>
      </aside>

      {mobileOpen && <button aria-label="Close PMS menu" className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <section className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-20 items-center gap-3 border-b border-white/10 bg-[#07130e]/95 px-4 backdrop-blur md:px-7">
          <button className="rounded-lg p-2 hover:bg-white/5 lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></button>
          <div className="min-w-0 flex-1"><p className="text-xs text-white/40">{storeName}</p><h1 className="truncate text-lg font-semibold">{nav.find((n) => n.id === tab)?.label}</h1></div>
          <div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 md:flex"><Search className="h-4 w-4 text-white/35" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reservations, guests…" className="w-52 border-0 bg-transparent p-0 text-sm text-white placeholder:text-white/30 focus:ring-0" /></div>
          <button className="rounded-xl border border-white/10 p-2.5 text-white/60 hover:bg-white/5"><Bell className="h-4 w-4" /></button>
          <div className="hidden items-center gap-2 border-l border-white/10 pl-3 sm:flex"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300"><UserRound className="h-4 w-4" /></div><div><p className="text-xs font-medium">Hotel Admin</p><p className="text-[10px] text-white/40">Business Mogul</p></div></div>
        </header>

        <main className="mx-auto max-w-[1500px] p-4 md:p-7">
          {tab === "dashboard" && <Dashboard stats={stats} rooms={rooms} reservations={reservations} setTab={setTab} />}
          {tab === "reservations" && <Reservations slug={slug} reservations={filteredReservations} search={search} setSearch={setSearch} onCreate={() => setShowReservationForm(true)} onAction={reservationAction} />}
          {tab === "calendar" && <CalendarView rooms={rooms} reservations={reservations} />}
          {tab === "frontdesk" && <FrontDesk slug={slug} reservations={reservations} onAction={reservationAction} />}
          {tab === "rooms" && <Rooms rooms={rooms} onAdd={() => setShowRoomForm(true)} onStatus={roomStatus} />}
          {tab === "housekeeping" && <Housekeeping rooms={rooms} onStatus={roomStatus} />}
          {tab === "guests" && <Guests guests={guests} reservations={reservations} onAdd={() => setShowGuestForm(true)} />}
          {tab === "billing" && <Billing slug={slug} reservations={reservations} onAction={reservationAction} />}
        </main>
      </section>

      {showRoomForm && <Modal title="Add room" onClose={() => setShowRoomForm(false)}><form onSubmit={addRoom} className="space-y-4"><Field label="Room name" value={roomName} onChange={setRoomName} placeholder="Room 101" /><Field label="Room type" value={roomType} onChange={setRoomType} placeholder="Deluxe King" /><button disabled={busy} className="w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-[#06110c]">{busy ? "Saving…" : "Add room"}</button></form></Modal>}
      {showGuestForm && <Modal title="Create guest" onClose={() => setShowGuestForm(false)}><form onSubmit={addGuest} className="space-y-4"><Field label="Full name" value={guestName} onChange={setGuestName} placeholder="John Doe" /><Field label="Email" value={guestEmail} onChange={setGuestEmail} placeholder="guest@example.com" /><Field label="Phone" value={guestPhone} onChange={setGuestPhone} placeholder="080…" /><button disabled={busy} className="w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-[#06110c]">{busy ? "Saving…" : "Create guest"}</button></form></Modal>}
      {showReservationForm && <Modal title="New reservation" onClose={() => setShowReservationForm(false)}><form onSubmit={addReservation} className="space-y-4"><SelectField label="Guest" value={guestId} onChange={setGuestId} options={guests.map((g) => [g.id, g.fullName])} /><SelectField label="Room" value={roomId} onChange={setRoomId} options={rooms.filter((r) => !["OUT_OF_SERVICE", "MAINTENANCE"].includes(r.status)).map((r) => [r.id, `${r.name} — ${r.roomType}`])} /><Field label="Check-in" type="datetime-local" value={checkIn} onChange={setCheckIn} /><Field label="Check-out" type="datetime-local" value={checkOut} onChange={setCheckOut} /><button disabled={busy} className="w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-[#06110c]">{busy ? "Saving…" : "Confirm reservation"}</button></form></Modal>}
    </div>
  );
}

function Dashboard({ stats, rooms, reservations, setTab }: any) {
  const cards = [
    ["Occupancy Rate", `${stats.occupancy}%`, "Current sellable inventory", Activity],
    ["Occupied Rooms", `${stats.occupied}/${stats.sellable}`, "Rooms currently in use", BedDouble],
    ["Today's Arrivals", stats.arrivals, "Confirmed check-ins", DoorOpen],
    ["Today's Departures", stats.departures, "Expected check-outs", LogOut],
  ];
  return <div className="space-y-7">
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-sm text-emerald-300">Good morning</p><h2 className="mt-1 text-3xl font-semibold tracking-tight">Property overview</h2><p className="mt-2 text-sm text-white/45">Everything your team needs to run today's stay operations.</p></div><div className="flex gap-2"><button onClick={() => setTab("reservations")} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/75 hover:bg-white/5">View reservations</button><button onClick={() => setTab("frontdesk")} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-[#06110c]">Open front desk</button></div></div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, sub, Icon]: any) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><div className="flex items-center justify-between"><span className="text-sm text-white/55">{label}</span><span className="rounded-xl bg-emerald-400/10 p-2.5 text-emerald-300"><Icon className="h-4 w-4" /></span></div><p className="mt-5 text-3xl font-semibold">{value}</p><p className="mt-1 text-xs text-white/35">{sub}</p></div>)}</div>
    <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><div className="flex items-center justify-between"><div><h3 className="font-semibold">Room status</h3><p className="mt-1 text-xs text-white/35">Live inventory across the property</p></div><button onClick={() => setTab("rooms")} className="text-xs text-emerald-300">Manage rooms →</button></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{rooms.slice(0, 9).map((room: any) => <div key={room.id} className="rounded-xl border border-white/10 bg-black/10 p-3"><div className="flex items-center justify-between"><div><p className="text-sm font-medium">{room.name}</p><p className="text-[11px] text-white/35">{room.roomType}</p></div><BedDouble className="h-4 w-4 text-white/25" /></div><span className={`mt-3 inline-flex rounded-full border px-2 py-1 text-[10px] ${statusClass(room.status)}`}>{statusLabel(room.status)}</span></div>)}</div></div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><div className="flex items-center justify-between"><div><h3 className="font-semibold">Today's activity</h3><p className="mt-1 text-xs text-white/35">Latest reservations and arrivals</p></div><Clock3 className="h-4 w-4 text-white/30" /></div><div className="mt-4 space-y-2">{reservations.slice(0, 6).map((r: any) => <div key={r.id} className="flex items-center justify-between rounded-xl px-2 py-3 hover:bg-white/[0.03]"><div className="min-w-0"><p className="truncate text-sm font-medium">{r.guest?.fullName}</p><p className="text-[11px] text-white/35">{r.room?.name} · {dateTime(r.checkIn)}</p></div><span className={`ml-3 shrink-0 rounded-full border px-2 py-1 text-[10px] ${statusClass(r.status)}`}>{statusLabel(r.status)}</span></div>)}{reservations.length === 0 && <Empty text="No reservations yet" />}</div></div>
    </div>
    <div className="grid gap-4 md:grid-cols-3"><Quick label="New reservation" icon={Plus} onClick={() => setTab("reservations")} text="Create and manage stays" /><Quick label="Housekeeping" icon={Sparkles} onClick={() => setTab("housekeeping")} text="See rooms waiting for cleaning" /><Quick label="Billing" icon={WalletCards} onClick={() => setTab("billing")} text="Review payment status" /></div>
  </div>;
}

function Reservations({ slug, reservations, search, setSearch, onCreate, onAction }: any) {
  return <div className="space-y-5"><Toolbar title="Reservations" subtitle="Manage every stay from confirmation to check-out." action="New reservation" onAction={onCreate} search={search} setSearch={setSearch} /><div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-white/10 text-xs text-white/35"><tr>{["Guest", "Room", "Stay", "Status", "Payment", "Actions"].map((x) => <th key={x} className="px-5 py-4 font-medium">{x}</th>)}</tr></thead><tbody>{reservations.map((r: any) => <tr key={r.id} className="border-b border-white/5 last:border-0"><td className="px-5 py-4"><p className="font-medium">{r.guest?.fullName}</p><p className="mt-1 text-[11px] text-white/35">{r.guest?.phone || r.guest?.email || "Guest profile"}</p></td><td className="px-5 py-4"><p>{r.room?.name}</p><p className="mt-1 text-[11px] text-white/35">{r.room?.roomType}</p></td><td className="px-5 py-4"><p>{date(r.checkIn)} → {date(r.checkOut)}</p><p className="mt-1 text-[11px] text-white/35">{r.id.slice(-8).toUpperCase()}</p></td><td className="px-5 py-4"><span className={`rounded-full border px-2 py-1 text-[10px] ${statusClass(r.status)}`}>{statusLabel(r.status)}</span></td><td className="px-5 py-4"><span className={`rounded-full border px-2 py-1 text-[10px] ${statusClass(r.paymentStatus)}`}>{statusLabel(r.paymentStatus || "UNPAID")}</span></td><td className="px-5 py-4"><div className="flex gap-1.5">{["PENDING", "CONFIRMED"].includes(r.status) && <><button onClick={() => onAction(() => checkInReservation(slug, r.id), r.id, "Checked in")} className="rounded-lg bg-emerald-400/10 px-2.5 py-1.5 text-[11px] text-emerald-300">Check in</button><button onClick={() => onAction(() => cancelReservation(slug, r.id), r.id, "Reservation cancelled")} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-white/55">Cancel</button></>}{r.status === "CHECKED_IN" && <button onClick={() => onAction(() => checkOutReservation(slug, r.id), r.id, "Checked out")} className="rounded-lg bg-emerald-400/10 px-2.5 py-1.5 text-[11px] text-emerald-300">Check out</button>}</div></td></tr>)}{reservations.length === 0 && <tr><td colSpan={6} className="px-5 py-14"><Empty text="No reservations match your search" /></td></tr>}</tbody></table></div></div></div>;
}

function CalendarView({ rooms, reservations }: any) {
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });
  return <div className="space-y-5"><div><h2 className="text-2xl font-semibold">Reservation calendar</h2><p className="mt-1 text-sm text-white/40">Seven-day room occupancy at a glance.</p></div><div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.025]"><div className="min-w-[950px]"><div className="grid grid-cols-[180px_repeat(7,1fr)] border-b border-white/10"><div className="p-4 text-xs text-white/35">Room</div>{days.map((d) => <div key={d.toISOString()} className="border-l border-white/10 p-4"><p className="text-xs text-white/35">{d.toLocaleDateString(undefined, { weekday: "short" })}</p><p className="mt-1 text-sm font-semibold">{d.getDate()} {d.toLocaleDateString(undefined, { month: "short" })}</p></div>)}</div>{rooms.map((room: any) => <div key={room.id} className="grid grid-cols-[180px_repeat(7,1fr)] border-b border-white/5 last:border-0"><div className="p-4"><p className="text-sm font-medium">{room.name}</p><p className="mt-1 text-[10px] text-white/35">{room.roomType}</p></div>{days.map((d) => { const booking = reservations.find((r: any) => r.roomId === room.id && new Date(r.checkIn) <= new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59) && new Date(r.checkOut) > new Date(d.getFullYear(), d.getMonth(), d.getDate())); return <div key={d.toISOString()} className="border-l border-white/5 p-2">{booking ? <div className={`h-full min-h-12 rounded-lg border px-2 py-2 text-[10px] ${statusClass(booking.status)}`}><p className="truncate font-medium">{booking.guest?.fullName}</p><p className="mt-1 opacity-70">{statusLabel(booking.status)}</p></div> : <div className="min-h-12 rounded-lg border border-dashed border-white/5" />}</div>; })}</div>)}</div></div></div>;
}

function FrontDesk({ slug, reservations, onAction }: any) {
  const arrivals = reservations.filter((r: any) => ["PENDING", "CONFIRMED"].includes(r.status));
  const inHouse = reservations.filter((r: any) => r.status === "CHECKED_IN");
  return <div className="space-y-6"><div><h2 className="text-2xl font-semibold">Front Desk</h2><p className="mt-1 text-sm text-white/40">Fast check-in, check-out and guest presence controls.</p></div><div className="grid gap-5 xl:grid-cols-2"><DeskList title="Arrivals & pending check-ins" icon={DoorOpen} items={arrivals} action="Check in" onAction={(r: any) => onAction(() => checkInReservation(slug, r.id), r.id, "Checked in")} /><DeskList title="Guests in-house" icon={Users} items={inHouse} action="Check out" onAction={(r: any) => onAction(() => checkOutReservation(slug, r.id), r.id, "Checked out")} /></div></div>;
}

function Rooms({ rooms, onAdd, onStatus }: any) { return <div className="space-y-5"><Toolbar title="Rooms" subtitle="Manage room inventory and operational status." action="Add room" onAction={onAdd} /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{rooms.map((r: any) => <div key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><div className="flex items-start justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300"><BedDouble className="h-5 w-5" /></div><span className={`rounded-full border px-2 py-1 text-[10px] ${statusClass(r.status)}`}>{statusLabel(r.status)}</span></div><h3 className="mt-5 font-semibold">{r.name}</h3><p className="mt-1 text-xs text-white/35">{r.roomType}</p><select value={r.status} onChange={(e) => onStatus(r, e.target.value)} className="mt-5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-xs text-white"><option className="bg-[#091711]" value="AVAILABLE">Available</option>{ROOM_STATUSES.filter((s) => s !== "AVAILABLE").map((s) => <option className="bg-[#091711]" key={s} value={s}>{statusLabel(s)}</option>)}</select></div>)}{rooms.length === 0 && <Empty text="No rooms configured" />}</div></div>; }

function Housekeeping({ rooms, onStatus }: any) { const items = rooms.filter((r: any) => ["DIRTY", "CLEANING", "MAINTENANCE", "AVAILABLE"].includes(r.status)); return <div className="space-y-5"><div><h2 className="text-2xl font-semibold">Housekeeping</h2><p className="mt-1 text-sm text-white/40">Keep room readiness visible to the whole team.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((r: any) => <div key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><div className="flex items-center justify-between"><div><p className="font-semibold">{r.name}</p><p className="mt-1 text-xs text-white/35">{r.roomType}</p></div><Sparkles className="h-5 w-5 text-amber-300" /></div><span className={`mt-4 inline-flex rounded-full border px-2 py-1 text-[10px] ${statusClass(r.status)}`}>{statusLabel(r.status)}</span><div className="mt-5 grid grid-cols-2 gap-2">{r.status !== "CLEANING" && <button onClick={() => onStatus(r, "CLEANING")} className="rounded-xl bg-emerald-400 px-3 py-2 text-xs font-semibold text-[#06110c]">Start cleaning</button>}<button onClick={() => onStatus(r, "AVAILABLE")} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/60">Mark ready</button></div></div>)}</div></div>; }

function Guests({ guests, reservations, onAdd }: any) { return <div className="space-y-5"><Toolbar title="Guests" subtitle="Central guest profiles and stay history." action="Add guest" onAction={onAdd} /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{guests.map((g: any) => { const stays = reservations.filter((r: any) => r.guestId === g.id); return <div key={g.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-white/60"><UserRound className="h-5 w-5" /></div><div className="min-w-0"><p className="truncate font-semibold">{g.fullName}</p><p className="truncate text-xs text-white/35">{g.email || g.phone || "No contact"}</p></div></div><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-black/15 p-3"><p className="text-[10px] text-white/35">Stays</p><p className="mt-1 text-lg font-semibold">{stays.length}</p></div><div className="rounded-xl bg-black/15 p-3"><p className="text-[10px] text-white/35">Current</p><p className="mt-1 text-lg font-semibold">{stays.filter((s: any) => s.status === "CHECKED_IN").length ? "In-house" : "—"}</p></div></div></div>; })}{guests.length === 0 && <Empty text="No guests yet" />}</div></div>; }

function Billing({ slug, reservations, onAction }: any) { const unpaid = reservations.filter((r: any) => r.paymentStatus !== "PAID" && !["CANCELLED", "NO_SHOW"].includes(r.status)); const paid = reservations.filter((r: any) => r.paymentStatus === "PAID"); return <div className="space-y-5"><div><h2 className="text-2xl font-semibold">Billing & Payments</h2><p className="mt-1 text-sm text-white/40">Monitor reservation payment state and collect deposits through BizNest payments.</p></div><div className="grid gap-4 md:grid-cols-3"><Metric label="Unpaid stays" value={unpaid.length} icon={CreditCard} /><Metric label="Paid stays" value={paid.length} icon={CheckCircle2} /><Metric label="Payment coverage" value={`${reservations.length ? Math.round((paid.length / reservations.length) * 100) : 0}%`} icon={WalletCards} /></div><div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]"><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="border-b border-white/10 text-xs text-white/35"><tr><th className="px-5 py-4">Guest</th><th className="px-5 py-4">Reservation</th><th className="px-5 py-4">Payment</th><th className="px-5 py-4">Deposit</th><th className="px-5 py-4">Action</th></tr></thead><tbody>{reservations.map((r: any) => <tr key={r.id} className="border-b border-white/5 last:border-0"><td className="px-5 py-4 font-medium">{r.guest?.fullName}</td><td className="px-5 py-4 text-white/55">{r.room?.name} · {date(r.checkIn)}</td><td className="px-5 py-4"><span className={`rounded-full border px-2 py-1 text-[10px] ${statusClass(r.paymentStatus || "UNPAID")}`}>{statusLabel(r.paymentStatus || "UNPAID")}</span></td><td className="px-5 py-4 text-white/60">{r.depositAmount ? money(Number(r.depositAmount)) : "—"}</td><td className="px-5 py-4">{r.paymentStatus !== "PAID" && !["CANCELLED", "NO_SHOW", "CHECKED_OUT"].includes(r.status) ? <button onClick={() => { const amount = window.prompt("Deposit amount to request (NGN):", r.depositAmount ? String(Number(r.depositAmount)) : ""); if (!amount) return; const n = Number(amount); if (!Number.isFinite(n) || n <= 0) { toast.error("Enter a valid amount."); return; } chargeReservationDeposit(slug, r.id, n, r.guest?.email).then((result) => { if (!result.success) toast.error(result.error); else { navigator.clipboard?.writeText(result.data.authorizationUrl).catch(() => {}); window.open(result.data.authorizationUrl, "_blank"); toast.success("Payment link created"); } }); }} className="rounded-lg bg-emerald-400/10 px-2.5 py-1.5 text-[11px] text-emerald-300">Request payment</button> : <span className="text-xs text-white/30">No action</span>}</td></tr>)}</tbody></table></div></div></div>; }

function Toolbar({ title, subtitle, action, onAction, search, setSearch }: any) { return <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><h2 className="text-2xl font-semibold">{title}</h2><p className="mt-1 text-sm text-white/40">{subtitle}</p></div><div className="flex flex-col gap-2 sm:flex-row">{setSearch && <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"><Search className="h-4 w-4 text-white/35" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="w-full bg-transparent text-sm placeholder:text-white/30 focus:ring-0 sm:w-52" /></div>}{action && <button onClick={onAction} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-[#06110c]"><Plus className="h-4 w-4" />{action}</button>}</div></div>; }
function DeskList({ title, icon: Icon, items, action, onAction }: any) { return <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><div className="flex items-center gap-3"><span className="rounded-xl bg-emerald-400/10 p-2.5 text-emerald-300"><Icon className="h-5 w-5" /></span><div><h3 className="font-semibold">{title}</h3><p className="text-xs text-white/35">{items.length} guest{items.length === 1 ? "" : "s"}</p></div></div><div className="mt-4 space-y-2">{items.map((r: any) => <div key={r.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-black/10 p-3"><div><p className="text-sm font-medium">{r.guest?.fullName}</p><p className="mt-1 text-[11px] text-white/35">{r.room?.name} · {date(r.checkIn)} → {date(r.checkOut)}</p></div><button onClick={() => onAction(r)} className="rounded-lg bg-emerald-400 px-3 py-2 text-[11px] font-semibold text-[#06110c]">{action}</button></div>)}{items.length === 0 && <Empty text="Nothing here right now" />}</div></div>; }
function Quick({ label, text, icon: Icon, onClick }: any) { return <button onClick={onClick} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-left hover:bg-white/[0.045]"><span className="rounded-xl bg-emerald-400/10 p-3 text-emerald-300"><Icon className="h-5 w-5" /></span><span><p className="font-semibold">{label}</p><p className="mt-1 text-xs text-white/35">{text}</p></span></button>; }
function Metric({ label, value, icon: Icon }: any) { return <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><div className="flex items-center justify-between"><p className="text-sm text-white/45">{label}</p><Icon className="h-4 w-4 text-emerald-300" /></div><p className="mt-4 text-2xl font-semibold">{value}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="flex min-h-24 items-center justify-center text-sm text-white/30">{text}</div>; }
function Modal({ title, onClose, children }: any) { return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b1b14] p-5 shadow-2xl"><div className="mb-5 flex items-center justify-between"><h3 className="text-lg font-semibold">{title}</h3><button onClick={onClose} className="rounded-lg p-2 text-white/45 hover:bg-white/5 hover:text-white"><X className="h-4 w-4" /></button></div>{children}</div></div>; }
function Field({ label, value, onChange, placeholder, type = "text" }: any) { return <label className="block"><span className="mb-1.5 block text-xs text-white/50">{label}</span><input required={label !== "Email" && label !== "Phone"} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white placeholder:text-white/25" /></label>; }
function SelectField({ label, value, onChange, options }: any) { return <label className="block"><span className="mb-1.5 block text-xs text-white/50">{label}</span><select required value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white"><option value="" className="bg-[#0b1b14]">Select {label.toLowerCase()}</option>{options.map(([id, name]: any) => <option key={id} value={id} className="bg-[#0b1b14]">{name}</option>)}</select></label>; }
