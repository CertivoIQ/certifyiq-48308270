import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Root path always sends visitors, trial users and subscribers to the public
 * landing page. The authenticated dashboard lives at /dashboard and the
 * visitor demo at /demo-dashboard.
 */
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/welcome", replace: true });
  },
});
