const fs = require('fs');
const path = require('path');
const axios = require('axios');

const root = path.resolve(__dirname, '..');
const localeDir = path.join(root, 'src', 'i18n', 'locales');
const english = JSON.parse(fs.readFileSync(path.join(localeDir, 'en-US.json'), 'utf8'));
const indexSource = fs.readFileSync(path.join(root, 'src', 'i18n', 'index.js'), 'utf8');
const languageSection = indexSource.slice(
  indexSource.indexOf('export const LANGUAGES = ['),
  indexSource.indexOf('export const LEGACY_LANGUAGES'),
);
const localeCodes = [...languageSection.matchAll(/code: '([^']+)'/g)]
  .map((match) => match[1]);

const targetCodes = {
  'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW', 'pt-BR': 'pt', 'pt-PT': 'pt-PT',
  'no-NO': 'no', 'fil-PH': 'tl', 'he-IL': 'iw',
};

const flatten = (object, prefix = '', result = {}) => {
  Object.entries(object).forEach(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, fullKey, result);
    } else {
      result[fullKey] = value;
    }
  });
  return result;
};

const getAtPath = (object, dottedPath) =>
  dottedPath.split('.').reduce((value, key) => value?.[key], object);

const setAtPath = (object, dottedPath, value) => {
  const parts = dottedPath.split('.');
  const leaf = parts.pop();
  const parent = parts.reduce((current, key) => {
    if (!current[key] || typeof current[key] !== 'object') current[key] = {};
    return current[key];
  }, object);
  parent[leaf] = value;
};

const repairProtectedTokens = (locale) => {
  const englishValues = flatten(english);
  Object.entries(flatten(locale)).forEach(([key, value]) => {
    if (typeof value !== 'string' || !value.includes('HUMAELI')) return;
    const tokens = String(englishValues[key] || '').match(/\{\{[^{}]+\}\}|\bHumaeli\b/g) || [];
    let tokenIndex = 0;
    const repaired = value.replace(/_*HUMAELI_*\d+_*\d+_*/g, () => tokens[tokenIndex++] || 'Humaeli');
    setAtPath(locale, key, repaired);
  });
};

const protect = (text, row) => {
  const tokens = [];
  const safeText = text.replace(/\{\{[^{}]+\}\}|\bHumaeli\b/g, (token) => {
    const marker = `__HUMAELI_${row}_${tokens.length}__`;
    tokens.push([marker, token]);
    return marker;
  });
  return { safeText, tokens };
};

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const translateBatch = async (texts, localeCode, retry = 0) => {
  const protectedRows = texts.map(protect);
  const query = protectedRows.map(({ safeText }) => safeText).join('\n');
  const target = targetCodes[localeCode] || localeCode.split('-')[0];
  const encodedTarget = encodeURIComponent(target);
  const encodedQuery = encodeURIComponent(query);
  const urls = [
    `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=${encodedTarget}&q=${encodedQuery}`,
    `https://translate.google.com/translate_a/single?client=at&dt=t&sl=en&tl=${encodedTarget}&q=${encodedQuery}`,
  ];

  try {
    let translated = '';
    let lastError;
    for (const url of urls) {
      try {
        const response = await axios.get(url, { timeout: 20000 });
        const payload = response.data;
        if (typeof payload === 'string') translated = payload;
        else if (Array.isArray(payload) && typeof payload[0] === 'string') translated = payload[0];
        else if (Array.isArray(payload?.[0])) {
          translated = payload[0].map((segment) => segment?.[0] || '').join('');
        }
        if (translated) break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!translated && lastError) throw lastError;

    const rows = translated.split('\n');
    if (rows.length !== texts.length) {
      throw new Error(`Expected ${texts.length} rows, received ${rows.length}`);
    }
    return rows.map((text, index) =>
      protectedRows[index].tokens.reduce(
        (value, [marker, token]) => value.replace(marker, token),
        text,
      ),
    );
  } catch (error) {
    if (retry < 3) {
      await wait(600 * (2 ** retry));
      return translateBatch(texts, localeCode, retry + 1);
    }
    throw error;
  }
};

const makeBatches = (entries) => {
  const batches = [];
  let batch = [];
  let characters = 0;
  entries.forEach((entry) => {
    const length = entry.text.length + 1;
    if (batch.length && (batch.length >= 16 || characters + length > 2600)) {
      batches.push(batch);
      batch = [];
      characters = 0;
    }
    batch.push(entry);
    characters += length;
  });
  if (batch.length) batches.push(batch);
  return batches;
};

const completeLocale = async (localeCode) => {
  const localePath = path.join(localeDir, `${localeCode}.json`);
  const locale = JSON.parse(fs.readFileSync(localePath, 'utf8'));
  repairProtectedTokens(locale);
  const entries = Object.entries(flatten(english))
    .filter(([, text]) => typeof text === 'string' && /[A-Za-z]/.test(text))
    .filter(([key, text]) => getAtPath(locale, key) == null || getAtPath(locale, key) === text)
    .map(([key, text]) => ({ key, text }));

  if (localeCode.startsWith('en-')) {
    entries.forEach(({ key, text }) => setAtPath(locale, key, text));
    fs.writeFileSync(localePath, `${JSON.stringify(locale, null, 2)}\n`, 'utf8');
    console.log(`${localeCode}: ${entries.length} English values completed`);
    return;
  }

  for (const batch of makeBatches(entries)) {
    const translations = await translateBatch(batch.map(({ text }) => text), localeCode);
    translations.forEach((translation, index) => {
      setAtPath(locale, batch[index].key, translation || batch[index].text);
    });
    await wait(100);
  }
  fs.writeFileSync(localePath, `${JSON.stringify(locale, null, 2)}\n`, 'utf8');
  console.log(`${localeCode}: ${entries.length} values completed`);
};

const run = async () => {
  const queue = process.argv.includes('--english-only')
    ? localeCodes.filter((code) => code.startsWith('en-'))
    : [...localeCodes];
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (queue.length) await completeLocale(queue.shift());
  }));
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
