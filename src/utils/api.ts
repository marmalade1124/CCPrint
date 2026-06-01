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

