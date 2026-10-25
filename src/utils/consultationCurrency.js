// Consultation fee currency. The backend (utils/consultationCurrency.js) sets a
// doctor's fee currency from their profile country and rejects any other, so
// the app picks a country and shows the currency that comes with it. Same
// country → currency data as the backend (Unicode CLDR 48).

// [ISO code, name, currency]
const COUNTRY_ROWS = [
  ['AF', 'Afghanistan', 'AFN'],
  ['AX', 'Åland Islands', 'EUR'],
  ['AL', 'Albania', 'ALL'],
  ['DZ', 'Algeria', 'DZD'],
  ['AS', 'American Samoa', 'USD'],
  ['AD', 'Andorra', 'EUR'],
  ['AO', 'Angola', 'AOA'],
  ['AI', 'Anguilla', 'XCD'],
  ['AG', 'Antigua and Barbuda', 'XCD'],
  ['AR', 'Argentina', 'ARS'],
  ['AM', 'Armenia', 'AMD'],
  ['AW', 'Aruba', 'AWG'],
  ['AC', 'Ascension Island', 'SHP'],
  ['AU', 'Australia', 'AUD'],
  ['AT', 'Austria', 'EUR'],
  ['AZ', 'Azerbaijan', 'AZN'],
  ['BS', 'Bahamas', 'BSD'],
  ['BH', 'Bahrain', 'BHD'],
  ['BD', 'Bangladesh', 'BDT'],
  ['BB', 'Barbados', 'BBD'],
  ['BY', 'Belarus', 'BYN'],
  ['BE', 'Belgium', 'EUR'],
  ['BZ', 'Belize', 'BZD'],
  ['BJ', 'Benin', 'XOF'],
  ['BM', 'Bermuda', 'BMD'],
  ['BT', 'Bhutan', 'BTN'],
  ['BO', 'Bolivia', 'BOB'],
  ['BA', 'Bosnia and Herzegovina', 'BAM'],
  ['BW', 'Botswana', 'BWP'],
  ['BV', 'Bouvet Island', 'NOK'],
  ['BR', 'Brazil', 'BRL'],
  ['IO', 'British Indian Ocean Territory', 'USD'],
  ['VG', 'British Virgin Islands', 'USD'],
  ['BN', 'Brunei', 'BND'],
  ['BG', 'Bulgaria', 'EUR'],
  ['BF', 'Burkina Faso', 'XOF'],
  ['BI', 'Burundi', 'BIF'],
  ['CV', 'Cabo Verde', 'CVE'],
  ['KH', 'Cambodia', 'KHR'],
  ['CM', 'Cameroon', 'XAF'],
  ['CA', 'Canada', 'CAD'],
  ['IC', 'Canary Islands', 'EUR'],
  ['BQ', 'Caribbean Netherlands', 'USD'],
  ['KY', 'Cayman Islands', 'KYD'],
  ['CF', 'Central African Republic', 'XAF'],
  ['EA', 'Ceuta & Melilla', 'EUR'],
  ['TD', 'Chad', 'XAF'],
  ['CL', 'Chile', 'CLP'],
  ['CN', 'China', 'CNY'],
  ['CX', 'Christmas Island', 'AUD'],
  ['CC', 'Cocos (Keeling) Islands', 'AUD'],
  ['CO', 'Colombia', 'COP'],
  ['KM', 'Comoros', 'KMF'],
  ['CG', 'Congo', 'XAF'],
  ['CD', 'Congo - Kinshasa', 'CDF'],
  ['CK', 'Cook Islands', 'NZD'],
  ['CR', 'Costa Rica', 'CRC'],
  ['CI', 'Cote D\x27ivoire', 'XOF'],
  ['HR', 'Croatia', 'EUR'],
  ['CU', 'Cuba', 'CUP'],
  ['CW', 'Curaçao', 'XCG'],
  ['CY', 'Cyprus', 'EUR'],
  ['CZ', 'Czechia', 'CZK'],
  ['DK', 'Denmark', 'DKK'],
  ['DG', 'Diego Garcia', 'USD'],
  ['DJ', 'Djibouti', 'DJF'],
  ['DM', 'Dominica', 'XCD'],
  ['DO', 'Dominican Republic', 'DOP'],
  ['EC', 'Ecuador', 'USD'],
  ['EG', 'Egypt', 'EGP'],
  ['SV', 'El Salvador', 'USD'],
  ['GQ', 'Equatorial Guinea', 'XAF'],
  ['ER', 'Eritrea', 'ERN'],
  ['EE', 'Estonia', 'EUR'],
  ['SZ', 'Eswatini', 'SZL'],
  ['ET', 'Ethiopia', 'ETB'],
  ['FK', 'Falkland Islands', 'FKP'],
  ['FO', 'Faroe Islands', 'DKK'],
  ['FJ', 'Fiji', 'FJD'],
  ['FI', 'Finland', 'EUR'],
  ['FR', 'France', 'EUR'],
  ['GF', 'French Guiana', 'EUR'],
  ['PF', 'French Polynesia', 'XPF'],
  ['TF', 'French Southern Territories', 'EUR'],
  ['GA', 'Gabon', 'XAF'],
  ['GM', 'Gambia', 'GMD'],
  ['GE', 'Georgia', 'GEL'],
  ['DE', 'Germany', 'EUR'],
  ['GH', 'Ghana', 'GHS'],
  ['GI', 'Gibraltar', 'GIP'],
  ['GR', 'Greece', 'EUR'],
  ['GL', 'Greenland', 'DKK'],
  ['GD', 'Grenada', 'XCD'],
  ['GP', 'Guadeloupe', 'EUR'],
  ['GU', 'Guam', 'USD'],
  ['GT', 'Guatemala', 'GTQ'],
  ['GG', 'Guernsey', 'GBP'],
  ['GN', 'Guinea', 'GNF'],
  ['GW', 'Guinea-Bissau', 'XOF'],
  ['GY', 'Guyana', 'GYD'],
  ['HT', 'Haiti', 'HTG'],
  ['HM', 'Heard & Mcdonald Islands', 'AUD'],
  ['HN', 'Honduras', 'HNL'],
  ['HK', 'Hong Kong SAR China', 'HKD'],
  ['HU', 'Hungary', 'HUF'],
  ['IS', 'Iceland', 'ISK'],
  ['IN', 'India', 'INR'],
  ['ID', 'Indonesia', 'IDR'],
  ['IR', 'Iran', 'IRR'],
  ['IQ', 'Iraq', 'IQD'],
  ['IE', 'Ireland', 'EUR'],
  ['IM', 'Isle Of Man', 'GBP'],
  ['IL', 'Israel', 'ILS'],
  ['IT', 'Italy', 'EUR'],
  ['JM', 'Jamaica', 'JMD'],
  ['JP', 'Japan', 'JPY'],
  ['JE', 'Jersey', 'GBP'],
  ['JO', 'Jordan', 'JOD'],
  ['KZ', 'Kazakhstan', 'KZT'],
  ['KE', 'Kenya', 'KES'],
  ['KI', 'Kiribati', 'AUD'],
  ['XK', 'Kosovo', 'EUR'],
  ['KW', 'Kuwait', 'KWD'],
  ['KG', 'Kyrgyzstan', 'KGS'],
  ['LA', 'Laos', 'LAK'],
  ['LV', 'Latvia', 'EUR'],
  ['LB', 'Lebanon', 'LBP'],
  ['LS', 'Lesotho', 'ZAR'],
  ['LR', 'Liberia', 'LRD'],
  ['LY', 'Libya', 'LYD'],
  ['LI', 'Liechtenstein', 'CHF'],
  ['LT', 'Lithuania', 'EUR'],
  ['LU', 'Luxembourg', 'EUR'],
  ['MO', 'Macao SAR China', 'MOP'],
  ['MG', 'Madagascar', 'MGA'],
  ['MW', 'Malawi', 'MWK'],
  ['MY', 'Malaysia', 'MYR'],
  ['MV', 'Maldives', 'MVR'],
  ['ML', 'Mali', 'XOF'],
  ['MT', 'Malta', 'EUR'],
  ['MH', 'Marshall Islands', 'USD'],
  ['MQ', 'Martinique', 'EUR'],
  ['MR', 'Mauritania', 'MRU'],
  ['MU', 'Mauritius', 'MUR'],
  ['YT', 'Mayotte', 'EUR'],
  ['MX', 'Mexico', 'MXN'],
  ['FM', 'Micronesia', 'USD'],
  ['MD', 'Moldova', 'MDL'],
  ['MC', 'Monaco', 'EUR'],
  ['MN', 'Mongolia', 'MNT'],
  ['ME', 'Montenegro', 'EUR'],
  ['MS', 'Montserrat', 'XCD'],
  ['MA', 'Morocco', 'MAD'],
  ['MZ', 'Mozambique', 'MZN'],
  ['MM', 'Myanmar', 'MMK'],
  ['NA', 'Namibia', 'NAD'],
  ['NR', 'Nauru', 'AUD'],
  ['NP', 'Nepal', 'NPR'],
  ['NL', 'Netherlands', 'EUR'],
  ['NC', 'New Caledonia', 'XPF'],
  ['NZ', 'New Zealand', 'NZD'],
  ['NI', 'Nicaragua', 'NIO'],
  ['NE', 'Niger', 'XOF'],
  ['NG', 'Nigeria', 'NGN'],
  ['NU', 'Niue', 'NZD'],
  ['NF', 'Norfolk Island', 'AUD'],
  ['KP', 'North Korea', 'KPW'],
  ['MK', 'North Macedonia', 'MKD'],
  ['MP', 'Northern Mariana Islands', 'USD'],
  ['NO', 'Norway', 'NOK'],
  ['OM', 'Oman', 'OMR'],
  ['PK', 'Pakistan', 'PKR'],
  ['PW', 'Palau', 'USD'],
  ['PS', 'Palestine', 'ILS'],
  ['PA', 'Panama', 'PAB'],
  ['PG', 'Papua New Guinea', 'PGK'],
  ['PY', 'Paraguay', 'PYG'],
  ['PE', 'Peru', 'PEN'],
  ['PH', 'Philippines', 'PHP'],
  ['PN', 'Pitcairn Islands', 'NZD'],
  ['PL', 'Poland', 'PLN'],
  ['PT', 'Portugal', 'EUR'],
  ['PR', 'Puerto Rico', 'USD'],
  ['QA', 'Qatar', 'QAR'],
  ['RE', 'Réunion', 'EUR'],
  ['RO', 'Romania', 'RON'],
  ['RU', 'Russia', 'RUB'],
  ['RW', 'Rwanda', 'RWF'],
  ['KN', 'Saint Kitts and Nevis', 'XCD'],
  ['VC', 'Saint Vincent and The Grenadines', 'XCD'],
  ['WS', 'Samoa', 'WST'],
  ['SM', 'San Marino', 'EUR'],
  ['ST', 'Sao Tome and Principe', 'STN'],
  ['SA', 'Saudi Arabia', 'SAR'],
  ['SN', 'Senegal', 'XOF'],
  ['RS', 'Serbia', 'RSD'],
  ['SC', 'Seychelles', 'SCR'],
  ['SL', 'Sierra Leone', 'SLE'],
  ['SG', 'Singapore', 'SGD'],
  ['SX', 'Sint Maarten', 'XCG'],
  ['SK', 'Slovakia', 'EUR'],
  ['SI', 'Slovenia', 'EUR'],
  ['SB', 'Solomon Islands', 'SBD'],
  ['SO', 'Somalia', 'SOS'],
  ['ZA', 'South Africa', 'ZAR'],
  ['GS', 'South Georgia & South Sandwich Islands', 'GBP'],
  ['KR', 'South Korea', 'KRW'],
  ['SS', 'South Sudan', 'SSP'],
  ['ES', 'Spain', 'EUR'],
  ['LK', 'Sri Lanka', 'LKR'],
  ['BL', 'St. Barthélemy', 'EUR'],
  ['SH', 'St. Helena', 'SHP'],
  ['LC', 'St. Lucia', 'XCD'],
  ['MF', 'St. Martin', 'EUR'],
  ['PM', 'St. Pierre & Miquelon', 'EUR'],
  ['SD', 'Sudan', 'SDG'],
  ['SR', 'Suriname', 'SRD'],
  ['SJ', 'Svalbard & Jan Mayen', 'NOK'],
  ['SE', 'Sweden', 'SEK'],
  ['CH', 'Switzerland', 'CHF'],
  ['SY', 'Syria', 'SYP'],
  ['TW', 'Taiwan', 'TWD'],
  ['TJ', 'Tajikistan', 'TJS'],
  ['TZ', 'Tanzania', 'TZS'],
  ['TH', 'Thailand', 'THB'],
  ['TL', 'Timor-Leste', 'USD'],
  ['TG', 'Togo', 'XOF'],
  ['TK', 'Tokelau', 'NZD'],
  ['TO', 'Tonga', 'TOP'],
  ['TT', 'Trinidad and Tobago', 'TTD'],
  ['TA', 'Tristan Da Cunha', 'GBP'],
  ['TN', 'Tunisia', 'TND'],
  ['TR', 'Turkey', 'TRY'],
  ['TM', 'Turkmenistan', 'TMT'],
  ['TC', 'Turks & Caicos Islands', 'USD'],
  ['TV', 'Tuvalu', 'AUD'],
  ['UM', 'U.s. Outlying Islands', 'USD'],
  ['VI', 'U.s. Virgin Islands', 'USD'],
  ['UG', 'Uganda', 'UGX'],
  ['UA', 'Ukraine', 'UAH'],
  ['AE', 'United Arab Emirates', 'AED'],
  ['GB', 'United Kingdom', 'GBP'],
  ['US', 'United States', 'USD'],
  ['UY', 'Uruguay', 'UYU'],
  ['UZ', 'Uzbekistan', 'UZS'],
  ['VU', 'Vanuatu', 'VUV'],
  ['VA', 'Vatican City', 'EUR'],
  ['VE', 'Venezuela', 'VES'],
  ['VN', 'Vietnam', 'VND'],
  ['WF', 'Wallis & Futuna', 'XPF'],
  ['EH', 'Western Sahara', 'MAD'],
  ['YE', 'Yemen', 'YER'],
  ['ZM', 'Zambia', 'ZMW'],
  ['ZW', 'Zimbabwe', 'ZWG'],
];

