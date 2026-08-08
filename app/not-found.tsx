export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-5xl font-bold" style={{ color: "var(--bn-marigold)" }}>
        404
      </p>
      <h1 className="text-xl font-semibold" style={{ color: "var(--bn-ivory)" }}>
        Page not found
      </h1>
      <p className="max-w-sm text-sm" style={{ color: "var(--bn-mute)" }}>
        The page you're looking for doesn't exist or may have moved.
      </p>
      <a
        href="/"
        className="mt-2 rounded-md px-4 py-2 text-sm font-medium text-white"
        style={{ background: "var(--bn-marigold)" }}
      >
        Back to home
      </a>
    </div>
  );
}
