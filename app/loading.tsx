import { LogoLoader } from "@/components/app/logo-loader";

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <LogoLoader />
    </div>
  );
}
