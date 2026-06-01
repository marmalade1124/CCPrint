import React from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';

interface ReconnectionBannerProps {
  isConnected: boolean;
  reconnectAttempt: number;
}

export default function ReconnectionBanner({ isConnected, reconnectAttempt }: ReconnectionBannerProps) {
  if (isConnected) return null;

  const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 30000) / 1000;

  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 flex items-center justify-center gap-3 text-xs font-bold shadow-lg animate-slideIn">
      <WifiOff className="w-4 h-4 animate-pulse" />
      <span>Backend disconnected. Reconnecting in {delay}s... (attempt {reconnectAttempt + 1})</span>
      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
    </div>
  );
}
