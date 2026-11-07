/** Small credit shown on a storefront while its owner is still on a free trial. It disappears once they subscribe. */
export function PoweredByBizNest() {
  return (
    <a
      href="https://biznest.space"
      target="_blank"
      rel="noopener"
      style={{ position: "fixed", left: 12, bottom: 12, zIndex: 40, padding: "6px 10px", borderRadius: 999, background: "rgba(17,17,17,0.82)", color: "#fff", fontSize: 11, fontFamily: "system-ui, sans-serif", textDecoration: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.2)" }}
    >
      Powered by BizNest
    </a>
  );
}
