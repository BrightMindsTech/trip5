import { Config } from '../config';

/**
 * Strip spaces and dashes (matches Swift OrderViewModel cleaning).
 * @param {string} input
 * @returns {string}
 */
export function cleanPhoneInput(input) {
  return String(input || '').replace(/[\s-]/g, '');
}

/**
 * Validation aligned with Trip5 iOS `isValidPhone`.
 * @param {string} input
 * @returns {boolean}
 */
export function isValidJordanPhone(input) {
  const cleaned = cleanPhoneInput(input);
  if (!cleaned) return false;
  if (cleaned.startsWith('+962')) {
    return cleaned.length >= 12;
  }
  if (cleaned.startsWith('962')) {
    return cleaned.length >= 11;
  }
  if (cleaned.startsWith('0')) {
    return cleaned.length >= 9 && cleaned.length <= 10;
  }
  return cleaned.length >= 9 && cleaned.length <= 10;
}

/**
 * Canonical digit string for synthetic auth email (Jordan mobile).
 * @param {string} input
 * @returns {string} e.g. 962790123456, or '' if unusable
 */
export function normalizeJordanPhoneToDigits(input) {
  let cleaned = cleanPhoneInput(input);
  if (!cleaned) return '';
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }
  if (cleaned.startsWith('962')) {
    return cleaned;
  }
  if (cleaned.startsWith('0')) {
    return `962${cleaned.slice(1)}`;
  }
  if (/^7\d{8}$/.test(cleaned)) {
    return `962${cleaned}`;
  }
  return cleaned;
}

/**
 * Human-readable phone for metadata / profiles (E.164 style).
 * @param {string} digits from {@link normalizeJordanPhoneToDigits}
 * @returns {string}
 */
export function formatJordanPhoneDisplay(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (!d) return '';
  return d.startsWith('962') ? `+${d}` : `+962${d}`;
}

/**
 * Supabase email/password identifier for this phone.
 * @param {string} digits from {@link normalizeJordanPhoneToDigits}
 * @returns {string}
 */
export function phoneToSyntheticEmail(digits) {
  const domain = Config.authEmailDomain;
  const d = String(digits || '').replace(/\D/g, '');
  if (!d || !domain) return '';
  return `${d}@${domain}`;
}
