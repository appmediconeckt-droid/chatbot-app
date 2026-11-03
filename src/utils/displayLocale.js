import i18next from 'i18next';

// The locale on-screen dates and times are written in: the app language, so
// a date reads "14 अक्टू॰ 2026" in Hindi. English keeps the screen's own
// format (`english`, e.g. 'en-US' or 'en-IN'), or null to tell the caller to
// use its own English format. Printed documents keep their English dates.
export const displayLocale = (english = 'en-IN') => {
  const lang = i18next.language;
  return lang && !/^en(-|$)/.test(lang) ? lang : english;
};

export default displayLocale;
