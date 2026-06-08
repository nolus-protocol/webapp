export const isTablet = () => {
  return screen?.width < 1024 || window?.innerWidth < 1024;
};

export const isMobile = () => {
  return screen?.width < 768 || window?.innerWidth < 768;
};
