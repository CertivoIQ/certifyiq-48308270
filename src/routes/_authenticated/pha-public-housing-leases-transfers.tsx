import { createFileRoute } from "@tanstack/react-router";
import { PhaPublicHousingLeaseTransferWorkspace } from "@/components/pha-public-housing-lease-transfer-workspace";

export const Route=createFileRoute("/_authenticated/pha-public-housing-leases-transfers")({component:PhaPublicHousingLeaseTransferWorkspace});
