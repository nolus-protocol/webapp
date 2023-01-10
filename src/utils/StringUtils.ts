export class StringUtils {
  public static truncateString(
    str: string,
    front: number,
    back: number
  ): string {
    return `${str.substring(0, front)}...${str.substring(
      str.length - back,
      str.length
    )}`;
  }

  public static async copyToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
    } catch (e) {
      return false;
    }
    return true;
  }

  public static capitalize(value: string): string {
    if (typeof value !== "string") return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  public static getDenomFromMinimalDenom(minimalDenom: string) {
    return minimalDenom?.replace(minimalDenom[0], "");
  }
}
