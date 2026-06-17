"use client";

import { useCallback, useEffect, useState } from "react";
import type { NormalizedPosition } from "@/lib/metaapi-positions";

type OpenPositionsTableProps = {
  metaapiAccountId?: string | null;
  pollMs?: number;
  compact?: boolean;
  onCountChange?: (count: number) => void;
};

export default function OpenPositionsTable({
  metaapiAccountId,
  pollMs = 8000,
  compact = false,
  onCountChange,
}: OpenPositionsTableProps) {
  const [positions, setPositions] = useState<NormalizedPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const fetchPositions = useCallback(
    async (isManual = false) => {
      if (!metaapiAccountId) {
        setPositions([]);
        setLoading(false);
        onCountChange?.(0);
        return;
      }
      if (isManual) setRefreshing(true);
      try {
        const res = await fetch(
          `/api/metaapi/positions?accountId=${encodeURIComponent(metaapiAccountId)}`,
        );
        const data = await res.json();
        if (data.success && Array.isArray(data.positions)) {
          setPositions(data.positions);
          setError("");
          onCountChange?.(data.positions.length);
        } else {
          setPositions([]);
          setError(data.error || "Impossible de charger les positions");
          onCountChange?.(0);
        }
      } catch {
        setError("Erreur réseau");
        onCountChange?.(0);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [metaapiAccountId, onCountChange],
  );

  useEffect(() => {
    setLoading(true);
    fetchPositions();
    const timer = setInterval(() => fetchPositions(), pollMs);
    return () => clearInterval(timer);
  }, [fetchPositions, pollMs]);

  if (!metaapiAccountId) {
    return (
      <p className="text-sm font-semibold opacity-75" style={{ color: "#9b30a8" }}>
        Connectez un compte MT4/MT5 pour voir vos positions réelles.
      </p>
    );
  }

  if (loading) {
    return (
      <p className="text-sm font-semibold" style={{ color: "#9b30a8" }}>
        Chargement des positions du compte…
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs opacity-70" style={{ color: "#9b30a8" }}>
          Compte broker en direct (MetaAPI) — pas les signaux Telegram
        </p>
        <button
          type="button"
          onClick={() => fetchPositions(true)}
          disabled={refreshing}
          className="text-xs font-bold px-3 py-1 rounded-full border-2 border-primary-300 hover:bg-primary-50"
          style={{ color: "#9b30a8" }}
        >
          {refreshing ? "…" : "Actualiser"}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-3">{error}</p>
      )}

      {positions.length === 0 ? (
        <p className="text-sm font-semibold opacity-75" style={{ color: "#9b30a8" }}>
          Aucune position ouverte sur le compte.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left">Symbole</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-right">Vol.</th>
                {!compact && (
                  <>
                    <th className="px-3 py-2 text-right">Entrée</th>
                    <th className="px-3 py-2 text-right">Actuel</th>
                  </>
                )}
                <th className="px-3 py-2 text-right">SL</th>
                <th className="px-3 py-2 text-right">TP</th>
                <th className="px-3 py-2 text-right">P&L</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => (
                <tr key={pos.id} className="border-b border-primary-100">
                  <td className="px-3 py-2 font-bold">{pos.symbol}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded text-white text-xs font-bold ${
                        pos.type === "BUY" ? "bg-green-500" : "bg-red-500"
                      }`}
                    >
                      {pos.type}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">{pos.volume}</td>
                  {!compact && (
                    <>
                      <td className="px-3 py-2 text-right">
                        {pos.openPrice.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {pos.currentPrice.toFixed(2)}
                      </td>
                    </>
                  )}
                  <td className="px-3 py-2 text-right">
                    {pos.stopLoss != null ? pos.stopLoss.toFixed(2) : "-"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {pos.takeProfit != null ? pos.takeProfit.toFixed(2) : "-"}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-bold ${
                      pos.profit >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {pos.profit >= 0 ? "+" : ""}
                    {pos.profit.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
