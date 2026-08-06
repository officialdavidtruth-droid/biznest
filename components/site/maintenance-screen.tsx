export function MaintenanceScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="max-w-md">
        <p className="mb-3 text-4xl">🛠️</p>
        <h1 className="mb-2 text-xl font-semibold">We&apos;ll be right back</h1>
        <p className="text-sm text-muted-foreground">
          {message || "We're doing some scheduled maintenance and will be back shortly. Thanks for your patience."}
        </p>
      </div>
    </div>
  );
}
