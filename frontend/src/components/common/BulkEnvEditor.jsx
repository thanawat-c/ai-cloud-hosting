import { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Table, 
  Upload, 
  Download, 
  Copy, 
  Check, 
  Trash2, 
  Eye, 
  EyeOff, 
  Plus, 
  Database, 
  AlertTriangle, 
  Sparkles,
  Key
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * Helper to parse a raw .env string into array of { id, key, value, comment, isSecret }
 */
const parseEnvToRows = (rawText) => {
  if (!rawText) return [];
  const lines = rawText.split('\n');
  const rows = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    
    // Comment line
    if (trimmed.startsWith('#')) {
      rows.push({
        id: `row-${index}-${Date.now()}`,
        key: '',
        value: trimmed,
        isComment: true,
      });
      return;
    }

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) {
      rows.push({
        id: `row-${index}-${Date.now()}`,
        key: trimmed,
        value: '',
        isComment: false,
      });
      return;
    }

    const key = line.slice(0, eqIndex).trim();
    let val = line.slice(eqIndex + 1).trim();

    // Remove wrapping quotes if present
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }

    const isSecret = /secret|password|key|token|auth|pwd|cert/i.test(key);

    rows.push({
      id: `row-${index}-${Date.now()}`,
      key,
      value: val,
      isComment: false,
      isSecret,
      showSecret: false,
    });
  });

  return rows;
};

/**
 * Helper to convert array of rows back to raw .env string
 */
const rowsToRawEnv = (rows) => {
  return rows
    .map(r => {
      if (r.isComment) return r.value;
      if (!r.key && !r.value) return '';
      // If value contains spaces, wrap in quotes
      const needsQuotes = /\s/.test(r.value) && !r.value.startsWith('"');
      const valStr = needsQuotes ? `"${r.value}"` : r.value;
      return `${r.key}=${valStr}`;
    })
    .filter(Boolean)
    .join('\n');
};

