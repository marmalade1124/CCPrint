export const getApiBase = () => {
  const host = (window.location.hostname === 'tauri.localhost' || !window.location.hostname) ? 'localhost' : window.location.hostname;
  return `http://${host}:3001`;
};

export const getWsUrl = () => {
  const host = (window.location.hostname === 'tauri.localhost' || !window.location.hostname) ? 'localhost' : window.location.hostname;
  return `ws://${host}:3001/ws`;
};

export const isTauri = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (window as any).__TAURI__ !== undefined || 
         (window as any).__TAURI_INTERNALS__ !== undefined ||
         (window as any).ipc !== undefined;
};

export function normalizeFilename(filename: string): string {
  if (!filename) return '';
  return filename
    // Remove plate designations like (Plate 1), _plate_1, plate1, etc.
    .replace(/\s*\(Plate\s+\d+\)\s*$/i, '')
    .replace(/[-_]plate[-_]?\d+/i, '')
    .replace(/\bplate\s*\d+\b/i, '')
    // Remove standard extensions
    .replace(/\.gcode(\.3mf)?$/i, '')
    .replace(/\.3mf$/i, '')
    .replace(/\.gcode$/i, '')
    .replace(/\.stl$/i, '')
    // Replace non-alphanumeric characters with spaces
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    // Strip trailing digits/copies (like " 2", " 3", etc.)
    .replace(/\s+\d+$/g, '')
    // Strip trailing version suffixes (like " v2", " v6", etc.)
    .replace(/\s+v\d+$/i, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getBigrams(str: string): string[] {
  const s = str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const bigrams: string[] = [];
  for (let i = 0; i < s.length - 1; i++) {
    bigrams.push(s.slice(i, i + 2));
  }
  return bigrams;
}

export function getStringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  // Exact clean match
  const clean1 = str1.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const clean2 = str2.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (clean1 === clean2) return 1.0;
  
  // Substring containment match
  if (clean1.length > 3 && clean2.length > 3) {
    if (clean1.includes(clean2) || clean2.includes(clean1)) {
      return 0.9;
    }
  }

  const bigrams1 = getBigrams(str1);
  const bigrams2 = getBigrams(str2);
  
  if (bigrams1.length === 0 || bigrams2.length === 0) return 0;
  
  const set2 = new Set(bigrams2);
  let intersectionCount = 0;
  for (const b of bigrams1) {
    if (set2.has(b)) {
      intersectionCount++;
    }
  }
  
  return (2.0 * intersectionCount) / (bigrams1.length + bigrams2.length);
}



