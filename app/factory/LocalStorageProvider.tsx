import { useEffect, useState } from "react";

let localStorage: Storage;
if (typeof window === 'undefined') {
  localStorage = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getItem: (_: string) => null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setItem: (_: string, __: unknown) => { },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    removeItem: (_: string) => { },
  } as Storage;
} else {
  localStorage = window.localStorage;
}

export type LocalStorageProvider<T> = {
  settings: T;
  updateSettings: (updates: Partial<T>) => void;
  resetSettings: () => void;
};

export const LocalStorageProvider = <T,>(LOCAL_STORAGE_KEY: string, DEFAULT_SETTINGS: T): LocalStorageProvider<T> => {
    const [settings, setSettings] = useState<T>(() => {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
    });
  
    useEffect(() => {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
    }, [settings]);
  
    const updateSettings = (updates: Partial<T>) => {
      setSettings((prev) => ({ ...prev, ...updates }));
    };
  
    const resetSettings = () => {
      setSettings(DEFAULT_SETTINGS);
    };

    return {settings, updateSettings, resetSettings};
  
};

