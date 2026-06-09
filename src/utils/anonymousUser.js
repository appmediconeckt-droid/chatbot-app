export const ANONYMOUS_USER_NAME = "Anonymous User";

const SAFE_GENERATED_AVATAR_HOSTS = [
  "api.dicebear.com",
  "randomuser.me",
  "xsgames.co",
  "images.generated.photos",
  "ui-avatars.com",
];

const readNested = (source, path) =>
  path.reduce(
    (value, key) => (value && value[key] !== undefined ? value[key] : undefined),
    source,
  );

const readFirst = (source, paths) => {
  for (const path of paths) {
    const value = readNested(source, path);
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value === true) return true;
  }
  return "";
};

const normalizeAvatarUrl = (value, allowAnyHttpUrl = false) => {
  const raw =
    typeof value === "string"
      ? value
      : value?.url || value?.secure_url || value?.uri || value?.src;

  if (typeof raw !== "string" || !raw.trim()) return "";

  const trimmed = raw.trim();
  if (!/^https?:\/\//i.test(trimmed)) return "";

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "";
  }

  const isGeneratedAvatar = SAFE_GENERATED_AVATAR_HOSTS.some(
    (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`),
  );

  if (!allowAnyHttpUrl && !isGeneratedAvatar) return "";

  const normalizedUrl = parsed.toString();
  if (parsed.hostname === "api.dicebear.com") {
    return normalizedUrl
      .replace(/\/svg(?=\?)/i, "/png")
      .replace(/\/svg\//i, "/png/");
  }

  return normalizedUrl;
};

const readFirstAvatarUrl = (source, paths, allowAnyHttpUrl = false) => {
  for (const path of paths) {
    const url = normalizeAvatarUrl(readNested(source, path), allowAnyHttpUrl);
    if (url) return url;
  }
  return "";
};

export const getAnonymousUserName = (
  source,
  fallback = ANONYMOUS_USER_NAME,
) => {
  const value = readFirst(source, [
    ["anonymous"],
    ["anonymousName"],
    ["anonName"],
    ["displayAnonymous"],
    ["user", "anonymous"],
    ["user", "anonymousName"],
    ["patient", "anonymous"],
    ["patient", "anonymousName"],
    ["otherParty", "anonymous"],
    ["otherParty", "anonymousName"],
    ["profile", "anonymous"],
  ]);

  return typeof value === "string" ? value : fallback;
};

export const getAnonymousUserGender = (source) => {
  const raw = String(
    readFirst(source, [
      ["gender"],
      ["user", "gender"],
      ["patient", "gender"],
      ["otherParty", "gender"],
      ["profile", "gender"],
      ["user", "profile", "gender"],
      ["patient", "profile", "gender"],
    ]) || "",
  ).toLowerCase();

  if (["male", "man", "boy", "m"].includes(raw)) return "male";
  if (["female", "woman", "girl", "f"].includes(raw)) return "female";
  return "other";
};

export const getAnonymousUserAvatar = (source) => {
  const gender = getAnonymousUserGender(source);
  if (gender === "male") return "👨";
  if (gender === "female") return "👩";
  return "👤";
};

export const getAnonymousUserAvatarUrl = (source) => {
  const explicitAvatarUrl = readFirstAvatarUrl(
    source,
    [
      ["anonymousAvatarUrl"],
      ["anonymousAvatar"],
      ["avatarUrl"],
      ["avatarImage"],
      ["profileAvatarUrl"],
      ["profileAvatar"],
      ["selectedAvatar"],
      ["displayAvatar"],
      ["user", "anonymousAvatarUrl"],
      ["user", "anonymousAvatar"],
      ["user", "avatarUrl"],
      ["user", "avatarImage"],
      ["patient", "anonymousAvatarUrl"],
      ["patient", "anonymousAvatar"],
      ["patient", "avatarUrl"],
      ["patient", "avatarImage"],
      ["otherParty", "anonymousAvatarUrl"],
      ["otherParty", "anonymousAvatar"],
      ["otherParty", "avatarUrl"],
      ["otherParty", "avatarImage"],
      ["profile", "anonymousAvatarUrl"],
      ["profile", "anonymousAvatar"],
      ["profile", "avatarUrl"],
      ["profile", "avatarImage"],
    ],
    true,
  );

  if (explicitAvatarUrl) return explicitAvatarUrl;

  return readFirstAvatarUrl(source, [
    ["avatar"],
    ["profilePhoto"],
    ["profilePhoto", "url"],
    ["profilePic"],
    ["photoUrl"],
    ["image"],
    ["user", "avatar"],
    ["user", "profilePhoto"],
    ["user", "profilePhoto", "url"],
    ["user", "profilePic"],
    ["patient", "avatar"],
    ["patient", "profilePhoto"],
    ["patient", "profilePhoto", "url"],
    ["patient", "profilePic"],
    ["otherParty", "avatar"],
    ["otherParty", "profilePhoto"],
    ["otherParty", "profilePhoto", "url"],
    ["otherParty", "profilePic"],
    ["profile", "avatar"],
    ["profile", "profilePhoto"],
    ["profile", "profilePhoto", "url"],
  ]);
};

export const getAnonymousUserDisplay = (source) => ({
  name: getAnonymousUserName(source),
  gender: getAnonymousUserGender(source),
  avatar: getAnonymousUserAvatar(source),
  avatarUrl: getAnonymousUserAvatarUrl(source),
});

export const getAnonymousParticipantId = (source) =>
  source?.receiverId ||
  source?._id ||
  source?.id ||
  source?.userId ||
  source?.user_id ||
  source?.patientId ||
  source?.clientId ||
  source?.user?._id ||
  source?.user?.id ||
  source?.patient?._id ||
  source?.patient?.id ||
  source?.otherParty?._id ||
  source?.otherParty?.id ||
  null;
