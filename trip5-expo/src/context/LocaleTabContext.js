import { createContext } from 'react';

/** Increment to re-render bottom tabs after i18n locale changes (e.g. from Account). */
export const LocaleTabContext = createContext(() => {});
