// Language status + t(): The original Chinese text is the key (no additional key namespace is created), if the en dictionary cannot be found, it will fall back to Chinese.
// Never go blank. Switch persistence localStorage('cc.locale'), subscription rerendering (useSyncExternalStore).
// Rules: Use useT() (subscription switching) in React components; pure helper modules can directly import { t }
//  — As long as the component that renders its output calls useT(), it will be recalculated when switching languages.
// LLM interface (systemPrompt/tool ​​description/skill content) and persistent dynamic history tags do not enter i18n.
import { useSyncExternalStore } from 'react';
import { EN } from './dict/en';
import EN_DATA from './dict/en/templates-data';
import { FR } from './dict/fr';
import FR_DATA from './dict/fr/templates-data';
import { ZH_DATA } from './dict/zh';

export type Locale = 'zh' | 'en' | 'fr';

const STORAGE_KEY = 'cc.locale';

/**
 * Language a fresh install opens in, before anyone touches the switch.
 *
 * Baked at build time from VITE_CC_DEFAULT_LOCALE and falling back to 'zh', so
 * an ordinary build is unchanged. A build distributed to people who do not read
 * Chinese has to set it: they never see the language switch, because they cannot
 * read the interface holding it.
 */
const BUILD_DEFAULT_LOCALE: Locale = ((): Locale => {
  const configured = import.meta.env?.VITE_CC_DEFAULT_LOCALE;
  return configured === 'en' || configured === 'fr' || configured === 'zh' ? configured : 'zh';
})();

function readInitial(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'fr' || stored === 'zh') return stored;
    return BUILD_DEFAULT_LOCALE;
  } catch {
    return BUILD_DEFAULT_LOCALE;
  }
}

let current: Locale = readInitial();
const subscribers = new Set<() => void>();

export function getLocale(): Locale {
  return current;
}

export function setLocale(next: Locale): void {
  if (next === current) return;
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch { /* If the private mode cannot be saved, it will only affect this session */ }
  document.documentElement.lang = next === 'zh' ? 'zh-CN' : next;
  subscribers.forEach((notify) => notify());
}

/** t('Selected {n}', { n: 3 }) - The Chinese original text is the key; the placeholder {name} has the same name in both languages. */
export function t(zh: string, params?: Record<string, string | number>): string {
  const raw = current === 'en'
    ? (EN[zh] ?? zh)
    : current === 'fr'
      ? (FR[zh] ?? EN[zh] ?? zh)
      : zh;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? String(params[key]) : match));
}

/** Two-way data localization: **data** names (template names, etc.) are displayed according to the current language in the table lookup. If not found, they are returned as they are.
 * English key data (211 built-in items) zh state walking ZH_DATA; Chinese key data (self-made package) en state walking EN_DATA.
 * It is only used for display and does not change the data itself (the name is also a reference key). */
export function tData(text: string): string {
  if (current === 'zh') return ZH_DATA[text] ?? text;
  if (current === 'fr') return FR_DATA[text] ?? EN_DATA[text] ?? text;
  return EN_DATA[text] ?? text;
}

/** Get t in the component: subscribe to language switching, trigger rerendering of this component when switching. */
export function useT(): typeof t {
  useSyncExternalStore(
    (onChange) => {
      subscribers.add(onChange);
      return () => subscribers.delete(onChange);
    },
    () => current,
  );
  return t;
}
