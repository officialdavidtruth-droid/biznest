/** Second-level suffixes where the "root" domain has three labels (e.g. mystore.com.ng). */
const TWO_PART_SUFFIXES = new Set([
  "com.ng", "org.ng", "net.ng", "edu.ng", "gov.ng", "co.uk", "org.uk", "co.za", "com.gh", "co.ke", "com.au", "co.in",
]);

export type DnsInstruction = {
  isRoot: boolean;
  recordType: "A" | "CNAME";
  /** What to type in the "Name"/"Host" box at the DNS provider. */
  host: string;
  value: string;
};

/** Tells a vendor exactly which DNS record to create for their domain. */
export function dnsInstructionFor(domain: string): DnsInstruction {
  const labels = domain.toLowerCase().split(".");
  const suffixLen = TWO_PART_SUFFIXES.has(labels.slice(-2).join(".")) ? 2 : 1;
  const isRoot = labels.length <= suffixLen + 1;
  return isRoot
    ? { isRoot, recordType: "A", host: "@", value: "76.76.21.21" }
    : { isRoot, recordType: "CNAME", host: labels.slice(0, labels.length - suffixLen - 1).join("."), value: "cname.vercel-dns.com" };
}
