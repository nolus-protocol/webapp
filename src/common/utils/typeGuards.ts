/**
 * Narrows an unknown value to a member of a string enum.
 *
 * Use at trust boundaries (route params, external input) in place of an
 * `as <Enum>` assertion: the membership check both validates and narrows,
 * so the caller gets a real `Enum` type without laundering an untrusted value.
 */
export function isEnumValue<T extends Record<string, string>>(enumObj: T, value: unknown): value is T[keyof T] {
  return typeof value === "string" && Object.values(enumObj).includes(value);
}
