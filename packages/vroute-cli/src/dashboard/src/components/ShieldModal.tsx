import { useState, useEffect } from 'react';
import { X, Shield, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export interface ShieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  enabled: boolean;
  rules: string[];
  onSave: (enabled: boolean, rules: string[]) => Promise<void>;
}

export function ShieldModal({ isOpen, onClose, enabled, rules, onSave }: ShieldModalProps) {
  const [localEnabled, setLocalEnabled] = useState(enabled);
  const [localRules, setLocalRules] = useState<string[]>([]);
  const [newRule, setNewRule] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalEnabled(enabled);
      setLocalRules([...rules]);
      setNewRule('');
    }
  }, [isOpen, enabled, rules]);

  if (!isOpen) return null;

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.trim()) return;
    if (localRules.includes(newRule.trim())) {
      toast.error('Rule already exists');
      return;
    }
    setLocalRules([...localRules, newRule.trim()]);
    setNewRule('');
  };

  const handleRemoveRule = (ruleToRemove: string) => {
    setLocalRules(localRules.filter(r => r !== ruleToRemove));
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await onSave(localEnabled, localRules);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save Shield settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Analytics & Webhook Shield</h2>
              <p className="text-xs text-gray-500">Intercept outbound tracking scripts seamlessly.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Enable Shield</h3>
              <p className="text-xs text-gray-500 mt-0.5">Mock analytics and webhooks with 200 OK responses.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={localEnabled} onChange={(e) => setLocalEnabled(e.target.checked)} />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
            </label>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-900">Shielded Rules</h3>
            <form onSubmit={handleAddRule} className="flex gap-2">
              <input 
                type="text" 
                value={newRule}
                onChange={(e) => setNewRule(e.target.value)}
                placeholder="e.g., *.google-analytics.com or /api/webhook" 
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button type="submit" className="px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md font-medium text-sm flex items-center gap-1 transition-colors">
                <Plus className="w-4 h-4" /> Add
              </button>
            </form>
            
            <div className="max-h-[200px] overflow-y-auto border border-gray-100 rounded-md">
              {localRules.length > 0 ? (
                <ul className="divide-y divide-gray-100">
                  {localRules.map((rule) => (
                    <li key={rule} className="flex items-center justify-between px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                      <span className="font-mono text-xs">{rule}</span>
                      <button type="button" onClick={() => handleRemoveRule(rule)} className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="p-4 text-xs text-gray-400 text-center">No rules configured. All traffic will pass through.</p>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 bg-gray-100 rounded-md transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 transition-colors">
            {isSubmitting ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
