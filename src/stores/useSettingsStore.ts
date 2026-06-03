import { create } from 'zustand';
import type { QuotingVariables } from '../components/QuotingEngine';
import { getDb } from '../lib/database';
import { isTauri } from '../utils/api';

interface SettingsStore {
  pricingVars: QuotingVariables;
  shopName: string;
  init: () => Promise<void>;
  updatePricingVars: (vars: Partial<QuotingVariables>) => Promise<void>;
  updateShopName: (name: string) => Promise<void>;
}

let initPromise: Promise<void> | null = null;

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  pricingVars: {
    pricePerGram: 3.0,
    pricePerHour: 50.0,
    serviceFeePercent: 5.0,
    flatMarkup: 0.0,
    currencySymbol: '₱',
  },
  shopName: 'CCprint Shop',

  init: () => {
    if (!initPromise) {
      initPromise = (async () => {
        let pricingVars: QuotingVariables = {
      pricePerGram: 3.0,
      pricePerHour: 50.0,
      serviceFeePercent: 5.0,
      flatMarkup: 0.0,
      currencySymbol: '₱',
    };
    let shopName = 'CCprint Shop';
    let loaded = false;

    if (isTauri()) {
      try {
        const db = await getDb();
        const pricingRes = await db.select<{ value: string }[]>(
          "SELECT value FROM settings WHERE key = $1",
          ["pricingVars"]
        );
        const shopRes = await db.select<{ value: string }[]>(
          "SELECT value FROM settings WHERE key = $1",
          ["shopName"]
        );

        if (pricingRes.length > 0) {
          pricingVars = JSON.parse(pricingRes[0].value);
          loaded = true;
        }
        if (shopRes.length > 0) {
          shopName = shopRes[0].value;
          loaded = true;
        }
      } catch (e) {
        console.error("Failed to initialize SettingsStore from SQLite, falling back to localStorage:", e);
      }
    }

    if (!loaded) {
      try {
        const storedVars = localStorage.getItem('printflow_vars');
        if (storedVars) {
          pricingVars = JSON.parse(storedVars);
        }
        const storedShop = localStorage.getItem('printflow_shop_name');
        if (storedShop) {
          shopName = storedShop;
        }

        if (isTauri()) {
          try {
            const db = await getDb();
            await db.execute(
              "INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)",
              ["pricingVars", JSON.stringify(pricingVars)]
            );
            await db.execute(
              "INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)",
              ["shopName", shopName]
            );
          } catch (sqle) {
            console.error("Failed to sync settings from localStorage to SQLite:", sqle);
          }
        }
      } catch (e) {
        console.error("Failed to load settings from localStorage:", e);
      }
    }

        set({ pricingVars, shopName });
      })();
    }
    return initPromise;
  },

  updatePricingVars: async (vars) => {
    const nextVars = { ...get().pricingVars, ...vars };
    set({ pricingVars: nextVars });
    try {
      localStorage.setItem('printflow_vars', JSON.stringify(nextVars));
    } catch (e) {
      console.error("Failed to save pricingVars to localStorage:", e);
    }
    if (isTauri()) {
      try {
        const db = await getDb();
        await db.execute(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)",
          ["pricingVars", JSON.stringify(nextVars)]
        );
      } catch (e) {
        console.error("Failed to save pricingVars to SQLite:", e);
      }
    }
  },

  updateShopName: async (name) => {
    set({ shopName: name });
    try {
      localStorage.setItem('printflow_shop_name', name);
    } catch (e) {
      console.error("Failed to save shopName to localStorage:", e);
    }
    if (isTauri()) {
      try {
        const db = await getDb();
        await db.execute(
          "INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)",
          ["shopName", name]
        );
      } catch (e) {
        console.error("Failed to save shopName to SQLite:", e);
      }
    }
  },
}));

