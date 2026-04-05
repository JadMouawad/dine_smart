function getFlagEmoji(countryIsoCode) {
  return String(countryIsoCode || "")
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

export const COUNTRY_OPTIONS = [
  { label: "Lebanon", code: "+961", iso: "LB" },
  { label: "United States", code: "+1", iso: "US" },
  { label: "France", code: "+33", iso: "FR" },
  { label: "UK", code: "+44", iso: "GB" },
  { label: "UAE", code: "+971", iso: "AE" },
  { label: "Saudi Arabia", code: "+966", iso: "SA" },
  { label: "Germany", code: "+49", iso: "DE" },
].map((country) => ({
  ...country,
  flag: getFlagEmoji(country.iso),
  flagIconUrl: `https://flagcdn.com/24x18/${country.iso.toLowerCase()}.png`,
  displayLabel: `${country.label} (${country.code})`,
}));

export function splitPhoneNumber(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return {
      countryCode: COUNTRY_OPTIONS[0].code,
      localNumber: "",
    };
  }

  const match = [...COUNTRY_OPTIONS]
    .sort((left, right) => right.code.length - left.code.length)
    .find((country) => raw.startsWith(country.code));

  if (match) {
    return {
      countryCode: match.code,
      localNumber: raw.slice(match.code.length).replace(/\D/g, ""),
    };
  }

  return {
    countryCode: COUNTRY_OPTIONS[0].code,
    localNumber: raw.replace(/\D/g, ""),
  };
}
