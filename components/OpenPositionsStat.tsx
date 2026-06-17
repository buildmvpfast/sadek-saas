"use client";

import { useCallback, useEffect, useState } from "react";

export default function OpenPositionsStat({
  metaapiAccountId,
}: {
  metaapiAccountId?: string | null;
}) {
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!metaapiAccountId) {
      setCount(0);
      return;
    }
    try {
      const res = await fetch(
        `/api/metaapi/positions?accountId=${encodeURIComponent(metaapiAccountId)}`,
      );
      const data = await res.json();
      setCount(
        data.success && Array.isArray(data.positions)
          ? data.positions.length
          : 0,
      );
    } catch {
      setCount(0);
    }
  }, [metaapiAccountId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  return <>{count}</>;
}
