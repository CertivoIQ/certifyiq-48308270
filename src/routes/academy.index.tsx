import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/academy/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "CertivoIQ" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: () => null,
});
