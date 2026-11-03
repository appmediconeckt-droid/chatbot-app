const fs = require('fs');
const path = require('path');
const axios = require('axios');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const root = path.resolve(__dirname, '..');
const localeDir = path.join(root, 'src', 'i18n', 'locales');
const english = JSON.parse(fs.readFileSync(path.join(localeDir, 'en-US.json'), 'utf8'));

const phraseKey = (value) => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash * 33) ^ value.charCodeAt(index)) >>> 0;
  }
  return `p${hash.toString(36)}`;
};

const pageSources = [
  'src/screens/user/Component/UserDashboard/Tab/HelpSupport/HelpSupport.jsx',
  'src/screens/user/Component/UserDashboard/Tab/PrivacyPolicy/PrivacyPolicy.jsx',
  'src/screens/user/Component/UserDashboard/Tab/UserAccountSettings.jsx',
  'src/screens/user/Component/UserDashboard/Tab/Callls/CallHistory.jsx',
  'src/screens/user/Component/UserDashboard/Tab/Appointment/BookAppointment.jsx',
  'src/screens/user/Component/UserDashboard/Tab/Appointments/Appointments.jsx',
  'src/screens/user/Component/UserDashboard/Tab/chatbot/ChatInterface.jsx',
  'src/screens/user/Component/UserDashboard/Tab/Wallet/WalletDashboard.jsx',
  'src/screens/user/Component/UserDashboard/Tab/Wallet/TransactionsHistory.jsx',
  'src/screens/user/Component/UserDashboard/Dashboard/UserDashboard.jsx',
  'src/components/common/LanguageSelector.jsx',
];

// Whole folders whose screens are shown before sign-in (login, role selector,
// signups, onboarding, password reset, app lock) and the doctor app. Their
// visible text gets built-in translations so a language picked on the login
// screen applies instantly and offline, not only after a live lookup.
// Every app screen now renders through TranslatedText, so the whole source
// tree is scanned: screens outside these folders (token queue, receptionist,
// LED display, ...) otherwise depended on the live lookup, which Google often
// blocks on phones, and stayed English.
const pageDirs = [
  'src',
];
const skippedDirs = new Set(['src/i18n', 'src/assets']);

const walkSources = (relativeDir) => fs.readdirSync(path.join(root, relativeDir), { withFileTypes: true })
  .flatMap((entry) => {
    const rel = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) return skippedDirs.has(rel) || entry.name === '__tests__' ? [] : walkSources(rel);
    return /\.(jsx|js)$/.test(entry.name) && !/\.test\.jsx?$/.test(entry.name) ? [rel] : [];
  });

pageDirs.forEach((dir) => walkSources(dir).forEach((file) => {
  if (!pageSources.includes(file)) pageSources.push(file);
}));

