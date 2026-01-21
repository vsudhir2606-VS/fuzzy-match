
/**
 * Computes similarity between two strings using Sorensen-Dice coefficient.
 * This is generally better for business names than pure Levenshtein.
 */
export function getSimilarity(str1: string, str2: string): number {
  const s1 = cleanString(str1);
  const s2 = cleanString(str2);

  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0;

  const bigrams1 = getBigrams(s1);
  const bigrams2 = getBigrams(s2);

  const intersection = bigrams1.filter(b => bigrams2.includes(b)).length;
  return (2 * intersection) / (bigrams1.length + bigrams2.length);
}

/**
 * Finds common words between two strings, ignoring common business suffixes.
 */
export function getCommonWords(str1: string, str2: string): string[] {
  const tokenize = (s: string) => 
    s.toLowerCase()
     .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
     .split(/\s+/)
     .filter(w => w.length > 1 && !['ltd', 'co', 'inc', 'corp', 'limited', 'llc', 'plc', 'and', 'the'].includes(w));

  const words1 = tokenize(str1);
  const words2 = tokenize(str2);
  const set2 = new Set(words2);
  
  return Array.from(new Set(words1.filter(word => set2.has(word))));
}

function cleanString(str: string): string {
  // Normalize and remove common business suffixes for better matching
  return str
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\b(co|ltd|inc|corp|corporation|limited|technology|tech|group|int|international|trade|llc|plc)\b/g, "")
    .trim();
}

function getBigrams(str: string): string[] {
  const bigrams: string[] = [];
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.push(str.substring(i, i + 2));
  }
  return bigrams;
}
