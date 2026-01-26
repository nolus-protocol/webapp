export class Utils {
  static getRandomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min);
  }
}

export const isTablet = () => {
  if (import.meta.env.SSR) {
    return false;
  }
  return screen?.width < 1024 || window?.innerWidth < 1024;
};

export const isMobile = () => {
  if (import.meta.env.SSR) {
    return false;
  }
  return screen?.width < 768 || window?.innerWidth < 768;
};
