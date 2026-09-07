export const DEFAULT_PRESCRIPTION_VALID_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

const parseDate = value => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getPrescriptionIssuedDate = item =>
  parseDate(item?.issuedAt || item?.createdAt || item?.date) || new Date();

export const getPrescriptionValidUntilDate = item => {
  const explicitDate = parseDate(
    item?.validUntil ||
      item?.validTill ||
      item?.validityDate ||
      item?.prescriptionValidUntil ||
      item?.expiresAt ||
      item?.expiryDate ||
      item?.expirationDate,
  );
  if (explicitDate) return explicitDate;

  const validDays = Number(
    item?.validityDays || item?.validForDays || DEFAULT_PRESCRIPTION_VALID_DAYS,
  );
  const issuedAt = getPrescriptionIssuedDate(item);
  return new Date(
    issuedAt.getTime() +
      (Number.isFinite(validDays) && validDays > 0
        ? validDays
        : DEFAULT_PRESCRIPTION_VALID_DAYS) *
        DAY_MS,
  );
};

export const formatPrescriptionDateTime = value => {
  const date = parseDate(value);
  if (!date) return '';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getPrescriptionValidity = item => {
  const issuedAt = getPrescriptionIssuedDate(item);
  const validUntil = getPrescriptionValidUntilDate(item);
  const now = new Date();
  return {
    issuedAt,
    validUntil,
    validDays:
      Number(item?.validityDays || item?.validForDays) ||
      DEFAULT_PRESCRIPTION_VALID_DAYS,
    isExpired: validUntil.getTime() < now.getTime(),
    issuedLabel: formatPrescriptionDateTime(issuedAt),
    validUntilLabel: formatPrescriptionDateTime(validUntil),
  };
};
