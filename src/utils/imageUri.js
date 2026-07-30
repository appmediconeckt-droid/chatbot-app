/**
 * Photo fields from the API arrive either as a plain URL string or as a
 * Cloudinary-style object ({ url, secure_url, publicId }). Handing the object
 * straight to <Image source={{ uri }} /> throws at mount time:
 *
 *   Error while updating property 'source' of a view managed by RCTImageView
 *   Value for uri cannot be cast from ReadableNativeMap to String
 *
 * Always funnel API-provided photo values through this before rendering.
 * Returns a non-empty string, or null when there is nothing usable.
 */
const CLOUDINARY_BASE = 'https://res.cloudinary.com/dfll8lwos/image/upload/';

export const toImageUri = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'string') return raw.trim() || null;
  if (typeof raw !== 'object') return null;

  const direct = raw.secure_url || raw.url || raw.uri;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  if (typeof raw.publicId === 'string' && raw.publicId.trim()) {
    return CLOUDINARY_BASE + raw.publicId.trim();
  }
  return null;
};

/** Convenience for `<Image source={imageSource(x)} />` - null when unusable. */
export const imageSource = (raw) => {
  const uri = toImageUri(raw);
  return uri ? { uri } : null;
};

export default toImageUri;
