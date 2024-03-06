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
    } catch (e) {
      return false;
    }
    return true;
  }

  public static capitalize(value: string): string {
    if (typeof value !== "string") return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  public static strToColor(str: string) {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 10) - hash);
      hash = hash & hash;
    }
    let rgb = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      let value = (hash >> (i * 8)) & 255;
      rgb[i] = value;
    }
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  }
}
