"use client";

export function AuthSubmitButton({
  children,
  disabled,
}: {
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full rounded-xl py-2.5 text-sm font-semibold text-[#05100a] shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:brightness-105 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
      style={{ background: "var(--bn-accent-gradient)" }}
    >
      {children}
    </button>
  );
}

export function GoogleButton({ onClick, label = "Continue with Google" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-white py-2.5 text-sm font-medium text-[var(--bn-ink)] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-muted/40 hover:shadow-md active:translate-y-0"
    >
      <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
        <path
          fill="#FFC107"
          d="M43.6 20.5H42V20.4H24v7.2h11.3c-1.6 4.6-6 7.9-11.3 7.9-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.1-5.1C33.9 6.1 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
        />
        <path
          fill="#FF3D00"
          d="m6.3 14.7 5.9 4.3C13.8 15.6 18.5 12.4 24 12.4c3.1 0 5.8 1.1 8 3l5.1-5.1C33.9 6.1 29.2 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.1 0 9.7-2 13.1-5.1l-6-5.1c-2 1.5-4.6 2.4-7.1 2.4-5.2 0-9.7-3.3-11.3-7.9l-6 4.6C9.5 39.6 16.2 44 24 44z"
        />
        <path
          fill="#1976D2"
          d="M43.6 20.5H42V20.4H24v7.2h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6 5.1C40.9 35.7 44 30.4 44 24c0-1.3-.1-2.7-.4-3.5z"
        />
      </svg>
      {label}
    </button>
  );
}

export function AuthDivider() {
  return (
    <div className="relative py-1 text-center text-xs">
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
      <span className="relative bg-white px-3 text-muted-foreground">or</span>
    </div>
  );
}
