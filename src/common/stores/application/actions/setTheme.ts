import type { Store } from "../types";
import { ThemeManager } from "@/common/utils";

export function setTheme(this: Store, theme: string) {
  try {
    ThemeManager.saveThemeData(theme);
    this.theme = theme;
  } catch (error: Error | any) {
    throw new Error(error);
  }
}
