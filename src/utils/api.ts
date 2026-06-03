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


