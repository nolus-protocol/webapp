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

  public static fromHex (hex: string): Uint8Array {
    if (hex.length % 2 !== 0) {
      throw new Error('hex string length must be a multiple of 2')
    }
    const listOfInts = []
    for (let i = 0; i < hex.length; i += 2) {
      const hexByteAsString = hex.substr(i, 2)
      if (!hexByteAsString.match(/[0-9a-f]{2}/i)) {
        throw new Error('hex string contains invalid characters')
      }
      listOfInts.push(parseInt(hexByteAsString, 16))
    }
    return new Uint8Array(listOfInts)
  }
}
