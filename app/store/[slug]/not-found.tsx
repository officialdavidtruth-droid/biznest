export default function StoreNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-4xl font-bold" style={{ color: "var(--bn-marigold)" }}>
        404
      </p>
      <h1 className="text-lg font-semibold" style={{ color: "var(--bn-ivory)" }}>
        Store not found
      </h1>
      <p className="max-w-sm text-sm" style={{ color: "var(--bn-mute)" }}>
        This store doesn't exist, or its link may have changed.
      </p>
      <a
        href="/"
        className="mt-2 rounded-md px-4 py-2 text-sm font-medium text-white"
        style={{ background: "var(--bn-marigold)" }}
      >
        Back to BizNest
      </a>
    </div>
  );
}
