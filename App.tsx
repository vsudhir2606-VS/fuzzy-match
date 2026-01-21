
import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  Search, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle,
  FileSearch,
  ChevronRight,
  Info,
  ArrowRightLeft,
  Table as TableIcon,
  Eye
} from 'lucide-react';
import { FileUpload } from './components/FileUpload';
import { getSimilarity } from './utils/fuzzy';
import { RawDataRow, AppState } from './types';

interface ExtendedMatchResult {
  originalRow: RawDataRow;
  customerName: string;
  rplMatch: string;
  similarity: number;
}

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [rawData, setRawData] = useState<RawDataRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [customerCol, setCustomerCol] = useState<string>('');
  const [rplCol, setRplCol] = useState<string>('');
  const [results, setResults] = useState<ExtendedMatchResult[]>([]);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [threshold, setThreshold] = useState(0.5);
  const [showPreview, setShowPreview] = useState(false);

  const reset = () => {
    setAppState(AppState.IDLE);
    setRawData([]);
    setHeaders([]);
    setResults([]);
    setCustomerCol('');
    setRplCol('');
    setShowPreview(false);
  };

  const handleDataLoaded = (data: RawDataRow[], cols: string[]) => {
    setRawData(data);
    setHeaders(cols);
    setAppState(AppState.MAPPING);
    
    // Auto-detect columns
    const cust = cols.find(c => /customer|client|name|entity/i.test(c));
    const rpl = cols.find(c => /rpl|restricted|denied|sanction|watch/i.test(c));
    if (cust) setCustomerCol(cust);
    if (rpl) setRplCol(rpl);
  };

  const startProcessing = async () => {
    if (!customerCol || !rplCol) return;
    setAppState(AppState.PROCESSING);
    setProcessingProgress(0);

    const matches: ExtendedMatchResult[] = [];
    
    // We keep unique RPL entries to speed up the cross-lookup, 
    // but we process EVERY row in the raw data (no deduplication of customers).
    const uniqueRPLs = Array.from(new Set(rawData.map(r => String(r[rplCol] || '')).filter(Boolean)));
    const total = rawData.length;
    
    for (let i = 0; i < total; i++) {
      const row = rawData[i];
      const cust = String(row[customerCol] || '');
      let bestMatch = "";
      let bestScore = 0;

      if (cust.trim()) {
        for (const rpl of uniqueRPLs) {
          const score = getSimilarity(cust, rpl);
          if (score > bestScore) {
            bestScore = score;
            bestMatch = rpl;
          }
          if (bestScore === 1.0) break;
        }
      }

      matches.push({
        originalRow: row,
        customerName: cust,
        rplMatch: bestMatch,
        similarity: parseFloat(bestScore.toFixed(4))
      });

      if (i % 25 === 0 || i === total - 1) {
        setProcessingProgress(Math.round(((i + 1) / total) * 100));
        await new Promise(r => setTimeout(r, 0));
      }
    }

    setResults(matches);
    setAppState(AppState.RESULTS);
  };

  const exportToExcel = () => {
    // Construct export data: Original Columns + Match Results
    const exportData = results.map(r => ({
      ...r.originalRow,
      'MATCHED_RPL_NAME': r.rplMatch,
      'MATCH_SIMILARITY': r.similarity,
      'RISK_LEVEL': r.similarity > 0.85 ? 'CRITICAL' : r.similarity > 0.65 ? 'HIGH' : 'LOW'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fuzzy Results Full");
    XLSX.writeFile(wb, "fuzzy_lookup_full_report.xlsx");
  };

  const filteredResults = useMemo(() => {
    return results.filter(r => r.similarity >= threshold);
  }, [results, threshold]);

  return (
    <div className="min-h-screen pb-20">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Search className="text-white" size={18} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">FuzzyMatch<span className="text-indigo-600">Pro</span></h1>
          </div>
          <div className="flex items-center gap-4">
            {appState !== AppState.IDLE && (
              <button 
                onClick={reset}
                className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                Start Over
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {appState === AppState.IDLE && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-extrabold text-gray-900 mb-3 tracking-tight">Customer & RPL Lookup</h2>
              <p className="text-gray-600">Upload your raw data file. We will compare every row to find matching restricted parties without removing any duplicates.</p>
            </div>
            <FileUpload onDataLoaded={handleDataLoaded} isLoading={false} />
          </div>
        )}

        {appState === AppState.MAPPING && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <ArrowRightLeft className="text-indigo-600" />
                  <h2 className="text-xl font-bold">Configure Lookup</h2>
                </div>
                <button 
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  <Eye size={16} />
                  {showPreview ? 'Hide Raw Data' : 'Preview Raw Data'}
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Customer Column</label>
                  <select 
                    value={customerCol}
                    onChange={(e) => setCustomerCol(e.target.value)}
                    className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">Select Source Column...</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">RPL Column</label>
                  <select 
                    value={rplCol}
                    onChange={(e) => setRplCol(e.target.value)}
                    className="w-full p-3 border rounded-lg bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">Select Reference Column...</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>

              {showPreview && (
                <div className="mb-8 border rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b text-xs font-bold text-gray-500 uppercase">Raw Data Snapshot (First 5 Rows)</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-white border-b">
                          {headers.map(h => <th key={h} className="px-4 py-2 text-left font-semibold text-gray-600">{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {rawData.slice(0, 5).map((row, i) => (
                          <tr key={i} className="border-b last:border-0">
                            {headers.map(h => <td key={h} className="px-4 py-2 text-gray-500">{String(row[h] || '')}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <button
                disabled={!customerCol || !rplCol}
                onClick={startProcessing}
                className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all
                  ${(!customerCol || !rplCol) 
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
                  }`}
              >
                Analyze All {rawData.length} Rows
              </button>
            </div>
          </div>
        )}

        {appState === AppState.PROCESSING && (
          <div className="max-w-md mx-auto text-center py-20">
            <RefreshCw className="mx-auto text-indigo-600 animate-spin mb-6" size={48} />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Processing Data...</h2>
            <p className="text-gray-500 mb-8">Comparing every row against the restricted party list.</p>
            <div className="w-full bg-gray-100 rounded-full h-4 mb-4">
              <div 
                className="bg-indigo-600 h-4 rounded-full transition-all duration-300" 
                style={{ width: `${processingProgress}%` }}
              ></div>
            </div>
            <p className="text-sm font-mono text-gray-400">{processingProgress}% Complete</p>
          </div>
        )}

        {appState === AppState.RESULTS && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Analysis Complete</h2>
                <p className="text-gray-500">Processed {results.length} rows from your original data.</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Similarity Threshold</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="range" min="0" max="1" step="0.05" value={threshold}
                      onChange={(e) => setThreshold(parseFloat(e.target.value))}
                      className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <span className="text-sm font-mono font-bold bg-white px-2 py-1 border rounded shadow-sm w-12 text-center">
                      {threshold.toFixed(2)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={exportToExcel}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-200"
                >
                  <Download size={18} />
                  Export Full Data
                </button>
              </div>
            </div>

            <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-left border-collapse sticky-header">
                  <thead className="sticky top-0 bg-gray-50 z-10">
                    <tr className="border-b shadow-sm">
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">#</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Input Customer</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Best RPL Match</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">Score</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredResults.length > 0 ? (
                      filteredResults.map((result, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-xs font-mono text-gray-400">{idx + 1}</td>
                          <td className="px-6 py-4 font-medium text-gray-900">{result.customerName}</td>
                          <td className="px-6 py-4 text-gray-600">{result.rplMatch || <span className="text-gray-300 italic">No match</span>}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold border ${
                              result.similarity > 0.8 ? 'bg-red-50 text-red-700 border-red-100' :
                              result.similarity > 0.5 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                              'bg-green-50 text-green-700 border-green-100'
                            }`}>
                              {result.similarity.toFixed(4)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center">
                              {result.similarity > 0.85 ? (
                                <AlertTriangle className="text-red-500" size={18} />
                              ) : result.similarity > 0.65 ? (
                                <Info className="text-amber-500" size={18} />
                              ) : (
                                <CheckCircle2 className="text-emerald-500" size={18} />
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-20 text-center text-gray-400">
                          <FileSearch size={48} className="mx-auto mb-4 opacity-20" />
                          <p>No matches found above threshold {threshold}</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-sm text-gray-500 bg-gray-50 p-4 rounded-xl border">
              <div className="flex gap-4">
                <span className="flex items-center gap-1.5"><TableIcon size={14} /> {filteredResults.length} of {results.length} rows displayed</span>
                <span className="opacity-50">|</span>
                <span>Algorithm: Dice Coefficient</span>
              </div>
              <p className="italic text-xs font-medium text-indigo-600">Note: Export contains all original columns from your uploaded file.</p>
            </div>
          </div>
        )}
      </main>

      {appState === AppState.RESULTS && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-xl flex justify-center z-10">
           <div className="max-w-7xl w-full flex items-center justify-between px-4">
             <div className="hidden sm:block text-sm text-gray-500">
               Audit results and export the full matched dataset back to Excel.
             </div>
             <div className="flex gap-3">
               <button onClick={reset} className="px-6 py-2 rounded-lg border font-bold text-gray-600 hover:bg-gray-50">
                 New Analysis
               </button>
               <button onClick={exportToExcel} className="px-8 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 flex items-center gap-2">
                 Download Excel Report <ChevronRight size={18} />
               </button>
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
