import Link from "next/link";
import { Headphones, Mail, MessageCircle, Phone, FileText, Plus, ChevronRight, ShieldCheck, Clock3, Ticket, ExternalLink } from "lucide-react";
import { DISPUTE_STATUS_CONFIG } from "@/lib/constants/dispute";

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

type SupportProps = {
  slug: string;
  store: any;
  user: any;
  heroImage: string | null;
  conversation: any;
  disputes: any[];
  faqBody: string | null;
};

function faqItems(body: string | null) {
  if (!body) return [];
  return body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.endsWith("?") && line.length > 10)
    .slice(0, 8);
}

export function VelouraSupportPage({ slug, store, user, heroImage, conversation, disputes, faqBody }: SupportProps) {
  const faqs = faqItems(faqBody);
  const email = store.contactEmail || null;
  const phone = store.contactPhone || null;
  const location = [store.city, store.state, store.country].filter(Boolean).join(", ");
  const name = user?.name || user?.email || "Guest";
  const openTickets = disputes.filter((d) => d.status === "OPEN" || d.status === "UNDER_REVIEW").length;
  const helpHref = faqBody ? `/store/${slug}/faq` : `/store/${slug}/contact`;

  return (
    <div className="veloura-support-page">
      <section className="veloura-support-hero" style={heroImage ? { backgroundImage: `linear-gradient(90deg, rgba(21,13,8,.88), rgba(21,13,8,.28)), url(${heroImage})` } : undefined}>
        <div>
          <h1>Support</h1>
          <p>We&apos;re here to help. Get the support you need for a seamless and memorable stay.</p>
        </div>
        <span>Luxury<br />Redefined.<br /><em>Moments That Matter.</em></span>
      </section>

      <div className="veloura-support-contact-grid">
        <article className="veloura-support-contact-card">
          <div className="veloura-support-icon"><MessageCircle /></div>
          <h2>Live Chat</h2>
          <p>Chat with {store.name} support in real-time.</p>
          <strong className="veloura-online"><i /> {conversation ? "Conversation available" : "Start a conversation"}</strong>
          <Link href={`/store/${slug}/account/messages`} className="veloura-support-primary">Start Chat</Link>
        </article>
        <article className="veloura-support-contact-card">
          <div className="veloura-support-icon"><Phone /></div>
          <h2>Call Us</h2>
          <p>Speak directly with the support team.</p>
          <strong>{phone || "Contact number not provided"}</strong>
          {phone ? <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="veloura-support-secondary">Call Now</a> : <span className="veloura-support-disabled">Call Now</span>}
        </article>
        <article className="veloura-support-contact-card">
          <div className="veloura-support-icon"><Mail /></div>
          <h2>Email Us</h2>
          <p>Send an email and the team will get back to you.</p>
          <strong>{email || "Email address not provided"}</strong>
          {email ? <a href={`mailto:${email}`} className="veloura-support-secondary">Send Email</a> : <span className="veloura-support-disabled">Send Email</span>}
        </article>
        <article className="veloura-support-contact-card">
          <div className="veloura-support-icon"><FileText /></div>
          <h2>Help Center</h2>
          <p>Browse the store&apos;s published guides and FAQs.</p>
          <Link href={helpHref} className="veloura-support-secondary">View Help Center</Link>
        </article>
      </div>

      <div className="veloura-support-main-grid">
        <section className="veloura-support-card">
          <div className="veloura-support-card-head">
            <div><h2>Your Support Tickets</h2><p>Track the status of your inquiries and support requests.</p></div>
            <Link href={`/store/${slug}/account/messages`} className="veloura-support-primary small"><Plus /> New Support Ticket</Link>
          </div>
          <div className="veloura-support-table">
            <div className="veloura-support-table-row head"><span>#</span><span>Subject</span><span>Category</span><span>Status</span><span>Date</span><span>Action</span></div>
            {disputes.length ? disputes.map((d) => {
              const cfg = DISPUTE_STATUS_CONFIG[d.status as keyof typeof DISPUTE_STATUS_CONFIG];
              return <Link key={d.id} href={`/disputes/${d.order.id}`} className="veloura-support-table-row">
                <span>#{d.id.slice(-4).toUpperCase()}</span>
                <span><b>{d.reason || "Support request"}</b></span>
                <span>Booking / Order</span>
                <span><em className={`${cfg.bg} ${cfg.text}`}>{cfg.label}</em></span>
                <span>{formatDate(d.createdAt)}</span>
                <span><button type="button">View</button></span>
              </Link>;
            }) : <div className="veloura-support-empty">No support tickets yet. Start a conversation with the hotel team when you need assistance.</div>}
          </div>
          {openTickets > 0 && <div className="veloura-support-ticket-summary"><Ticket /> {openTickets} active support {openTickets === 1 ? "ticket" : "tickets"}</div>}
        </section>

        <aside className="veloura-support-card veloura-faq-card">
          <div className="veloura-support-card-head"><div><h2>Frequently Asked Questions</h2></div><Link href={helpHref}>View All</Link></div>
          <div className="veloura-faq-list">
            {faqs.length ? faqs.map((faq) => <Link key={faq} href={helpHref}><span>{faq}</span><ChevronRight /></Link>) : <div className="veloura-support-empty">No published FAQ questions are available yet.</div>}
          </div>
        </aside>
      </div>

      <section className="veloura-support-help-banner">
        <div><Headphones /><div><h2>Still Need Help?</h2><p>{store.name} support is available through the contact options above.</p></div></div>
        <Link href={`/store/${slug}/account/messages`}>Contact Support <ChevronRight /></Link>
      </section>

      <div className="veloura-support-security"><ShieldCheck /><div><b>Your privacy matters</b><span>Your account and support conversations remain scoped to {store.name}.</span></div><Link href={`/store/${slug}/policies`}>View Privacy Policy <ExternalLink /></Link></div>
      <div className="veloura-support-context"><Clock3 /> {location || "Store location not provided"}</div>
    </div>
  );
}
