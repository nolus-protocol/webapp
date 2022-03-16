export class NumberUtils {
  public static parseNumber (data: any): number {
    if (isNaN(data)) {
      throw new Error('Not a number')
    }
    return Number(data)
  }
}
