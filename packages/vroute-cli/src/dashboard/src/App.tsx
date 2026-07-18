import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { io } from 'socket.io-client';
import { Activity, Globe, Server, Link as LinkIcon, ExternalLink, Trash2, Plus } from 'lucide-react';

import toast, { Toaster } from 'react-hot-toast';
import { cn } from './lib/utils';
import './index.css';

interface RouteConfig {
  port: number;
  ssl: boolean;
  cors: boolean;
}

interface Config {
  routes: Record<string, RouteConfig>;
  daemonPid?: number;
}

interface RequestLog {
  method: string;
  url: string;
  host: string;
  status: number;
  duration: number;
  timestamp: string;
  error?: string;
}

function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [connected, setConnected] = useState(false);

  const [newDomain, setNewDomain] = useState('');
  const [newPort, setNewPort] = useState('');
  const [newSsl, setNewSsl] = useState(true);
  const [newCors, setNewCors] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const socketUrl = import.meta.env.DEV ? 'http://localhost:9999' : window.location.origin;
    const socket = io(socketUrl);

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('config', (newConfig: Config) => setConfig(newConfig));
    socket.on('request-log', (log: RequestLog) => {
      setLogs((prev) => [log, ...prev].slice(0, 100));
    });

    return () => { socket.disconnect(); };
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

    setIsSubmitting(true);
    const toastId = toast.loading('Adding route...');
    try {
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain, port: parseInt(newPort, 10), ssl: newSsl, cors: newCors }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to add route', { id: toastId });
      } else {
        toast.success(`Route added: ${newDomain}`, { id: toastId });
        setNewDomain('');
        setNewPort('');
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

  const routes = config?.routes ? Object.entries(config.routes) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="bottom-right" toastOptions={{ className: 'text-sm' }} />

      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
              <Globe className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">vroute</h1>
              <p className="text-xs text-gray-500">Local DNS & SSL Router</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
              connected ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full", connected ? "bg-green-500" : "bg-gray-400")} />
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Routes */}
          <div className="lg:col-span-1 space-y-4">
            {/* Add Route Form */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add Route
                </h2>
              </div>
              <form onSubmit={handleAddRoute} className="p-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Domain</label>
                  <input
                    type="text"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    placeholder="myapp.test"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder:text-gray-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Port</label>
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
                </div>
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
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  Routes
                  {routes.length > 0 && (
                    <span className="ml-auto text-xs text-gray-400">{routes.length}</span>
                  )}
                </h2>
              </div>
              <div className="divide-y divide-gray-100">
                {routes.length > 0 ? routes.map(([domain, route]) => (
                  <div key={domain} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <LinkIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="text-sm font-medium text-gray-900 truncate">{domain}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 ml-5.5">
                          <span className="text-xs text-gray-500 font-mono">:{route.port}</span>
                          <a
                            href={`${route.ssl ? 'https' : 'http'}://${domain}${route.ssl ? ':8443' : ':8080'}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <div className="flex gap-1.5 mt-2 ml-5.5">
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
                      <button
                        onClick={() => handleDeleteRoute(domain)}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Remove route"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="px-4 py-8 text-center">
                    <Server className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No routes configured</p>
                    <p className="text-xs text-gray-400 mt-1">Add a route to get started</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Traffic Log */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg border border-gray-200 h-full flex flex-col">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Traffic
                  {logs.length > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 rounded">
                      {logs.length}
                    </span>
                  )}
                </h2>
                {logs.length > 0 && (
                  <button
                    onClick={() => setLogs([])}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Method</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Status</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Host</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Path</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {logs.length > 0 ? logs.map((log, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5">
                          <span className={cn("px-2 py-0.5 text-xs font-medium rounded", getMethodColor(log.method))}>
                            {log.method}
                          </span>
                        </td>
                        <td className={cn("px-4 py-2.5 font-mono text-xs font-medium", getStatusColor(log.status))}>
                          {log.status}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 text-xs">{log.host}</td>
                        <td className="px-4 py-2.5 text-gray-900 text-xs font-mono max-w-[200px] truncate" title={log.url}>
                          {log.url}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-gray-400 font-mono">
                          {log.duration}ms
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-16 text-center">
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
    </div>
  );
}

export default App;
