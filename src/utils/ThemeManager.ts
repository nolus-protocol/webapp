import { APPEARANCE } from "@/config/env";

export class ThemeManager {
  public static THEME_DATA = "theme_data";

  public static saveThemeData(theme: string) {
    localStorage.setItem(this.THEME_DATA, theme);
  }

  public static getThemeData(): string {
    const theme = localStorage.getItem(this.THEME_DATA);
    const items = Object.keys(APPEARANCE);
    if(items.includes(theme as string)){
      return APPEARANCE[theme as keyof typeof APPEARANCE];
    }
    return APPEARANCE.light;
  }

}
