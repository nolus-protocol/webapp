export class Utils {
  static getRandomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min);
  }
}
export const isMobile = () => {
  return screen?.width < 768 || window?.innerWidth < 768;
};
