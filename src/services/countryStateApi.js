
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COUNTRY_OPTIONS, findCountry } from '../utils/consultationCurrency';

const API_BASE = 'https://countriesnow.space/api/v0.1/countries';
const API_URL = `${API_BASE}/states`;
const CACHE_KEY = 'countryStates:v1';
const CITY_CACHE_PREFIX = 'countryCities:v1:';
const CACHE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT = 20000;


const MERGED_STATES = {
  IN: { 'Dadra and Nagar Haveli and Daman and Diu': ['Dadra and Nagar Haveli', 'Daman and Diu'] },
};
const STATE_FIXES = {
  IN: (states) => {
    const [merged, parts] = Object.entries(MERGED_STATES.IN)[0];
    const rest = states.filter((name) => !parts.includes(name));
    return rest.length === states.length ? states : [...rest, merged];
  },
};

// Case-insensitive A–Z sort. Not localeCompare: on Android's Hermes every
// localeCompare call goes through Intl and sorting the ~5,000 states took
// minutes, leaving the dropdowns stuck on "Loading".
const sortByName = (items, nameOf = (item) => item) => items
  .map((item) => [nameOf(item).toLowerCase(), item])
  .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  .map(([, item]) => item);

// [{ code, name, states: [name] }] sorted by name: the API's countries under the
// backend's names (matched by ISO code), plus the backend's countries the API
// lacks (no states).
const buildCountries = (apiRows = []) => {
  const seen = new Set();
  const countries = [];
  apiRows.forEach((row) => {
    const code = String(row?.iso2 || '').trim().toUpperCase();
    // Only countries the backend knows (drops Antarctica, Netherlands Antilles).
    const known = code && findCountry(code);
    if (!known || seen.has(code)) return;
    seen.add(code);
    let states = [...new Set((row.states || []).map((s) => String(s?.name || '').trim()).filter(Boolean))];
    if (STATE_FIXES[code]) states = STATE_FIXES[code](states);
    // apiName: the API's own spelling, needed to ask it for cities.
    countries.push({ code, name: known.name, apiName: String(row.name || '').trim(), states: sortByName(states) });
  });
  COUNTRY_OPTIONS.forEach(({ code, name }) => {
    if (!seen.has(code)) countries.push({ code, name, states: [] });
  });
  return sortByName(countries, (c) => c.name);
};

const FALLBACK_COUNTRIES = buildCountries();

let memory = null; // { countries, fromApi }
let inflight = null;

const getJson = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const body = await res.json();
    if (!res.ok || body?.error || !Array.isArray(body?.data)) {
      throw new Error(body?.msg || 'Could not load the list');
    }
    return body.data;
  } finally {
    clearTimeout(timer);
  }
};

const fetchFromApi = async () => {
  const data = await getJson(API_URL);
  if (!data.length) throw new Error('Could not load countries');
  return data;
};

const readCache = async () => {
  try {
    const cached = JSON.parse((await AsyncStorage.getItem(CACHE_KEY)) || 'null');
    return Array.isArray(cached?.data) && cached.data.length ? cached : null;
  } catch {
    return null;
  }
};

// Resolves to { countries, fromApi }; never rejects.
export const loadCountryStates = ({ force = false } = {}) => {
  if (memory?.fromApi && !force) return Promise.resolve(memory);
  if (inflight) return inflight;
  inflight = (async () => {
    const cached = await readCache();
    if (cached && !force && Date.now() - cached.savedAt < CACHE_MAX_AGE) {
      memory = { countries: buildCountries(cached.data), fromApi: true };
      return memory;
    }
    try {
      const data = await fetchFromApi();
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data })).catch(() => {});
      memory = { countries: buildCountries(data), fromApi: true };
    } catch {
      memory = cached
        ? { countries: buildCountries(cached.data), fromApi: true }
        : { countries: FALLBACK_COUNTRIES, fromApi: false };
    }
    return memory;
  })().catch(() => {
    // Never leave the dropdowns loading: fall back to the offline list.
    memory = memory || { countries: FALLBACK_COUNTRIES, fromApi: false };
    return memory;
  }).finally(() => {
    inflight = null;
  });
  return inflight;
};

