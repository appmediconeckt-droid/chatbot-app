export const parseDateOnly = (value) => {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const text = String(value).trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

export const toDateOnlyString = (value) => {
  const date = parseDateOnly(value);
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const calculateAgeFromDateOfBirth = (value, todayValue = new Date()) => {
  const dob = parseDateOnly(value);
  if (!dob) return null;

  const today = parseDateOnly(todayValue) || new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const birthdayThisYear = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());

  if (today < birthdayThisYear) {
    age -= 1;
  }

  return age >= 0 ? age : null;
};

export const getDatePickerValue = (value) => {
  return parseDateOnly(value) || new Date(2000, 0, 1);
};

export const formatDateOfBirthDisplay = (value, fallback = "") => {
  const date = parseDateOnly(value);
  if (!date) return fallback;

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};
