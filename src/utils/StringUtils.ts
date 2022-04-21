export class StringUtils {
  public static truncateString (str: string, front: number, back: number): string {
    return `${str.substr(0, front)}...${str.substr(str.length - back, str.length)}`
  }

  public static copyToClipboard (text: string): boolean {
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text)
      }
    } catch (e) {
      return false
    }
    return true
  }

  public static capitalize (value: string): string {
    if (typeof value !== 'string') return ''
    return value.charAt(0).toUpperCase() + value.slice(1)
  }
}