export const COUNTRY_OPTIONS = COUNTRY_ROWS.map(([code, name, currency]) => ({ code, name, currency }));

const BY_CODE = new Map(COUNTRY_OPTIONS.map((c) => [c.code, c]));
const BY_NAME = new Map(COUNTRY_OPTIONS.map((c) => [c.name.toLowerCase(), c]));
// Other spellings the backend also accepts.
const ALIASES = { usa: 'US', 'united states of america': 'US', uk: 'GB', uae: 'AE', 'türkiye': 'TR', 'myanmar (burma)': 'MM' };

// The backend's default profile country.
export const DEFAULT_COUNTRY = 'India';

// The country option for a stored country (name or ISO code), or null.
export const findCountry = (value) => {
  const text = String(value || '').trim();
  if (!text) return null;
  return BY_CODE.get(text.toUpperCase()) || BY_NAME.get(text.toLowerCase())
    || BY_CODE.get(ALIASES[text.toLowerCase()]) || null;
};

export const currencyForCountry = (value) => findCountry(value)?.currency || null;

// The currency of a doctor's fee: the saved one first, else from their country.
export const feeCurrencyOf = (profile) =>
  String(profile?.consultationCurrency || profile?.consultation_currency || '').trim().toUpperCase()
  || currencyForCountry(profile?.address?.country || profile?.country)
  || null;

