export class StringUtils {
  public static truncateString(str: string, front: number, back: number): string {
    return `${str.substring(0, front)}...${str.substring(str.length - back, str.length)}`;
  }

  public static truncateText(text: string, maxLength: number, ellipsis: string = "..."): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + ellipsis;
  }

  public static async copyToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      return false;
    }
    return true;
  }
}
