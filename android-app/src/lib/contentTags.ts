/** Clean provider labels before measuring their chips. */
export const normalizeContentTags = (values: readonly unknown[]): string[] =>
  [...new Set(values.filter(value => value !== null && value !== undefined)
    .map(value => String(value).trim()).filter(Boolean))];

const EXPLICIT_ADULT_MARKER = /(?:^|[^a-z0-9])(?:18\s*\+|18\s*plus|adult|mature|nc\s*-?\s*17|tv\s*-\s*ma|a\s*-?rated|r\s*-?rated)(?:$|[^a-z0-9])/i;

/** True only when provider metadata explicitly marks an item as mature. */
export const isExplicitlyAdult = (item: unknown): boolean => {
  if (!item || typeof item !== 'object') return false;
  const value = item as Record<string, unknown>;
  if (value.adult === true || value.isAdult === true || value.is_18_plus === true) {
    return true;
  }
  const fields = [value.title, value.tag, value.cornerTag, value.rating, value.certification, value.contentRating, value.type, value.tags];
  return fields.some(field => {
    const values = Array.isArray(field) ? field : [field];
    return values.some(entry => typeof entry === 'string' && EXPLICIT_ADULT_MARKER.test(entry));
  });
};

/** Keep mature items hidden unless the user explicitly opts in. */
export const filterAdultResults = <T>(items: T[], includeAdult: boolean): T[] =>
  includeAdult ? items : items.filter(item => !isExplicitlyAdult(item));
