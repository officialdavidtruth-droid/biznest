// The root layout pins <body> to h-screen (store/admin shells depend on it).
// With overflow-x:hidden on body, that makes body its own 100vh scroll box,
// so tall onboarding pages get a nested scrollbar and a band of blank space
// under the content. Onboarding pages are plain document flow, so let the
// body grow to its content here only.
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`body{height:auto!important;min-height:100vh;overflow-y:visible!important}`}</style>
      {children}
    </>
  );
}