export const BulkEnvEditor = ({
  value = '',
  onChange,
  databases = [],
  placeholder = 'DATABASE_URL=postgres://...\nPORT=8080\nSECRET_KEY=my_secret',
  disabled = false,
  minRows = 6,
}) => {
  const [mode, setMode] = useState('raw'); // 'raw' | 'table'
  const [rows, setRows] = useState([]);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);

  // Sync rows when raw text changes outside
  useEffect(() => {
    if (mode === 'table') {
      setRows(parseEnvToRows(value));
    }
  }, [mode]);

  const handleModeChange = (newMode) => {
    if (newMode === 'table') {
      setRows(parseEnvToRows(value));
    } else if (newMode === 'raw' && rows.length > 0) {
      onChange?.(rowsToRawEnv(rows));
    }
    setMode(newMode);
  };

  // Row operations in Table Mode
  const updateRow = (index, field, val) => {
    const updated = [...rows];
    updated[index][field] = val;
    setRows(updated);
    onChange?.(rowsToRawEnv(updated));
  };

  const addRow = () => {
    const newRow = {
      id: `row-new-${Date.now()}`,
      key: '',
      value: '',
      isComment: false,
      isSecret: false,
      showSecret: true,
    };
    const updated = [...rows, newRow];
    setRows(updated);
  };

  const removeRow = (index) => {
    const updated = rows.filter((_, i) => i !== index);
    setRows(updated);
    onChange?.(rowsToRawEnv(updated));
  };

  const toggleRowSecret = (index) => {
    const updated = [...rows];
    updated[index].showSecret = !updated[index].showSecret;
    setRows(updated);
  };

  // Import .env file
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        const merged = value.trim() ? `${value.trim()}\n${content.trim()}` : content.trim();
        onChange?.(merged);
        if (mode === 'table') {
          setRows(parseEnvToRows(merged));
        }
        toast.success(`Imported environment variables from ${file.name}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Download / Export .env file
  const handleDownload = () => {
    if (!value.trim()) {
      toast.error('No environment variables to export');
      return;
    }
    const blob = new Blob([value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '.env';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Downloaded .env file');
  };

  // Copy all to clipboard
  const handleCopy = () => {
    if (!value.trim()) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success('Copied all variables to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  // Clear all
  const handleClear = () => {
    if (!value.trim()) return;
    if (confirm('Are you sure you want to clear all environment variables?')) {
      onChange?.('');
      setRows([]);
      toast.success('Environment variables cleared');
    }
  };

  // Quick insert database URL
  const insertDatabase = (db) => {
    const snippet = `DATABASE_URL=${db.internal_url}`;
    if (!value.includes(snippet)) {
      const updated = value.trim() ? `${value.trim()}\n${snippet}` : snippet;
      onChange?.(updated);
      if (mode === 'table') {
        setRows(parseEnvToRows(updated));
      }
      toast.success(`Inserted ${db.name} connection URL`);
    } else {
      toast.info('Database URL is already added');
    }
  };

  const parsedVarsCount = value
    ? value.split('\n').filter(l => l.trim() && !l.trim().startsWith('#') && l.includes('=')).length
    : 0;

  return (
    <div className="space-y-2.5">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Mode Switcher */}
        <div className="inline-flex p-0.5 rounded-lg bg-neutral-900 border border-neutral-800">
          <button
            type="button"
            onClick={() => handleModeChange('raw')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
              mode === 'raw'
                ? 'bg-neutral-800 text-white font-medium shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Raw .env (Bulk)</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('table')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
              mode === 'table'
                ? 'bg-neutral-800 text-white font-medium shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Key-Value Table</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".env,.txt"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Import .env file from computer"
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white transition-colors text-[11px]"
          >
            <Upload className="w-3 h-3" />
            <span>Import .env</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            title="Export to .env file"
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white transition-colors text-[11px]"
          >
            <Download className="w-3 h-3" />
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            title="Copy all to clipboard"
            className="p-1.5 rounded-md bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={handleClear}
            title="Clear all variables"
            className="p-1.5 rounded-md bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Database Insertion Pills */}
      {databases && databases.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap pt-0.5">
          <span className="text-[11px] font-mono text-neutral-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span>Quick DB Inject:</span>
          </span>
          {databases.map(db => (
            <button
              key={db.id}
              type="button"
              onClick={() => insertDatabase(db)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-900 hover:bg-purple-950/40 border border-neutral-800 hover:border-purple-800/60 text-purple-300 font-mono text-[11px] transition-colors"
            >
              <Database className="w-3 h-3 text-purple-400" />
              <span>{db.name}</span>
              {db.host_port && (
                <span className="text-[10px] text-purple-400/70 font-mono">(:{db.host_port})</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Editor Body */}
      {mode === 'raw' ? (
        <div className="relative">
          <textarea
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            disabled={disabled}
            rows={minRows}
            placeholder={placeholder}
            className="w-full px-3.5 py-2.5 rounded-lg border border-neutral-800 bg-black text-white font-mono text-xs focus:border-neutral-600 focus:outline-none placeholder:text-neutral-600 transition-colors leading-relaxed selection:bg-purple-900"
          />
        </div>
      ) : (
        <div className="border border-neutral-800 rounded-lg overflow-hidden bg-black/60 divide-y divide-neutral-800/80">
          {rows.length === 0 ? (
            <div className="p-6 text-center text-xs text-neutral-500">
              No variables added yet. Click <b>"+ Add Variable"</b> or switch to <b>Raw .env</b> to paste your configuration.
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto divide-y divide-neutral-900">
              {rows.map((row, idx) => (
                <div key={row.id} className="flex items-center gap-2 p-2 hover:bg-neutral-950/80 transition-colors">
                  {row.isComment ? (
                    <div className="flex-1 px-2 font-mono text-xs text-neutral-500 italic">
                      {row.value}
                    </div>
                  ) : (
                    <>
                      <div className="w-2/5 min-w-[120px]">
                        <input
                          type="text"
                          value={row.key}
                          onChange={(e) => updateRow(idx, 'key', e.target.value)}
                          placeholder="KEY_NAME"
                          className="w-full px-2.5 py-1 text-xs font-mono bg-neutral-900 border border-neutral-800 rounded text-neutral-200 focus:outline-none focus:border-neutral-600 placeholder:text-neutral-600"
                        />
                      </div>
                      <span className="text-neutral-500 font-mono text-xs">=</span>
                      <div className="flex-1 relative">
                        <input
                          type={row.isSecret && !row.showSecret ? 'password' : 'text'}
                          value={row.value}
                          onChange={(e) => updateRow(idx, 'value', e.target.value)}
                          placeholder="value"
                          className="w-full px-2.5 py-1 pr-8 text-xs font-mono bg-neutral-900 border border-neutral-800 rounded text-white focus:outline-none focus:border-neutral-600 placeholder:text-neutral-600"
                        />
                        {row.isSecret && (
                          <button
                            type="button"
                            onClick={() => toggleRowSecret(idx)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                          >
                            {row.showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    className="p-1 text-neutral-500 hover:text-red-400 rounded hover:bg-neutral-900 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="p-2 bg-neutral-950/60 flex items-center justify-between">
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Add Variable</span>
            </button>
            <span className="text-[11px] text-neutral-500 font-mono">
              {rows.filter(r => !r.isComment).length} variables
            </span>
          </div>
        </div>
      )}

      {/* Bottom Status / Stats */}
      <div className="flex items-center justify-between text-[11px] text-neutral-500 font-mono px-1">
        <span>
          {parsedVarsCount > 0 ? (
            <span className="text-emerald-400/90 font-medium">✓ {parsedVarsCount} variables parsed</span>
          ) : (
            'Paste your .env or insert database credentials above'
          )}
        </span>
        <span className="text-neutral-600">Supports comments (#) and quotes</span>
      </div>
    </div>
  );
};
