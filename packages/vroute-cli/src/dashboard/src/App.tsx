import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { io } from 'socket.io-client';
import { Activity, Globe, Server, Link as LinkIcon, ExternalLink, Trash2, Plus, Hash, Radio, Shield, Zap } from 'lucide-react';

import toast, { Toaster } from 'react-hot-toast';
import { cn } from './lib/utils';
import { ShieldModal } from './components/ShieldModal';
import { ChaosModal, type ChaosRule } from './components/ChaosModal';
import './index.css';

interface PortInfo {
  port: number;
  process: string;
  pid: number;
  address: string;
}

interface RouteConfig {
  port: number;
  ssl: boolean;
  cors: boolean;
  wildcard?: boolean;
  tenantHeader?: string;
  chaosEnabled?: boolean;
  chaosRules?: ChaosRule[];
}

interface Config {
  routes: Record<string, RouteConfig>;
  daemonPid?: number;
  shieldEnabled?: boolean;
  shieldRules?: string[];
}

interface RequestLog {
  method: string;
  url: string;
  host: string;
  status: number;
  duration: number;
  timestamp: string;
  error?: string;
  shielded?: boolean;
  chaosTriggered?: boolean;
}

function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [ports, setPorts] = useState<PortInfo[]>([]);
  const [connected, setConnected] = useState(false);

  const [newDomain, setNewDomain] = useState('');
  const [newPort, setNewPort] = useState('');
  const [newSsl, setNewSsl] = useState(true);
  const [newCors, setNewCors] = useState(true);
  const [newWildcard, setNewWildcard] = useState(false);
  const [newTenantHeader, setNewTenantHeader] = useState('X-Vroute-Tenant');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isShieldModalOpen, setIsShieldModalOpen] = useState(false);
  const [isChaosModalOpen, setIsChaosModalOpen] = useState(false);
  const [selectedChaosDomain, setSelectedChaosDomain] = useState<string | null>(null);

  useEffect(() => {
    const socketUrl = import.meta.env.DEV ? 'http://localhost:9999' : window.location.origin;
    const socket = io(socketUrl);

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('config', (newConfig: Config) => setConfig(newConfig));
    socket.on('request-log', (log: RequestLog) => {
      setLogs((prev) => [log, ...prev].slice(0, 100));
    });

    const fetchPorts = async () => {
      try {
        const res = await fetch('/api/ports');
        const data = await res.json();
        setPorts(data.ports || []);
      } catch { /* ignore */ }
    };
    fetchPorts();
    const portInterval = setInterval(fetchPorts, 5000);

    return () => {
      socket.disconnect();
      clearInterval(portInterval);
    };
  }, []);

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-600';
    if (status >= 300 && status < 400) return 'text-amber-600';
    return 'text-red-500';
  };

  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      GET: 'bg-blue-50 text-blue-700',
      POST: 'bg-green-50 text-green-700',
      PUT: 'bg-amber-50 text-amber-700',
      DELETE: 'bg-red-50 text-red-600',
      PATCH: 'bg-purple-50 text-purple-700',
      OPTIONS: 'bg-gray-100 text-gray-600',
    };
    return colors[method] || 'bg-gray-100 text-gray-600';
  };

  const handleAddRoute = async (e: FormEvent) => {
    e.preventDefault();
    if (!newDomain || !newPort) return;

    const isWildcard = newWildcard || newDomain.startsWith('*.');

    setIsSubmitting(true);
    const toastId = toast.loading('Adding route...');
    try {
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: newDomain,
          port: parseInt(newPort, 10),
          ssl: newSsl,
          cors: newCors,
          wildcard: isWildcard,
          tenantHeader: isWildcard ? newTenantHeader : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to add route', { id: toastId });
      } else {
        toast.success(`Route added: ${newDomain}`, { id: toastId });
        setNewDomain('');
        setNewPort('');
        setNewWildcard(false);
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRoute = async (domain: string) => {
    const toastId = toast.loading(`Removing ${domain}...`);
    try {
      const res = await fetch(`/api/routes/${encodeURIComponent(domain)}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to remove', { id: toastId });
      } else {
        toast.success(`Removed ${domain}`, { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    }
  };

  const handleSaveShield = async (enabled: boolean, rules: string[]) => {
    const res = await fetch('/api/shield', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, rules }),
    });
    if (!res.ok) throw new Error('Failed to update Shield settings');
  };

  const handleSaveChaos = async (domain: string, enabled: boolean, rules: ChaosRule[]) => {
    const res = await fetch(`/api/routes/${encodeURIComponent(domain)}/chaos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, rules }),
    });
    if (!res.ok) throw new Error('Failed to update Chaos settings');
  };

  const routes = config?.routes ? Object.entries(config.routes) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="bottom-right" toastOptions={{ className: 'text-sm' }} />

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
              <Globe className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 leading-tight">vroute</h1>
              <p className="text-[11px] text-gray-400">Local DNS & SSL Router</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs text-gray-400">
              {routes.length} route{routes.length !== 1 ? 's' : ''} &middot; {ports.length} port{ports.length !== 1 ? 's' : ''}
            </div>
            <button
              onClick={() => setIsShieldModalOpen(true)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                config?.shieldEnabled ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100"
              )}
            >
              <Shield className="w-3 h-3" />
              Shield
            </button>
            <span className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
              connected ? "bg-green-50 text-green-700 border border-green-200" : "bg-gray-100 text-gray-500 border border-gray-200"
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full", connected ? "bg-green-500" : "bg-gray-400")} />
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 py-5 space-y-5">

        {/* Active Ports — compact full-width strip */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5" />
              Active Ports
            </h2>
            <span className="text-[10px] text-gray-400">{ports.length} listening</span>
          </div>
          <div className="px-4 py-3">
            {ports.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {ports.map((p) => (
                  <div key={p.port} className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-md border border-gray-100 text-sm">
                    <span className="font-mono font-semibold text-gray-900">{p.port}</span>
                    <span className="text-gray-300">|</span>
                    <span className="text-xs text-gray-500 truncate max-w-[120px]" title={p.process}>{p.process || 'unknown'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-2">No active ports</p>
            )}
          </div>
        </div>

        {/* Two columns: Routes + Traffic */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* Left Sidebar — Routes */}
          <div className="lg:col-span-4 space-y-4">

            {/* Add Route Form */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-4 py-2.5 border-b border-gray-100">
                <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Add Route
                </h2>
              </div>
              <form onSubmit={handleAddRoute} className="p-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Domain</label>
                  <input
                    type="text"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder={newWildcard ? "*.myapp.localhost" : "myapp.test"}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Port</label>
                  <input
                    type="number"
                    value={newPort}
                    onChange={(e) => setNewPort(e.target.value)}
                    placeholder="3000"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-400"
                    required
                  />
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={newSsl} onChange={(e) => setNewSsl(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
                    <span className="text-xs text-gray-600">SSL</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={newCors} onChange={(e) => setNewCors(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
                    <span className="text-xs text-gray-600">CORS</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={newWildcard} onChange={(e) => setNewWildcard(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
                    <span className="text-xs text-gray-600">Multi-Tenant</span>
                  </label>
                </div>
                {newWildcard && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Tenant Header</label>
                    <input
                      type="text"
                      value={newTenantHeader}
                      onChange={(e) => setNewTenantHeader(e.target.value)}
                      placeholder="X-Vroute-Tenant"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-400 font-mono"
                    />
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Adding...' : 'Add Route'}
                </button>
              </form>
            </div>

            {/* Active Routes */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5" />
                  Routes
                </h2>
                {routes.length > 0 && (
                  <span className="text-[10px] text-gray-400">{routes.length}</span>
                )}
              </div>
              <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                {routes.length > 0 ? routes.map(([domain, route]) => (
                  <div key={domain} className="px-4 py-3 hover:bg-gray-50 transition-colors group">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {route.wildcard ? (
                            <Hash className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                          ) : (
                            <LinkIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          )}
                          <span className="text-sm font-medium text-gray-900 truncate">{domain}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 ml-5.5">
                          <span className="text-xs text-gray-500 font-mono">:{route.port}</span>
                          {!route.wildcard && (
                            <a
                              href={`${route.ssl ? 'https' : 'http'}://${domain}${route.ssl ? ':8443' : ':8080'}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <div className="flex gap-1.5 mt-1.5 ml-5.5">
                          {route.wildcard && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-50 text-purple-700">MULTI</span>
                          )}
                          <span className={cn(
                            "px-1.5 py-0.5 text-[10px] font-medium rounded",
                            route.ssl ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                          )}>SSL</span>
                          <span className={cn(
                            "px-1.5 py-0.5 text-[10px] font-medium rounded",
                            route.cors ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-500"
                          )}>CORS</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 items-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setSelectedChaosDomain(domain);
                            setIsChaosModalOpen(true);
                          }}
                          className={cn(
                            "p-1.5 rounded-md transition-colors",
                            route.chaosEnabled 
                              ? "text-orange-600 bg-orange-50 hover:bg-orange-100" 
                              : "text-gray-400 hover:text-orange-500 hover:bg-orange-50"
                          )}
                          title="Chaos Monkey Settings"
                        >
                          <Zap className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRoute(domain)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                          title="Remove route"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="px-4 py-10 text-center">
                    <Server className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No routes yet</p>
                    <p className="text-xs text-gray-400 mt-1">Add a domain to get started</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right — Traffic Log */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-lg border border-gray-200 h-full flex flex-col">
              <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  Traffic
                  {logs.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 rounded">
                      {logs.length}
                    </span>
                  )}
                </h2>
                {logs.length > 0 && (
                  <button
                    onClick={() => setLogs([])}
                    className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-2.5 text-[11px] font-medium text-gray-400 uppercase tracking-wide">Method</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-medium text-gray-400 uppercase tracking-wide">Status</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-medium text-gray-400 uppercase tracking-wide">Host</th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-medium text-gray-400 uppercase tracking-wide">Path</th>
                      <th className="text-right px-4 py-2.5 text-[11px] font-medium text-gray-400 uppercase tracking-wide">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {logs.length > 0 ? logs.map((log, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2">
                          <span className={cn("px-2 py-0.5 text-[11px] font-medium rounded", getMethodColor(log.method))}>
                            {log.method}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className={cn("px-2 py-0.5 text-[11px] font-medium rounded font-mono", getStatusColor(log.status))}>
                              {log.status}
                            </span>
                            {log.shielded && (
                              <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-blue-50 text-blue-600 uppercase border border-blue-100" title="Intercepted by Shield">
                                Shield
                              </span>
                            )}
                            {log.chaosTriggered && (
                              <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-orange-50 text-orange-600 uppercase border border-orange-100" title="Intercepted by Chaos Monkey">
                                Chaos
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-gray-600 text-xs">{log.host}</td>
                        <td className="px-4 py-2 text-gray-900 text-xs font-mono max-w-[300px] truncate" title={log.url}>
                          {log.url}
                        </td>
                        <td className="px-4 py-2 text-right text-xs text-gray-400 font-mono">
                          {log.duration}ms
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-20 text-center">
                          <Activity className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">Waiting for traffic</p>
                          <p className="text-xs text-gray-400 mt-1">Requests will appear here in real-time</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Modals */}
      <ShieldModal
        isOpen={isShieldModalOpen}
        onClose={() => setIsShieldModalOpen(false)}
        enabled={config?.shieldEnabled ?? false}
        rules={config?.shieldRules ?? []}
        onSave={handleSaveShield}
      />
      {selectedChaosDomain && (
        <ChaosModal
          isOpen={isChaosModalOpen}
          onClose={() => setIsChaosModalOpen(false)}
          domain={selectedChaosDomain}
          enabled={config?.routes[selectedChaosDomain]?.chaosEnabled ?? false}
          rules={config?.routes[selectedChaosDomain]?.chaosRules ?? []}
          onSave={handleSaveChaos}
        />
      )}
    </div>
  );
}

export default App;
