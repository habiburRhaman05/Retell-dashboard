/** Locales accepted by Retell's `language` field. `flag` is an ISO country
 * code for flagcdn.com (Windows does not render emoji flags). */
export interface LanguageOption {
  value: string;
  label: string;
  region?: string;
  flag: string;
}

export const LANGUAGES: LanguageOption[] = [
  { value: "en-US", label: "English", region: "US", flag: "us" },
  { value: "es-ES", label: "Spanish", region: "Spain", flag: "es" },
  { value: "es-419", label: "Spanish", region: "Latin America", flag: "mx" },
  { value: "en-IN", label: "English", region: "India", flag: "in" },
  { value: "en-GB", label: "English", region: "UK", flag: "gb" },
  { value: "en-AU", label: "English", region: "Australia", flag: "au" },
  { value: "en-NZ", label: "English", region: "New Zealand", flag: "nz" },
  { value: "fr-FR", label: "French", region: "France", flag: "fr" },
  { value: "fr-CA", label: "French", region: "Canada", flag: "ca" },
  { value: "zh-CN", label: "Chinese", region: "China", flag: "cn" },
  { value: "yue-CN", label: "Cantonese", region: "China", flag: "hk" },
  { value: "de-DE", label: "German", region: "Germany", flag: "de" },
  { value: "hi-IN", label: "Hindi", region: "India", flag: "in" },
  { value: "ja-JP", label: "Japanese", region: "Japan", flag: "jp" },
  { value: "ko-KR", label: "Korean", region: "Korea", flag: "kr" },
  { value: "pt-PT", label: "Portuguese", region: "Portugal", flag: "pt" },
  { value: "pt-BR", label: "Portuguese", region: "Brazil", flag: "br" },
  { value: "ru-RU", label: "Russian", region: "Russia", flag: "ru" },
  { value: "it-IT", label: "Italian", region: "Italy", flag: "it" },
  { value: "nl-NL", label: "Dutch", region: "Netherlands", flag: "nl" },
  { value: "nl-BE", label: "Dutch", region: "Belgium", flag: "be" },
  { value: "pl-PL", label: "Polish", region: "Poland", flag: "pl" },
  { value: "tr-TR", label: "Turkish", region: "Turkey", flag: "tr" },
  { value: "vi-VN", label: "Vietnamese", region: "Vietnam", flag: "vn" },
  { value: "ro-RO", label: "Romanian", region: "Romania", flag: "ro" },
  { value: "bg-BG", label: "Bulgarian", region: "Bulgaria", flag: "bg" },
  { value: "ca-ES", label: "Catalan", region: "Spain", flag: "es" },
  { value: "th-TH", label: "Thai", region: "Thailand", flag: "th" },
  { value: "da-DK", label: "Danish", region: "Denmark", flag: "dk" },
  { value: "fi-FI", label: "Finnish", region: "Finland", flag: "fi" },
  { value: "el-GR", label: "Greek", region: "Greece", flag: "gr" },
  { value: "hu-HU", label: "Hungarian", region: "Hungary", flag: "hu" },
  { value: "id-ID", label: "Indonesian", region: "Indonesia", flag: "id" },
  { value: "no-NO", label: "Norwegian", region: "Norway", flag: "no" },
  { value: "sk-SK", label: "Slovak", region: "Slovakia", flag: "sk" },
  { value: "sv-SE", label: "Swedish", region: "Sweden", flag: "se" },
  { value: "lt-LT", label: "Lithuanian", region: "Lithuania", flag: "lt" },
  { value: "lv-LV", label: "Latvian", region: "Latvia", flag: "lv" },
  { value: "cs-CZ", label: "Czech", region: "Czechia", flag: "cz" },
  { value: "ms-MY", label: "Malay", region: "Malaysia", flag: "my" },
  { value: "af-ZA", label: "Afrikaans", region: "South Africa", flag: "za" },
  { value: "ar-SA", label: "Arabic", region: "Saudi Arabia", flag: "sa" },
  { value: "az-AZ", label: "Azerbaijani", region: "Azerbaijan", flag: "az" },
  { value: "bs-BA", label: "Bosnian", region: "Bosnia", flag: "ba" },
  { value: "cy-GB", label: "Welsh", region: "UK", flag: "gb" },
  { value: "fa-IR", label: "Persian", region: "Iran", flag: "ir" },
  { value: "fil-PH", label: "Filipino", region: "Philippines", flag: "ph" },
  { value: "gl-ES", label: "Galician", region: "Spain", flag: "es" },
  { value: "he-IL", label: "Hebrew", region: "Israel", flag: "il" },
  { value: "hr-HR", label: "Croatian", region: "Croatia", flag: "hr" },
  { value: "hy-AM", label: "Armenian", region: "Armenia", flag: "am" },
  { value: "is-IS", label: "Icelandic", region: "Iceland", flag: "is" },
  { value: "kk-KZ", label: "Kazakh", region: "Kazakhstan", flag: "kz" },
  { value: "kn-IN", label: "Kannada", region: "India", flag: "in" },
  { value: "mk-MK", label: "Macedonian", region: "North Macedonia", flag: "mk" },
  { value: "mr-IN", label: "Marathi", region: "India", flag: "in" },
  { value: "ne-NP", label: "Nepali", region: "Nepal", flag: "np" },
  { value: "sl-SI", label: "Slovenian", region: "Slovenia", flag: "si" },
  { value: "sr-RS", label: "Serbian", region: "Serbia", flag: "rs" },
  { value: "sw-KE", label: "Swahili", region: "Kenya", flag: "ke" },
  { value: "ta-IN", label: "Tamil", region: "India", flag: "in" },
  { value: "ur-IN", label: "Urdu", region: "India", flag: "in" },
  { value: "uk-UA", label: "Ukrainian", region: "Ukraine", flag: "ua" },
];

const BY_VALUE = new Map(LANGUAGES.map((l) => [l.value, l]));

export function languageLabel(value: string): string {
  const l = BY_VALUE.get(value);
  if (!l) return value;
  return l.region ? `${l.label} (${l.region})` : l.label;
}

export function languagesLabel(value: string | string[] | null | undefined): string {
  if (!value) return "English (US)";
  if (typeof value === "string") return languageLabel(value);
  if (value.length === 0) return "English (US)";
  if (value.length === 1) return languageLabel(value[0]);
  return `${languageLabel(value[0])} +${value.length - 1}`;
}

export function languageFlag(value: string): string {
  return BY_VALUE.get(value)?.flag ?? "un";
}
