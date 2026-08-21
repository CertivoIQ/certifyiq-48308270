import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/academy/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Training unavailable — CertivoIQ" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: () => null,
});