// Decimal places the currency allows (INR 2, JPY 0, BHD 3).
export const currencyDigits = (currency) => {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
  } catch {
    return 2;
  }
};

// "₹", "$", "€" — or the code ("AED") where the phone has no symbol for it.
export const currencySymbol = (currency) => {
  if (!currency) return '₹';
  try {
    const part = new Intl.NumberFormat('en', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find((p) => p.type === 'currency');
    return part?.value || currency;
  } catch {
    return currency;
  }
};

// "₹500", "$50", "€45.50". Empty for a missing amount.
export const formatFee = (amount, currency) => {
  const value = Number(amount);
  if (amount === '' || amount == null || !Number.isFinite(value)) return '';
  const code = currency || 'INR';
  const digits = currencyDigits(code);
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: digits,
      minimumFractionDigits: Number.isInteger(value) ? 0 : Math.min(2, digits),
    }).format(value);
  } catch {
    return `${code} ${value}`;
  }
};

// Same rule as the backend: a positive number with no more decimals than the
// currency allows.
export const isValidFee = (amount, currency) => {
  const raw = String(amount).trim();
  if (!/^\d+(\.\d+)?$/.test(raw) || !(Number(raw) > 0) || Number(raw) > 9999999.99) return false;
  return (raw.split('.')[1] || '').length <= currencyDigits(currency || 'INR');
};
