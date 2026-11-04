import { Image } from 'react-native';
import RNFS from 'react-native-fs';

export const PRESCRIPTION_FESTIVAL_THEMES = [
  ['default_general', 'General', require('../image/prescription-themes/default_general.png')],
  ['baisakhi', 'Baisakhi', require('../image/prescription-themes/baisakhi.png')],
  ['christmas', 'Christmas', require('../image/prescription-themes/christmas.png')],
  ['diwali', 'Diwali', require('../image/prescription-themes/diwali.png')],
  ['dussehra', 'Dussehra', require('../image/prescription-themes/dussehra.png')],
  ['eid', 'Eid', require('../image/prescription-themes/eid.png')],
  ['ganesh_chaturthi', 'Ganesh Chaturthi', require('../image/prescription-themes/ganesh_chaturthi.png')],
  ['holi', 'Holi', require('../image/prescription-themes/holi.png')],
  ['independence_day', 'Independence Day', require('../image/prescription-themes/independence_day.png')],
  ['janmashtami', 'Janmashtami', require('../image/prescription-themes/janmashtami.png')],
  ['makar_sankranti', 'Makar Sankranti', require('../image/prescription-themes/makar_sankranti.png')],
  ['navratri', 'Navratri', require('../image/prescription-themes/navratri.png')],
  ['new_year', 'New Year', require('../image/prescription-themes/new_year.png')],
  ['raksha_bandhan', 'Raksha Bandhan', require('../image/prescription-themes/raksha_bandhan.png')],
  ['republic_day', 'Republic Day', require('../image/prescription-themes/republic_day.png')],
].map(([id, label, image]) => ({ id, label, image }));

export const DEFAULT_PRESCRIPTION_THEME_ID = 'default_general';

export const getPrescriptionFestivalTheme = id =>
  PRESCRIPTION_FESTIVAL_THEMES.find(theme => theme.id === (id || DEFAULT_PRESCRIPTION_THEME_ID)) ||
  PRESCRIPTION_FESTIVAL_THEMES[0];

// The theme picked for a consultant prescription (stored under a few names).
export const prescriptionThemeIdOf = item =>
  item?.festivalTheme ||
  item?.prescriptionTheme ||
  item?.theme ||
  item?.selectedTheme ||
  DEFAULT_PRESCRIPTION_THEME_ID;

// The theme image as a data URI for the PDF page, which the native printer
// renders offline. In a dev build the asset is served by Metro (downloaded
// once into the cache); in a release build it is a drawable resource. Resolves
// '' when it can't be read — the PDF is then printed without the background.
const themeDataUris = new Map();
export const prescriptionThemeDataUri = async themeId => {
  const theme = getPrescriptionFestivalTheme(themeId);
  if (themeDataUris.has(theme.id)) return themeDataUris.get(theme.id);
  try {
    const uri = Image.resolveAssetSource(theme.image)?.uri || '';
    let base64 = '';
    if (/^https?:/i.test(uri)) {
      const path = `${RNFS.CachesDirectoryPath}/rx-theme-${theme.id}.png`;
      const result = await RNFS.downloadFile({ fromUrl: uri, toFile: path }).promise;
      if (result.statusCode === 200) base64 = await RNFS.readFile(path, 'base64');
    } else if (/^file:/i.test(uri)) {
      base64 = await RNFS.readFile(uri.replace(/^file:\/\//i, ''), 'base64');
    } else if (uri) {
      base64 = await RNFS.readFileRes(`${uri}.png`, 'base64');
    }
    const dataUri = base64 ? `data:image/png;base64,${base64}` : '';
    if (dataUri) themeDataUris.set(theme.id, dataUri);
    return dataUri;
  } catch {
    return '';
  }
};