const collectPagePhrases = () => {
  const phrases = new Set([
    'Unknown', 'Today', 'Yesterday', 'Incoming', 'Outgoing', 'Missed',
    'Completed', 'Failed', 'Pending', 'minutes', 'seconds',
  ]);
  const add = (value) => {
    const text = String(value || '').trim().replace(/\s+/g, ' ');
    const isCode =
      /^#[0-9a-f]{3,8}$/i.test(text) || // colors
      /^[a-z0-9]+([-_][a-z0-9]+)+$/.test(text) || // icon names, ids
      /^(https?:|\/|\.\/|\.\.\/)/.test(text) || // urls and paths
      /^[a-z]+[A-Z]\w*$/.test(text); // camelCase identifiers
    if (text.length > 1 && /[A-Za-z]/.test(text) && !isCode && !/^[\w-]+:[\w.-]+$/.test(text)) {
      phrases.add(text);
    }
  };
  const visiblePropertyNames = new Set([
    'label', 'title', 'subtitle', 'sub', 'description', 'desc', 'question',
    'answer', 'collects', 'purpose',
  ]);
  // Props that components render as text (e.g. <Tile label="People ahead" />).
  const visibleJsxProps = new Set([
    'placeholder', 'accessibilityLabel', 'label', 'title', 'subtitle', 'sub',
    'description', 'text', 'message', 'hint', 'caption', 'emptyText', 'buttonText',
  ]);

  pageSources.filter((relativePath) => fs.existsSync(path.join(root, relativePath))).forEach((relativePath) => {
    const ast = parser.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'), {
      sourceType: 'module',
      plugins: ['jsx'],
    });
    // Messages shown in toasts / native dialogs / error lines.
    const addMessageArgs = (args) => args.forEach((arg) => {
      if (arg?.type === 'StringLiteral') add(arg.value);
      if (arg?.type === 'ArrayExpression') {
        arg.elements.forEach((element) => (element?.properties || []).forEach((property) => {
          if ((property.key?.name || property.key?.value) === 'text' && property.value?.type === 'StringLiteral') {
            add(property.value.value);
          }
        }));
      }
    });
    traverse(ast, {
      // Label rows: [['Assigned doctor', profile.assignedDoctorName], ...].
      ArrayExpression(nodePath) {
        const [first] = nodePath.node.elements;
        if (!nodePath.parentPath.isArrayExpression() || first?.type !== 'StringLiteral') return;
        if (/^[A-Z][a-z]/.test(first.value)) add(first.value);
      },
      // Default props: function QueueCard({ title = "Today's Queue" }).
      AssignmentPattern(nodePath) {
        if (visibleJsxProps.has(nodePath.node.left?.name) && nodePath.node.right?.type === 'StringLiteral') {
          add(nodePath.node.right.value);
        }
      },
      NewExpression(nodePath) {
        if (nodePath.node.callee.name === 'Error') addMessageArgs(nodePath.node.arguments.slice(0, 1));
      },
      // <Text>{count} appointments</Text>: TranslatedText joins number and
      // text children and looks them up as "{{n0}} appointments".
      JSXElement(nodePath) {
        const children = nodePath.node.children.filter((child) => !(child.type === 'JSXText' && !child.value.trim()));
        const expressions = children.filter((child) => child.type === 'JSXExpressionContainer' && child.expression.type !== 'JSXEmptyExpression');
        if (!expressions.length || expressions.length > 3) return;
        if (!children.every((child) => child.type === 'JSXText' || child.type === 'JSXExpressionContainer')) return;
        if (!children.some((child) => child.type === 'JSXText')) return;
        let index = 0;
        const template = children
          .map((child) => (child.type === 'JSXText' ? child.value.replace(/\s+/g, ' ') : `{{n${index++}}}`))
          .join('')
          .trim();
        if (template.length <= 80 && /[A-Za-z]{2,}/.test(template.replace(/\{\{n\d+\}\}/g, ''))) add(template);
      },
      CallExpression(nodePath) {
        const { callee } = nodePath.node;
        const calleeName = callee.type === 'MemberExpression'
          ? `${callee.object?.name}.${callee.property?.name}`
          : callee.name;
        if (calleeName === 'Alert.alert' || /^(showToast|setError|setMessage|setNotice|setInfo|setWarning|setHint|setStatusText)$/.test(calleeName || '')) {
          addMessageArgs(nodePath.node.arguments);
        }
        if (nodePath.node.callee.type !== 'Identifier' || nodePath.node.callee.name !== 't') return;
        const argument = nodePath.node.arguments[0];
        if (argument?.type === 'StringLiteral') add(argument.value);
        const fallback = nodePath.node.arguments[1];
        if (fallback?.type === 'StringLiteral') add(fallback.value);
      },
      JSXText(nodePath) {
        add(nodePath.node.value);
      },
      // {cond && 'Not set'} / {value || 'Pending'} rendered as a child.
      StringLiteral(nodePath) {
        // A prop's value (translate="live", style names) is not a child; the
        // JSXAttribute visitor handles the props that render text.
        if (nodePath.parentPath.isJSXAttribute()) return;
        const container = nodePath.findParent((parent) => parent.isJSXExpressionContainer());
        if (!container || !container.parentPath.isJSXElement()) return;
        if (nodePath.findParent((parent) => parent.isFunction() || parent.isCallExpression() || parent === container)?.node !== container.node) return;
        add(nodePath.node.value);
      },
      // `${m} min` -> "{{n0}} min": TranslatedText looks numbers up as the
      // same template, so one entry covers every value.
      TemplateLiteral(nodePath) {
        const { quasis, expressions } = nodePath.node;
        if (!expressions.length || expressions.length > 4) return;
        const raw = quasis.map((quasi) => quasi.value.cooked || '');
        const words = raw.join(' ');
        if (!/[A-Za-z]{2,}/.test(words) || words.length > 120) return;
        // Plain UI words only: drops logs ("[Tag] ..."), ids ("day_"), css,
        // urls and "Label: value" pairs whose value is never a number.
        if (!raw.every((part) => /^[A-Za-z ,.'’·•!?#+–-]*$/.test(part))) return;
        const inCall = nodePath.findParent((parent) => parent.isCallExpression() || parent.isNewExpression() || parent.isThrowStatement());
        if (inCall && !(inCall.isCallExpression() && inCall.node.callee.type === 'Identifier' && inCall.node.callee.name === 't')) {
          const callee = inCall.node.callee;
          const calleeName = callee?.type === 'MemberExpression' ? callee.object?.name : callee?.name;
          if (inCall.isThrowStatement() || inCall.isNewExpression() || ['console', 'Alert', 'navigation', 'navigate', 'Error'].includes(calleeName)) return;
        }
        const template = raw.reduce((text, part, index) => (index ? `${text}{{n${index - 1}}}${part}` : part), '');
        if (/\w[-.]\{\{|\}\}[-.]\w|^Bearer /.test(template)) return; // ids, file names, headers
        add(template);
      },
      // Status / label maps: const DOCTOR_STATUS_LABEL = { paused: 'Paused' }.
      VariableDeclarator(nodePath) {
        // Any SCREAMING_CASE constant too (SOURCES = [['all', 'All records'], ...]).
        const name = nodePath.node.id?.name || '';
        if (!/(LABEL|TEXT|TITLE|MESSAGE|META|STATUS|OPTIONS|TABS|FILTERS|TYPES)/i.test(name) && !/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(name)) return;
        nodePath.traverse({
          StringLiteral(inner) {
            if (inner.parentPath.isObjectProperty() && inner.parentPath.node.key === inner.node) return;
            // Words only — not codes such as blood groups ("B-") or ISO ids ("CL").
            if (/^[A-Z]|\s/.test(inner.node.value) && /[a-z]{2,}/.test(inner.node.value)) add(inner.node.value);
          },
        });
      },
      JSXAttribute(nodePath) {
        if (!visibleJsxProps.has(nodePath.node.name?.name)) return;
        if (nodePath.node.value?.type === 'StringLiteral') add(nodePath.node.value.value);
      },
      ConditionalExpression(nodePath) {
        if (!nodePath.findParent((parent) => parent.isJSXExpressionContainer())) return;
        if (nodePath.node.consequent?.type === 'StringLiteral') add(nodePath.node.consequent.value);
        if (nodePath.node.alternate?.type === 'StringLiteral') add(nodePath.node.alternate.value);
      },
      ObjectProperty(nodePath) {
        const name = nodePath.node.key?.name || nodePath.node.key?.value;
        if (!visiblePropertyNames.has(name)) return;
        const value = nodePath.node.value;
        if (value?.type === 'StringLiteral') add(value.value);
        if (value?.type === 'ArrayExpression') {
          value.elements.forEach((element) => {
            if (element?.type === 'StringLiteral') add(element.value);
          });
        }
      },
    });
  });

  const dictionary = {};
  phrases.forEach((phrase) => {
    const id = phraseKey(phrase);
    if (dictionary[id] && dictionary[id] !== phrase) {
      throw new Error(`Phrase hash collision: ${dictionary[id]} / ${phrase}`);
    }
    dictionary[id] = phrase;
  });
  return dictionary;
};

const collected = collectPagePhrases();
if (process.argv.includes('--dry-run')) {
  const added = Object.keys(collected).filter((id) => !(english.phrases || {})[id]);
  console.log(`${Object.keys(collected).length} phrases found, ${added.length} new`);
  added.forEach((id) => console.log(`  ${collected[id]}`));
  process.exit(0);
}
english.phrases = { ...(english.phrases || {}), ...collected };
fs.writeFileSync(path.join(localeDir, 'en-US.json'), `${JSON.stringify(english, null, 2)}\n`, 'utf8');
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

// "__HUMAELI_3_0__" after the translator wrote the word in its own script.
const TRANSLITERATED_MARKER = /_{1,2}[^_\s]+_\d+_\d+_{0,2}/;
const restoreTransliterated = (value, tokens) => value.replace(
  new RegExp(TRANSLITERATED_MARKER.source, 'g'),
  (marker) => tokens[Number(marker.match(/_(\d+)_{0,2}$/)[1])] ?? marker,
);

const repairProtectedTokens = (locale) => {
  const englishValues = flatten(english);
  Object.entries(flatten(locale)).forEach(([key, value]) => {
    if (typeof value !== 'string' || !value.includes('HUMAELI')) return;
    const tokens = String(englishValues[key] || '').match(/\{\{[^{}]+\}\}|\bHumaeli\b/gi) || [];
    let tokenIndex = 0;
    const repaired = value.replace(/_*HUMAELI_*\d+_*\d+_*/g, () => tokens[tokenIndex++] || 'Humaeli');
    setAtPath(locale, key, repaired);
  });
  // Markers the translator transliterated ("__हुमैली_3_0__"): put the English
  // token back by its index.
  Object.entries(flatten(locale)).forEach(([key, value]) => {
    if (typeof value !== 'string' || !TRANSLITERATED_MARKER.test(value)) return;
    const tokens = String(englishValues[key] || '').match(/\{\{[^{}]+\}\}|\bHumaeli\b/gi) || [];
    setAtPath(locale, key, restoreTransliterated(value, tokens));
  });
};

const protect = (text, row) => {
  const tokens = [];
  const safeText = text.replace(/\{\{[^{}]+\}\}|\bHumaeli\b/gi, (token) => {
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
    const restored = rows.map((text, index) => restoreTransliterated(
      protectedRows[index].tokens.reduce(
        (value, [marker, token]) => value.replace(marker, token),
        text,
      ),
      protectedRows[index].tokens.map(([, token]) => token),
    ));
    // A row whose {{n0}} / Humaeli tokens came back mangled is translated again
    // with numbers in their place, else left in English — never shown broken.
    for (let index = 0; index < restored.length; index += 1) {
      if (tokensIntact(texts[index], restored[index])) continue;
      restored[index] = await translateWithNumbers(texts[index], localeCode).catch(() => null) || texts[index];
    }
    return restored;
  } catch (error) {
    if (retry < 3) {
      await wait(600 * (2 ** retry));
      return translateBatch(texts, localeCode, retry + 1);
    }
    throw error;
  }
};

const TOKEN_PATTERN = /\{\{[^{}]+\}\}|\bHumaeli\b/gi;
const tokenSet = (text) => (String(text).match(TOKEN_PATTERN) || []).sort().join('|');
// Same tokens as the English text and no translator marker left behind.
const tokensIntact = (english, translated) =>
  typeof translated === 'string' && tokenSet(english) === tokenSet(translated)
  && (!/HUMAELI_|_\d+_\d+_/.test(translated) || /_\d+_\d+_/.test(english));

// Translators keep plain numbers (sometimes in the script's own digits), so
// tokens travel as 731, 842, ... and are swapped back afterwards.
const NUMBER_STANDINS = ['731', '842', '953', '664', '575', '486'];
const DIGIT_ZEROS = [0x0660, 0x06F0, 0x0966, 0x09E6, 0x0A66, 0x0AE6, 0x0B66, 0x0BE6, 0x0C66, 0x0CE6, 0x0D66, 0x0DE6, 0x0E50, 0x0ED0, 0x1040, 0x17E0];
const asciiDigits = (text) => text.replace(/\p{Nd}/gu, (digit) => {
  const code = digit.codePointAt(0);
  const zero = DIGIT_ZEROS.find((start) => code >= start && code <= start + 9);
  return zero != null ? String(code - zero) : digit;
});
const translateWithNumbers = async (text, localeCode) => {
  const tokens = text.match(TOKEN_PATTERN) || [];
  if (!tokens.length || tokens.length > NUMBER_STANDINS.length || /\b(731|842|953|664|575|486)\b/.test(text)) return null;
  let index = 0;
  const query = text.replace(TOKEN_PATTERN, () => NUMBER_STANDINS[index++]);
  const target = targetCodes[localeCode] || localeCode.split('-')[0];
  const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=en&tl=${encodeURIComponent(target)}&q=${encodeURIComponent(query)}`;
  const { data } = await axios.get(url, { timeout: 20000 });
  let translated = typeof data === 'string' ? data : Array.isArray(data) && typeof data[0] === 'string' ? data[0] : '';
  if (!translated) return null;
  translated = asciiDigits(translated);
  tokens.forEach((token, position) => {
    translated = translated.replace(new RegExp(`(?<!\\d)${NUMBER_STANDINS[position]}(?!\\d)`), token);
  });
  return tokensIntact(text, translated) ? translated : null;
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
    .filter(([key, text]) => getAtPath(locale, key) == null || getAtPath(locale, key) === text
      // and earlier translations whose {{n0}} / Humaeli tokens were mangled
      || (!localeCode.startsWith('en-') && !tokensIntact(text, getAtPath(locale, key))))
    .map(([key, text]) => ({ key, text }));

  if (localeCode.startsWith('en-')) {
    entries.forEach(({ key, text }) => setAtPath(locale, key, text));
    fs.writeFileSync(localePath, `${JSON.stringify(locale, null, 2)}\n`, 'utf8');
    console.log(`${localeCode}: ${entries.length} English values completed`);
    return;
  }

  // A blocked batch is left untranslated (and retried by the next run) instead
  // of failing every other locale.
  let failed = 0;
  for (const batch of makeBatches(entries)) {
    try {
      const translations = await translateBatch(batch.map(({ text }) => text), localeCode);
      translations.forEach((translation, index) => {
        setAtPath(locale, batch[index].key, translation || batch[index].text);
      });
    } catch (error) {
      failed += batch.length;
      console.warn(`${localeCode}: batch skipped (${error.message})`);
    }
    await wait(100);
  }
  fs.writeFileSync(localePath, `${JSON.stringify(locale, null, 2)}\n`, 'utf8');
  console.log(`${localeCode}: ${entries.length - failed}/${entries.length} values completed`);
};

const run = async () => {
  // --only=hi-IN,ta-IN completes just those locales (English ones always run).
  const only = (process.argv.find((arg) => arg.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
  let queue = [...localeCodes];
  if (process.argv.includes('--english-only')) queue = localeCodes.filter((code) => code.startsWith('en-'));
  else if (only.length) queue = localeCodes.filter((code) => code.startsWith('en-') || only.includes(code));
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (queue.length) await completeLocale(queue.shift());
  }));
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
