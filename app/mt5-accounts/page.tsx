"use client";

import { useEffect, useState, lazy, Suspense, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import { clientCache } from "@/lib/cache";

// Lazy load des composants lourds
const LoadingSpinner = lazy(() => import("@/components/LoadingSpinner"));

type Broker = {
  id: string;
  name: string;
  servers?: string[];
};

type MT5Account = {
  id: string;
  account_number: number;
  is_active: boolean;
  broker_name: string;
  server_name: string;
  metaapi_account_id?: string;
};

type Position = {
  id: string;
  symbol: string;
  type: string;
  volume: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  stopLoss?: number;
  takeProfit?: number;
};

type AccountInfo = {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  currency: string;
  profit: number;
  server: string;
  leverage: number;
};

export default function MT5AccountsPage() {
  const [mt5Accounts, setMt5Accounts] = useState<MT5Account[]>([]);
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [servers, setServers] = useState<string[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingServers, setLoadingServers] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [manualServerInput, setManualServerInput] = useState(false);

  const [formData, setFormData] = useState({
    broker_name: "",
    server_name: "",
    account_number: "",
    password: "",
    is_investor: false,
  });

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    fetchData();
    fetchBrokers();
  }, []);

  const fetchPositions = async (metaapiAccountId: string) => {
    setLoadingPositions(true);
    try {
      const response = await fetch(
        `/api/metaapi/positions?accountId=${metaapiAccountId}`
      );
      const data = await response.json();

      if (data.success && data.positions) {
        setPositions(data.positions);
      }
    } catch (err) {
      console.error("Error fetching positions:", err);
    } finally {
      setLoadingPositions(false);
    }
  };

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/auth/login");
        return;
      }

      const { data: accountsData } = await supabase
        .from("mt5_accounts")
        .select(
          "id, account_number, is_active, broker_name, server_name, metaapi_account_id"
        )
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (accountsData) {
        const formattedAccounts = accountsData.map((acc: any) => ({
          id: acc.id,
          account_number: acc.account_number,
          is_active: acc.is_active,
          broker_name: acc.broker_name || "N/A",
          server_name: acc.server_name || "N/A",
          metaapi_account_id: acc.metaapi_account_id,
        }));
        setMt5Accounts(formattedAccounts);

        // Charger les positions du premier compte actif
        const activeAccount = formattedAccounts.find(
          (acc: any) => acc.is_active && acc.metaapi_account_id
        );
        if (activeAccount?.metaapi_account_id) {
          fetchPositions(activeAccount.metaapi_account_id);
        }
      }
    } finally {
      if (isRefresh) {
        setIsRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const fetchBrokers = async () => {
    try {
      const response = await fetch("/api/metaapi/brokers");
      const data = await response.json();

      if (data.success && data.brokers) {
        setBrokers(data.brokers);
      } else {
        // Fallback si l'API ne marche pas
        setBrokers(data.brokers || []);
      }
    } catch (err) {
      console.error("Error fetching brokers:", err);
      setError("Impossible de charger les brokers");
    }
  };

  const fetchServers = async (brokerName: string) => {
    setLoadingServers(true);
    try {
      const response = await fetch(
        `/api/metaapi/servers?broker=${encodeURIComponent(brokerName)}`
      );
      const data = await response.json();

      if (data.success && data.servers) {
        setServers(data.servers.map((s: any) => s.name));
      } else {
        // Fallback: utiliser les serveurs du broker sélectionné
        const broker = brokers.find((b) => b.name === brokerName);
        setServers(broker?.servers || []);
      }
    } catch (err) {
      console.error("Error fetching servers:", err);
      const broker = brokers.find((b) => b.name === brokerName);
      setServers(broker?.servers || []);
    } finally {
      setLoadingServers(false);
    }
  };

  const handleBrokerChange = (brokerName: string) => {
    setFormData({
      ...formData,
      broker_name: brokerName,
      server_name: "",
    });
    setManualServerInput(false);
    if (brokerName) {
      fetchServers(brokerName);
    } else {
      setServers([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoadingSubmit(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) throw new Error("Non authentifié");

      // Vérifier que l'utilisateur n'a pas déjà un compte
      if (mt5Accounts.length > 0) {
        throw new Error(
          "Vous ne pouvez connecter qu'un seul compte MT5. Supprimez votre compte actuel pour en ajouter un nouveau."
        );
      }

      // 1. Connecter le compte à MetaApi
      const metaApiResponse = await fetch("/api/metaapi/connect-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `User - ${formData.broker_name} - ${formData.account_number}`,
          login: formData.account_number,
          password: formData.password,
          server: formData.server_name,
          platform: "mt5",
          magic: 0,
        }),
      });

      const metaApiData = await metaApiResponse.json();

      if (!metaApiData.success) {
        throw new Error(
          metaApiData.error || "Erreur lors de la connexion MetaApi"
        );
      }

      // 2. Enregistrer dans Supabase avec le metaapi_account_id
      const passwordEncrypted = Buffer.from(formData.password).toString(
        "base64"
      );

      const { error } = await supabase.from("mt5_accounts").insert({
        user_id: session.user.id,
        broker_name: formData.broker_name,
        server_name: formData.server_name,
        account_number: parseInt(formData.account_number),
        password_encrypted: passwordEncrypted,
        is_investor: formData.is_investor,
        is_admin_account: false, // Compte user, pas admin
        metaapi_account_id: metaApiData.accountId,
        is_active: true,
      });

      if (error) throw error;

      setShowAddForm(false);
      setFormData({
        broker_name: "",
        server_name: "",
        account_number: "",
        password: "",
        is_investor: false,
      });
      setServers([]);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue");
    } finally {
      setLoadingSubmit(false);
    }
  };

  const toggleAccountStatus = async (
    accountId: string,
    currentStatus: boolean
  ) => {
    const { error } = await supabase
      .from("mt5_accounts")
      .update({ is_active: !currentStatus })
      .eq("id", accountId);

    if (!error) fetchData();
  };

  const deleteAccount = async (accountId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce compte?")) return;

    const { error } = await supabase
      .from("mt5_accounts")
      .delete()
      .eq("id", accountId);

    if (!error) fetchData();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Mon Compte MT5</h1>
          <div className="flex gap-2">
            <button
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              className="btn btn-secondary"
            >
              {isRefreshing ? "🔄" : "↻"} Actualiser
            </button>
            {mt5Accounts.length === 0 && (
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="btn btn-primary"
              >
                {showAddForm ? "Annuler" : "+ Connecter mon compte"}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {showAddForm && (
          <div className="card mb-8">
            <h2 className="text-xl font-bold mb-4">Nouveau Compte MT5</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Broker *
                </label>
                <select
                  value={formData.broker_name}
                  onChange={(e) => handleBrokerChange(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Sélectionner un broker</option>
                  {brokers.map((broker) => (
                    <option key={broker.id} value={broker.name}>
                      {broker.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {brokers.length > 0
                    ? `${brokers.length} brokers disponibles`
                    : "Chargement des brokers..."}
                </p>
              </div>

              {formData.broker_name && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium">
                      Serveur MT5 *
                    </label>
                    {!loadingServers && servers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setManualServerInput(!manualServerInput)}
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        {manualServerInput
                          ? "Utiliser la liste"
                          : "Saisir manuellement"}
                      </button>
                    )}
                  </div>
                  {loadingServers ? (
                    <div className="input bg-gray-50">
                      Chargement des serveurs...
                    </div>
                  ) : manualServerInput || servers.length === 0 ? (
                    <>
                      <input
                        type="text"
                        value={formData.server_name}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            server_name: e.target.value,
                          })
                        }
                        className="input"
                        placeholder="Ex: RaiseGlobal-Live"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Entrez le nom exact du serveur (visible dans MT5)
                      </p>
                    </>
                  ) : (
                    <>
                      <select
                        value={formData.server_name}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            server_name: e.target.value,
                          })
                        }
                        className="input"
                        required
                      >
                        <option value="">Sélectionner un serveur</option>
                        {servers.map((server) => (
                          <option key={server} value={server}>
                            {server}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        {servers.length} serveurs disponibles
                      </p>
                    </>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">
                  Numéro de compte MT5 *
                </label>
                <input
                  type="number"
                  value={formData.account_number}
                  onChange={(e) =>
                    setFormData({ ...formData, account_number: e.target.value })
                  }
                  className="input"
                  placeholder="12345678"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Mot de passe MT5 *
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="input"
                  placeholder="Votre mot de passe MT5"
                  required
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_investor}
                  onChange={(e) =>
                    setFormData({ ...formData, is_investor: e.target.checked })
                  }
                  className="mr-2"
                />
                <label className="text-sm">
                  Mot de passe investisseur (lecture seule)
                </label>
              </div>

              <button
                type="submit"
                disabled={loadingSubmit || !formData.server_name}
                className="btn btn-primary w-full"
              >
                {loadingSubmit ? "Ajout en cours..." : "Ajouter le compte"}
              </button>
            </form>
          </div>
        )}

        {mt5Accounts.length > 0 ? (
          <div className="space-y-6">
            {mt5Accounts.map((account) => {
              return (
                <div key={account.id} className="card">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-1">
                        {account.broker_name}
                      </h3>
                      <p className="text-gray-600 font-semibold">
                        Serveur: {account.server_name}
                      </p>
                      <p className="text-gray-600 font-semibold">
                        Compte: #{account.account_number}
                      </p>
                    </div>
                    <span
                      className={`px-4 py-2 rounded-full text-sm font-bold ${
                        account.is_active
                          ? "bg-green-500 text-white"
                          : "bg-gray-400 text-white"
                      }`}
                    >
                      {account.is_active ? "✓ Actif" : "✗ Inactif"}
                    </span>
                  </div>

                  <div className="flex gap-2 pt-4 border-t">
                    <button
                      onClick={() =>
                        toggleAccountStatus(account.id, account.is_active)
                      }
                      className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-all"
                    >
                      {account.is_active ? "Désactiver" : "Activer"}
                    </button>

                    <button
                      onClick={() => deleteAccount(account.id)}
                      className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition-all"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              );
            })}

            <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-4">
              <p className="text-sm font-bold text-blue-800">
                ℹ️ <strong>Limite:</strong> Vous ne pouvez connecter qu'un seul
                compte MT5. Pour en changer, supprimez d'abord votre compte
                actuel.
              </p>
            </div>

            {/* Positions ouvertes */}
            <div className="card mt-6">
              <h2 className="text-2xl font-bold mb-4">Positions ouvertes</h2>
              {loadingPositions ? (
                <p className="text-gray-600">Chargement des positions...</p>
              ) : positions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left">Symbole</th>
                        <th className="px-4 py-2 text-left">Type</th>
                        <th className="px-4 py-2 text-right">Volume</th>
                        <th className="px-4 py-2 text-right">Entrée</th>
                        <th className="px-4 py-2 text-right">Prix actuel</th>
                        <th className="px-4 py-2 text-right">SL</th>
                        <th className="px-4 py-2 text-right">TP</th>
                        <th className="px-4 py-2 text-right">P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((pos) => (
                        <tr key={pos.id} className="border-b">
                          <td className="px-4 py-3 font-bold">{pos.symbol}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 rounded text-white text-xs ${
                                pos.type === "ORDER_TYPE_BUY"
                                  ? "bg-green-500"
                                  : "bg-red-500"
                              }`}
                            >
                              {pos.type === "ORDER_TYPE_BUY" ? "BUY" : "SELL"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">{pos.volume}</td>
                          <td className="px-4 py-3 text-right">
                            {pos.openPrice?.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {pos.currentPrice?.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {pos.stopLoss?.toFixed(2) || "-"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {pos.takeProfit?.toFixed(2) || "-"}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-bold ${
                              pos.profit >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            ${pos.profit?.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-600">Aucune position ouverte</p>
              )}
            </div>
          </div>
        ) : (
          <div className="card text-center py-12">
            <p className="text-xl font-bold text-gray-900 mb-2">
              Aucun compte MT5 connecté
            </p>
            <p className="text-gray-600 mb-4">
              Connectez votre compte MT5 pour recevoir automatiquement les
              signaux de trading
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
