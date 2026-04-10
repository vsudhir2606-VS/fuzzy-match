
import { cleanString, getSimilarity, getCommonWords, getTokens } from './utils/fuzzy';
import { RawDataRow } from './types';

interface WorkerInput {
  rawData: RawDataRow[];
  customerCol: string;
  rplCol: string;
}

interface ExtendedMatchResult {
  originalRow: RawDataRow;
  customerName: string;
  rplMatch: string;
  similarity: number;
  commonWords: string[];
}

self.onmessage = async (e: MessageEvent<WorkerInput>) => {
  const { rawData, customerCol, rplCol } = e.data;

  const rplStrings = rawData.map(r => String(r[rplCol] || '').trim()).filter(Boolean);
  const uniqueRPLs = Array.from(new Set(rplStrings));
  const totalRPLs = uniqueRPLs.length;

  // Build Inverted Index and Token Weights (IDF)
  const index = new Map<string, number[]>();
  const docFreq = new Map<string, number>();

  uniqueRPLs.forEach((rpl, idx) => {
    const tokens = getTokens(rpl);
    const uniqueTokensInDoc = new Set(tokens);
    uniqueTokensInDoc.forEach(token => {
      if (!index.has(token)) index.set(token, []);
      index.get(token)!.push(idx);
      docFreq.set(token, (docFreq.get(token) || 0) + 1);
    });
  });

  // Calculate Weights: IDF = log(N / DF)
  const weights = new Map<string, number>();
  docFreq.forEach((freq, token) => {
    weights.set(token, Math.log(totalRPLs / freq) + 1);
  });

  const total = rawData.length;
  const results: ExtendedMatchResult[] = [];

  // Optimization: Pre-sort tokens by weight (rare tokens first) for faster candidate pruning
  const getSortedTokens = (tokens: string[]) => {
    return tokens.sort((a, b) => (weights.get(b) || 0) - (weights.get(a) || 0));
  };

  for (let i = 0; i < total; i++) {
    const row = rawData[i];
    const cust = String(row[customerCol] || '');
    let bestMatch = "";
    let bestScore = 0;

    if (cust.trim()) {
      const custTokens = getTokens(cust);
      const sortedCustTokens = getSortedTokens(custTokens);
      
      const candidates = new Map<number, number>(); // idx -> score contribution or count
      
      // Heuristic: Only consider candidates that share at least one significant token
      // or multiple common tokens.
      for (const token of sortedCustTokens) {
        const matches = index.get(token);
        if (matches) {
          const weight = weights.get(token) || 1.0;
          for (const mIdx of matches) {
            candidates.set(mIdx, (candidates.get(mIdx) || 0) + weight);
          }
        }
        // If we already have enough candidates from rare tokens, we can stop adding more
        // Reduced from 500 to 200 for 2 lakh row performance
        if (candidates.size > 200) break; 
      }

      // Sort candidates by their weighted overlap to check best ones first
      const sortedCandidates = Array.from(candidates.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50); // Reduced from 100 to 50 for speed

      for (const [idx] of sortedCandidates) {
        const rpl = uniqueRPLs[idx];
        const score = getSimilarity(cust, rpl, weights);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = rpl;
        }
        if (bestScore > 0.99) break;
      }
    }

    results.push({
      originalRow: row,
      customerName: cust,
      rplMatch: bestMatch,
      similarity: parseFloat(bestScore.toFixed(4)),
      commonWords: bestMatch ? getCommonWords(cust, bestMatch) : []
    });

    if (i % 1000 === 0 && i > 0) {
      self.postMessage({
        type: 'CHUNK',
        results: results.splice(0, results.length)
      });
    }

    if (i % 500 === 0 || i === total - 1) {
      self.postMessage({
        type: 'PROGRESS',
        progress: Math.round(((i + 1) / total) * 100)
      });
    }
  }

  self.postMessage({
    type: 'COMPLETE',
    results: results // Send remaining
  });
};
