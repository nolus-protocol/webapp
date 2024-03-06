import type { Store } from "../types";
import { ThemeManager } from "@/common/utils";

export function loadTheme(this: Store) {
  try {
    const theme = ThemeManager.getThemeData();
    this.theme = theme;
  } catch (error: Error | any) {
    throw new Error(error);
  }
}
