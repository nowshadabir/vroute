import { useState, useEffect } from 'react';
import { X, Zap, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export interface ChaosRule {
  path: string;
  method: string;
  latency: number;
  failureRate: number;
  errorStatus: number;
}

export interface ChaosModalProps {
  isOpen: boolean;
  onClose: () => void;
  domain: string;
  enabled?: boolean;
  rules?: ChaosRule[];
  onSave: (domain: string, enabled: boolean, rules: ChaosRule[]) => Promise<void>;
}

export function ChaosModal({ isOpen, onClose, domain, enabled = false, rules = [], onSave }: ChaosModalProps) {
  const [localEnabled, setLocalEnabled] = useState(enabled);
  const [localRules, setLocalRules] = useState<ChaosRule[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalEnabled(enabled);
      setLocalRules([...rules]);
    }
  }, [isOpen, enabled, rules]);

  if (!isOpen) return null;

  const handleAddRule = () => {
    setLocalRules([
      ...localRules,
      { path: '*', method: '*', latency: 0, failureRate: 50, errorStatus: 502 }
    ]);
  };

  const handleRemoveRule = (index: number) => {
    setLocalRules(localRules.filter((_, i) => i !== index));
  };

  const handleChangeRule = (index: number, field: keyof ChaosRule, value: any) => {
    const newRules = [...localRules];
    newRules[index] = { ...newRules[index], [field]: value } as ChaosRule;
    setLocalRules(newRules);
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await onSave(domain, localEnabled, localRules);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save Chaos settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Chaos Monkey: {domain}</h2>
              <p className="text-xs text-gray-500">Inject latency and faults to test frontend resilience.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Enable Chaos Mode</h3>
              <p className="text-xs text-gray-500 mt-0.5">Activate configured failure and latency rules for this route.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={localEnabled} onChange={(e) => setLocalEnabled(e.target.checked)} />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900">Chaos Rules</h3>
              <button onClick={handleAddRule} className="px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md font-medium text-xs flex items-center gap-1 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add Rule
              </button>
            </div>
            
            <div className="border border-gray-100 rounded-md">
              {localRules.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase border-b border-gray-100">
                      <tr>
                        <th className="px-3 py-2 font-medium">Method</th>
                        <th className="px-3 py-2 font-medium">Path (Glob)</th>
                        <th className="px-3 py-2 font-medium">Latency (ms)</th>
                        <th className="px-3 py-2 font-medium">Fail Rate (%)</th>
                        <th className="px-3 py-2 font-medium">Status Code</th>
                        <th className="px-3 py-2 font-medium w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {localRules.map((rule, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <select 
                              value={rule.method} 
                              onChange={(e) => handleChangeRule(index, 'method', e.target.value)}
                              className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs focus:ring-orange-500 focus:border-orange-500"
                            >
                              <option value="*">ANY</option>
                              <option value="GET">GET</option>
                              <option value="POST">POST</option>
                              <option value="PUT">PUT</option>
                              <option value="DELETE">DELETE</option>
                              <option value="PATCH">PATCH</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input 
                              type="text" 
                              value={rule.path} 
                              onChange={(e) => handleChangeRule(index, 'path', e.target.value)}
                              className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs font-mono focus:ring-orange-500 focus:border-orange-500"
                              placeholder="/api/*"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input 
                              type="number" 
                              value={rule.latency} 
                              onChange={(e) => handleChangeRule(index, 'latency', Number(e.target.value))}
                              className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs focus:ring-orange-500 focus:border-orange-500"
                              min="0"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input 
                              type="number" 
                              value={rule.failureRate} 
                              onChange={(e) => handleChangeRule(index, 'failureRate', Number(e.target.value))}
                              className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs focus:ring-orange-500 focus:border-orange-500"
                              min="0" max="100"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input 
                              type="number" 
                              value={rule.errorStatus} 
                              onChange={(e) => handleChangeRule(index, 'errorStatus', Number(e.target.value))}
                              className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs focus:ring-orange-500 focus:border-orange-500"
                              min="100" max="599"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button type="button" onClick={() => handleRemoveRule(index)} className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="p-4 text-xs text-gray-400 text-center">No rules configured. All traffic will pass normally.</p>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 bg-gray-100 rounded-md transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-md disabled:opacity-50 transition-colors">
            {isSubmitting ? 'Saving...' : 'Save Chaos Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
