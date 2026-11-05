// Route: /store/[slug]/travel/p/[token]
// The client's own page for a trip: proposal to read and accept, then "My trip" with itinerary, payments and a pay button.
// Reachable only with the unguessable token (same model as the booking-status page). It never shows costs, margins,
// supplier names, passport numbers or internal notes. Built mobile-first because clients open it from WhatsApp.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadProposal } from "@/lib/travel-proposal";
import { ProposalClient } from "./proposal-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your trip", robots: { index: false, follow: false } };

export default async function TravelProposalPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  const view = await loadProposal(slug, token);
  if (!view) notFound();
  return <ProposalClient view={view} />;
}
