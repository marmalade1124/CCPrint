import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, Trash2, X } from 'lucide-react';
import { useNotificationStore } from '../stores/useNotificationStore';

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { notifications, markRead, markAllRead, clearAll } = useNotificationStore();
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const getTimeAgo = (isoDate: string) => {
    const diff = Date.now() - new Date(isoDate).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const typeStyles: Record<string, string> = {
    success: 'border-l-emerald-500 bg-emerald-50/50',
    error: 'border-l-red-500 bg-red-50/50',
    warning: 'border-l-amber-500 bg-amber-50/50',
    info: 'border-l-blue-500 bg-blue-50/50',
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <Bell className="w-5 h-5 text-slate-500" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden animate-slideIn">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-800">Notifications</h4>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[10px] text-brand-orange font-bold hover:underline"
                >
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                  title="Clear all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No notifications yet
              </div>
            ) : (
              notifications.slice(0, 30).map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => markRead(notif.id)}
                  className={`px-4 py-3 border-l-2 cursor-pointer hover:bg-slate-50 transition-colors ${
                    typeStyles[notif.type] || typeStyles.info
                  } ${!notif.read ? 'bg-opacity-100' : 'bg-opacity-30 opacity-60'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-slate-700 font-medium leading-relaxed flex-1">{notif.message}</p>
                    {!notif.read && (
                      <span className="w-2 h-2 bg-brand-orange rounded-full shrink-0 mt-1" />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold mt-1 block">
                    {getTimeAgo(notif.createdAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
