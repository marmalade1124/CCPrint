import { create } from 'zustand';
import type { AppNotification } from '../types';
import { getDb } from '../lib/database';
import { isTauri } from '../utils/api';

const saveToLocal = (notifications: AppNotification[]) => {
  try {
    localStorage.setItem('printflow_notifications', JSON.stringify(notifications));
  } catch (e) {
    console.error("Failed to save notifications to localStorage:", e);
  }
};

interface NotificationStore {
  notifications: AppNotification[];
  init: () => Promise<void>;
  addNotification: (
    message: string,
    type?: AppNotification['type'],
    actionType?: AppNotification['actionType'],
    actionPayload?: string
  ) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearAll: () => Promise<void>;
  getUnreadCount: () => number;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],

  init: async () => {
    let notifications: AppNotification[] = [];
    let loaded = false;

    if (isTauri()) {
      try {
        const db = await getDb();
        const rows = await db.select<any[]>(
          "SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100"
        );
        notifications = rows.map((r) => ({
          id: r.id,
          message: r.message,
          type: r.type,
          read: r.read === 1,
          createdAt: r.created_at,
          actionType: r.action_type || undefined,
          actionPayload: r.action_payload || undefined,
        }));
        if (notifications.length > 0) {
          loaded = true;
        }
      } catch (e) {
        console.error("Failed to initialize NotificationStore from SQLite, falling back to localStorage:", e);
      }
    }

    if (!loaded) {
      try {
        const stored = localStorage.getItem('printflow_notifications');
        if (stored) {
          notifications = JSON.parse(stored);

          if (isTauri() && notifications.length > 0) {
            try {
              const db = await getDb();
              for (const n of notifications) {
                await db.execute(
                  "INSERT INTO notifications (id, message, type, read, created_at, action_type, action_payload) VALUES ($1, $2, $3, $4, $5, $6, $7)",
                  [
                    n.id,
                    n.message,
                    n.type,
                    n.read ? 1 : 0,
                    n.createdAt,
                    n.actionType || null,
                    n.actionPayload || null,
                  ]
                );
              }
            } catch (sqle) {
              console.error("Failed to sync loaded localStorage notifications to SQLite:", sqle);
            }
          }
        }
      } catch (e) {
        console.error("Failed to load notifications from localStorage:", e);
      }
    }

    set({ notifications });
  },

  addNotification: async (message, type = 'info', actionType, actionPayload) => {
    const notification: AppNotification = {
      id: 'notif-' + Math.random().toString(36).substring(2, 9),
      message,
      type,
      read: false,
      createdAt: new Date().toISOString(),
      actionType,
      actionPayload,
    };

    set((state) => {
      const nextNotifications = [notification, ...state.notifications].slice(0, 100);
      saveToLocal(nextNotifications);
      return {
        notifications: nextNotifications,
      };
    });

    if (isTauri()) {
      try {
        const db = await getDb();
        await db.execute(
          "INSERT INTO notifications (id, message, type, read, created_at, action_type, action_payload) VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [
            notification.id,
            notification.message,
            notification.type,
            0,
            notification.createdAt,
            notification.actionType || null,
            notification.actionPayload || null,
          ]
        );
      } catch (e) {
        console.error("Failed to add notification in SQLite:", e);
      }
    }
  },

  markRead: async (id) => {
    set((state) => {
      const nextNotifications = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      saveToLocal(nextNotifications);
      return { notifications: nextNotifications };
    });
    if (isTauri()) {
      try {
        const db = await getDb();
        await db.execute("UPDATE notifications SET read = 1 WHERE id = $1", [id]);
      } catch (e) {
        console.error("Failed to mark notification read in SQLite:", e);
      }
    }
  },

  markAllRead: async () => {
    set((state) => {
      const nextNotifications = state.notifications.map((n) => ({ ...n, read: true }));
      saveToLocal(nextNotifications);
      return { notifications: nextNotifications };
    });
    if (isTauri()) {
      try {
        const db = await getDb();
        await db.execute("UPDATE notifications SET read = 1");
      } catch (e) {
        console.error("Failed to mark all notifications read in SQLite:", e);
      }
    }
  },

  clearAll: async () => {
    set({ notifications: [] });
    saveToLocal([]);
    if (isTauri()) {
      try {
        const db = await getDb();
        await db.execute("DELETE FROM notifications");
      } catch (e) {
        console.error("Failed to clear notifications in SQLite:", e);
      }
    }
  },

  getUnreadCount: () => get().notifications.filter((n) => !n.read).length,
}));

