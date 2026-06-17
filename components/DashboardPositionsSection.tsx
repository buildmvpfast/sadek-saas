"use client";

import { useState } from "react";
import OpenPositionsTable from "@/components/OpenPositionsTable";

type DashboardPositionsSectionProps = {
  metaapiAccountId?: string | null;
};

export default function DashboardPositionsSection({
  metaapiAccountId,
}: DashboardPositionsSectionProps) {
  const [openCount, setOpenCount] = useState<number | null>(null);

  return (
    <>
      {openCount != null && (
        <p className="text-xs font-bold opacity-60 mb-4" style={{ color: "#9b30a8" }}>
          {openCount} position{openCount !== 1 ? "s" : ""} ouverte
          {openCount !== 1 ? "s" : ""} sur le compte broker
        </p>
      )}
      <OpenPositionsTable
        metaapiAccountId={metaapiAccountId}
        onCountChange={setOpenCount}
      />
    </>
  );
}
