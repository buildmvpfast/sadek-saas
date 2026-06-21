"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type CloseAllTradesButtonProps = {
  disabled?: boolean;
};

export default function CloseAllTradesButton({
  disabled = false,
}: CloseAllTradesButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  async function handleCloseAll() {
    const ok = window.confirm(
      "Fermer TOUTES les positions ouvertes sur tous vos comptes MT4/MT5 ?\n\nCette action est immédiate et irréversible.",
    );
    if (!ok) return;

    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/user/close-all-positions", {
        method: "POST",
      });
      const data = (await res.json()) as {
        error?: string;
        closed?: number;
        total?: number;
        accounts?: number;
        message?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || "Échec de la fermeture");
      }

      const closed = data.closed ?? 0;
      const total = data.total ?? 0;

      if (total === 0) {
        setFeedback({
          type: "ok",
          text: data.message || "Aucune position ouverte à fermer.",
        });
      } else {
        setFeedback({
          type: "ok",
          text: `${closed}/${total} position(s) fermée(s) sur ${data.accounts ?? 0} compte(s).`,
        });
      }

      router.refresh();
    } catch (e) {
      setFeedback({
        type: "err",
        text: e instanceof Error ? e.message : "Erreur inconnue",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-8">
      <button
        type="button"
        onClick={handleCloseAll}
        disabled={disabled || loading}
        className="w-full sm:w-auto px-6 py-3.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black text-sm sm:text-base rounded-2xl shadow-lg shadow-red-900/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
      >
        {loading
          ? "Fermeture en cours…"
          : "🔴 Couper tous les trades en cours"}
      </button>
      {feedback && (
        <p
          className={`mt-3 text-sm font-bold ${
            feedback.type === "ok" ? "text-green-200" : "text-red-200"
          }`}
        >
          {feedback.text}
        </p>
      )}
    </div>
  );
}