// The country for a saved value (name in any case, alias or ISO code), or null.
export const findCountryOption = (countries, value) => {
  const text = String(value || '').trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  const code = findCountry(text)?.code;
  return countries.find((c) => c.name.toLowerCase() === lower || (code && c.code === code)) || null;
};

// The saved state as spelled in the list ('' when it isn't one of them).
export const findStateOption = (country, value) => {
  const lower = String(value || '').trim().toLowerCase();
  return (lower && country?.states.find((name) => name.toLowerCase() === lower)) || '';
};

const cityMemory = new Map(); // key → [city]
const NO_CITIES = [];
const cityInflight = new Map();

// The cities of a state ([] when the API has none). Resolves to
// { cities, ok }; `ok` is false when they couldn't be loaded. Never rejects.
export const loadCities = (country, state) => {
  const stateName = String(state || '').trim();
  if (!country?.apiName || !stateName) return Promise.resolve({ cities: [], ok: true });
  const key = `${country.code}|${stateName.toLowerCase()}`;
  if (cityMemory.has(key)) return Promise.resolve({ cities: cityMemory.get(key), ok: true });
  if (cityInflight.has(key)) return cityInflight.get(key);
  const request = (async () => {
    const cacheKey = CITY_CACHE_PREFIX + key;
    let cached = null;
    try {
      cached = JSON.parse((await AsyncStorage.getItem(cacheKey)) || 'null');
    } catch { /* fetch instead */ }
    if (Array.isArray(cached?.cities) && Date.now() - cached.savedAt < CACHE_MAX_AGE) {
      cityMemory.set(key, cached.cities);
      return { cities: cached.cities, ok: true };
    }
    try {
      const names = MERGED_STATES[country.code]?.[stateName] || [stateName];
      const lists = await Promise.all(names.map((name) => getJson(
        `${API_BASE}/state/cities/q?country=${encodeURIComponent(country.apiName)}&state=${encodeURIComponent(name)}`,
      )));
      const cities = sortByName([...new Set(lists.flat().map((c) => String(c || '').trim()).filter(Boolean))]);
      cityMemory.set(key, cities);
      AsyncStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), cities })).catch(() => {});
      return { cities, ok: true };
    } catch {
      return cached?.cities ? { cities: cached.cities, ok: true } : { cities: [], ok: false };
    }
  })().finally(() => {
    cityInflight.delete(key);
  });
  cityInflight.set(key, request);
  return request;
};

// { cities, ok, loading } for a country option and state name.
export function useCities(country, state) {
  const key = country?.apiName && String(state || '').trim()
    ? `${country.code}|${String(state).trim().toLowerCase()}`
    : '';
  const [result, setResult] = useState({ key: '', cities: NO_CITIES, ok: true });

  useEffect(() => {
    let alive = true;
    if (!key) return undefined;
    loadCities(country, state).then((next) => {
      if (alive) setResult({ key, ...next });
    });
    return () => {
      alive = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!key) return { cities: NO_CITIES, ok: true, loading: false };
  if (result.key !== key) return { cities: cityMemory.get(key) || NO_CITIES, ok: true, loading: !cityMemory.has(key) };
  return { cities: result.cities, ok: result.ok, loading: false };
}

export function useCountryStates() {
  const [state, setState] = useState(() => ({
    countries: memory?.countries || FALLBACK_COUNTRIES,
    fromApi: Boolean(memory?.fromApi),
    loading: !memory?.fromApi,
  }));

  const load = useCallback((options) => {
    setState((prev) => ({ ...prev, loading: true }));
    return loadCountryStates(options).then((result) => {
      setState({ ...result, loading: false });
      return result;
    });
  }, []);

  useEffect(() => {
    let alive = true;
    if (memory?.fromApi) return undefined;
    loadCountryStates().then((result) => {
      if (alive) setState({ ...result, loading: false });
    });
    return () => {
      alive = false;
    };
  }, []);

  return { ...state, retry: () => load({ force: true }) };
}
