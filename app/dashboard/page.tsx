import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { syncOrphanMetaApiAccount } from "@/lib/mt5-account-persist";
import DashboardPositionsSection from "@/components/DashboardPositionsSection";
import OpenPositionsStat from "@/components/OpenPositionsStat";

export default async function DashboardPage() {
  const supabase = createServerClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (profile?.is_admin) {
    redirect("/admin/dashboard");
  }

  let { data: mt5Accounts } = await supabase
    .from("mt5_accounts")
    .select(
      "id, account_number, broker_name, server_name, is_active, metaapi_account_id"
    )
    .eq("user_id", session.user.id)
    .eq("is_active", true);

  if (!mt5Accounts?.length && process.env.METAAPI_TOKEN) {
    await syncOrphanMetaApiAccount(
      supabase,
      session.user.id,
      process.env.METAAPI_TOKEN,
    );
    const refetch = await supabase
      .from("mt5_accounts")
      .select(
        "id, account_number, broker_name, server_name, is_active, metaapi_account_id"
      )
      .eq("user_id", session.user.id)
      .eq("is_active", true);
    mt5Accounts = refetch.data;
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", session.user.id)
    .single();

  const primaryMetaApiAccountId =
    mt5Accounts?.find((a) => a.metaapi_account_id)?.metaapi_account_id ?? null;

  return (
    <div className="min-h-screen pattern-bg">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-black text-white">
            Bienvenue, {profile?.full_name || "Trader"} 👋
          </h1>
          <p className="text-white text-opacity-90 mt-2 text-lg font-semibold">
            Gérez vos comptes MT5 et suivez vos trades
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="card-white">
            <h3
              className="text-sm font-bold uppercase tracking-wide"
              style={{ color: "#9b30a8" }}
            >
              Statut Abonnement
            </h3>
            <p className="text-3xl font-black mt-3">
              {subscription?.status === "active" ? (
                <span className="text-green-600">✓ Actif</span>
              ) : subscription?.status === "trialing" ? (
                <span className="text-blue-600">⏱ Essai</span>
              ) : (
                <span className="text-red-600">✗ Inactif</span>
              )}
            </p>
          </div>

          <div className="card-white">
            <h3
              className="text-sm font-bold uppercase tracking-wide"
              style={{ color: "#9b30a8" }}
            >
              Comptes MT5 Actifs
            </h3>
            <p
              className="text-3xl font-black mt-3"
              style={{ color: "#9b30a8" }}
            >
              {mt5Accounts?.length || 0}
            </p>
          </div>

          <div className="card-white">
            <h3
              className="text-sm font-bold uppercase tracking-wide"
              style={{ color: "#9b30a8" }}
            >
              Positions ouvertes
            </h3>
            <p
              className="text-3xl font-black mt-3"
              style={{ color: "#9b30a8" }}
            >
              <OpenPositionsStat metaapiAccountId={primaryMetaApiAccountId} />
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="card-white">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black" style={{ color: "#9b30a8" }}>
                Comptes MT5
              </h2>
              <Link href="/mt5-accounts" className="btn btn-primary text-sm">
                Gérer
              </Link>
            </div>

            {mt5Accounts && mt5Accounts.length > 0 ? (
              <div className="space-y-3">
                {mt5Accounts.map((account: any) => (
                  <div
                    key={account.id}
                    className="border-2 border-primary-200 rounded-2xl p-4 bg-gradient-to-r from-primary-50 to-white hover:shadow-lg transition-all"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <p className="font-bold" style={{ color: "#9b30a8" }}>
                          {account.broker_name || "N/A"}
                        </p>
                        <p
                          className="text-sm opacity-75"
                          style={{ color: "#9b30a8" }}
                        >
                          #{account.account_number}
                        </p>
                        {account.server_name && (
                          <p
                            className="text-xs opacity-60"
                            style={{ color: "#9b30a8" }}
                          >
                            {account.server_name}
                          </p>
                        )}
                      </div>
                      <span className="px-4 py-2 bg-green-500 text-white rounded-full text-sm font-bold shadow-lg">
                        ✓ Actif
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8" style={{ color: "#9b30a8" }}>
                <p className="font-semibold mb-3">Aucun compte MT5 connecté</p>
                <Link href="/mt5-accounts" className="btn btn-primary text-sm">
                  + Ajouter un compte
                </Link>
              </div>
            )}
          </div>

          <div className="card-white">
            <h2
              className="text-2xl font-black mb-6"
              style={{ color: "#9b30a8" }}
            >
              Positions ouvertes (compte MT4/MT5)
            </h2>
            <DashboardPositionsSection
              metaapiAccountId={primaryMetaApiAccountId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
