import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/observability/sentry-options";

// Browser-side error tracking. No-op unless NEXT_PUBLIC_SENTRY_DSN is set.
Sentry.init(sentryOptions(0.02));

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
