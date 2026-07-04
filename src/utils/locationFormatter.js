/**
 * Format location string with proper commas and spacing
 * Handles various input formats: "City,State,Country" or "City, State, Country"
 * Returns formatted string: "City, State, Country"
 */
export const formatLocation = (location) => {
  if (!location || typeof location !== 'string') {
    return 'Location not specified';
  }

  // Handle both comma and pipe separated locations
  const separator = location.includes('|') ? '|' : ',';
  return location
    .split(separator)
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .join(', ');
};

/**
 * Get location parts separately
 * Returns object with city, state, country
 */
export const parseLocation = (location) => {
  if (!location || typeof location !== 'string') {
    return { city: '', state: '', country: '', full: '' };
  }

  // Handle both comma and pipe separated locations
  const separator = location.includes('|') ? '|' : ',';
  const parts = location
    .split(separator)
    .map(part => part.trim())
    .filter(part => part.length > 0);

  return {
    city: parts[0] || '',
    state: parts[1] || '',
    country: parts[2] || '',
    full: parts.join(', '),
  };
};

/**
 * Get first location part (city only)
 */
export const getCity = (location) => {
  if (!location || typeof location !== 'string') return '';
  const parts = location.split(',').map(p => p.trim()).filter(p => p.length > 0);
  return parts[0] || '';
};
