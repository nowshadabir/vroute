import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { io } from 'socket.io-client';
import { format } from 'date-fns';
import { Activity, Radio, Server, Link as LinkIcon, ExternalLink, Trash2 } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
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
  
  // Form State
  const [newDomain, setNewDomain] = useState('');
  const [newPort, setNewPort] = useState('');
  const [newSsl, setNewSsl] = useState(true);
  const [newCors, setNewCors] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const socketUrl = import.meta.env.DEV ? 'http://localhost:9999' : window.location.origin;
    
    const socket = io(socketUrl);

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('config', (newConfig: Config) => {
      setConfig(newConfig);
    });

    socket.on('request-log', (log: RequestLog) => {
      setLogs((prevLogs) => [log, ...prevLogs].slice(0, 100)); // Keep last 100
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const getStatusClass = (status: number) => {
    if (status >= 200 && status < 300) return 'status-ok';
    if (status >= 300 && status < 400) return 'status-redirect';
    return 'status-error';
  };

  const handleAddRoute = async (e: FormEvent) => {
    e.preventDefault();
    if (!newDomain || !newPort) return;
    
    setIsSubmitting(true);
    const toastId = toast.loading('Waiting for OS permission to add route...');
    try {
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: newDomain,
          port: parseInt(newPort, 10),
          ssl: newSsl,
          cors: newCors
        })
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(`Failed to add route: ${data.error}`, { id: toastId });
      } else {
        toast.success(`Route ${newDomain} added successfully!`, { id: toastId });
        setNewDomain('');
        setNewPort('');
        setNewSsl(true);
        setNewCors(true);
      }
    } catch (err: any) {
      toast.error(`Error adding route: ${err.message}`, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRoute = async (domain: string) => {
    if (!confirm(`Are you sure you want to remove ${domain}? This will prompt for your OS password to update the hosts file.`)) {
      return;
    }
    const toastId = toast.loading(`Waiting for OS permission to remove ${domain}...`);
    try {
      const res = await fetch(`/api/routes/${encodeURIComponent(domain)}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(`Failed to remove route: ${data.error}`, { id: toastId });
      } else {
        toast.success(`Route ${domain} removed successfully!`, { id: toastId });
      }
    } catch (err: any) {
      toast.error(`Error removing route: ${err.message}`, { id: toastId });
    }
  };

  return (
    <div className="dashboard-container">
      <Toaster 
        position="bottom-right" 
        toastOptions={{ 
          style: { 
            background: 'rgba(22, 27, 34, 0.9)', 
            backdropFilter: 'blur(10px)',
            color: '#fff', 
            border: '1px solid rgba(255, 255, 255, 0.1)' 
          } 
        }} 
      />
      <header className="glass-panel header">
        <h1>
          <Activity size={28} />
          vroute Dashboard
        </h1>
        <div className="status-badge">
          {connected ? (
            <>
              <div className="status-dot"></div>
              Connected
            </>
          ) : (
            <>
              <Radio size={16} color="var(--error)" />
              <span style={{ color: 'var(--error)' }}>Disconnected</span>
            </>
          )}
        </div>
      </header>

      <div className="main-grid">
        <aside className="glass-panel route-list-container">
          <div className="panel-header">
            <Server size={18} />
            Route Management
          </div>
          
          <form className="add-route-form" onSubmit={handleAddRoute}>
            <div className="form-group">
              <label>Domain</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. myapp.local" 
                value={newDomain}
                onChange={e => setNewDomain(e.target.value)}
                required 
              />
            </div>
            <div className="form-group">
              <label>Target Port</label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="e.g. 3000" 
                value={newPort}
                onChange={e => setNewPort(e.target.value)}
                required 
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
              <label className="checkbox-group">
                <input type="checkbox" checked={newSsl} onChange={e => setNewSsl(e.target.checked)} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>SSL (HTTPS)</span>
              </label>
              <label className="checkbox-group">
                <input type="checkbox" checked={newCors} onChange={e => setNewCors(e.target.checked)} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Bypass CORS</span>
              </label>
            </div>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Waiting for OS...' : 'Add Route'}
            </button>
          </form>

          <div className="route-list">
            {config?.routes && Object.entries(config.routes).length > 0 ? (
              Object.entries(config.routes).map(([domain, routeConfig]) => (
                <div key={domain} className="route-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div className="route-domain">
                        <LinkIcon size={14} color="var(--accent)" />
                        {domain}
                      </div>
                      <div className="route-target" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        127.0.0.1:{routeConfig.port}
                        <a href={`${routeConfig.ssl ? 'https' : 'http'}://${domain}${routeConfig.ssl ? ':8443' : ':8080'}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                          <ExternalLink size={14} />
                        </a>
                      </div>
                      <div className="route-badges">
                        <span className={`badge ${routeConfig.ssl ? 'badge-active' : 'badge-inactive'}`}>
                          SSL
                        </span>
                        <span className={`badge ${routeConfig.cors ? 'badge-active' : 'badge-inactive'}`}>
                          CORS
                        </span>
                      </div>
                    </div>
                    <button className="btn-icon" onClick={() => handleDeleteRoute(domain)} title="Remove Route">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '1rem', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.875rem' }}>
                No active routes.
              </div>
            )}
          </div>
        </aside>

        <main className="glass-panel log-viewer-container">
          <div className="panel-header" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} />
              Real-time Traffic
            </div>
            {logs.length > 0 && (
              <button 
                onClick={() => setLogs([])}
                style={{ 
                  background: 'none', border: 'none', color: 'var(--text-secondary)', 
                  cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline' 
                }}
              >
                Clear
              </button>
            )}
          </div>
          <div className="log-table-container">
            <table className="log-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Method</th>
                  <th>Status</th>
                  <th>Host</th>
                  <th>Path</th>
                  <th>Time</th>
                  <th style={{ textAlign: 'right' }}>Duration</th>
                </tr>
              </thead>
              <tbody>
                {logs.length > 0 ? logs.map((log, i) => (
                  <tr key={i} className="log-row">
                    <td>
                      <span className={`method-badge method-${log.method}`}>
                        {log.method}
                      </span>
                    </td>
                    <td className={getStatusClass(log.status)}>
                      {log.status}
                    </td>
                    <td>{log.host}</td>
                    <td className="url-col" title={log.url}>
                      {log.url}
                    </td>
                    <td className="time-col">
                      {format(new Date(log.timestamp), 'HH:mm:ss.SSS')}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {log.duration}ms
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                      Waiting for incoming requests...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
