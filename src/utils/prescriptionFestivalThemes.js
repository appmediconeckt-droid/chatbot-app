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

export const getPrescriptionFestivalTheme = id =>
  PRESCRIPTION_FESTIVAL_THEMES.find(theme => theme.id === id) ||
  PRESCRIPTION_FESTIVAL_THEMES[0];
