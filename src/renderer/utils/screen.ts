export const getFontSizeWithScreen = (screenWidth: number = window.innerWidth): number => {
  return screenWidth <= 1440
    ? 16
    : screenWidth <= 1920
      ? 18
      : screenWidth <= 2560
        ? 20
        : screenWidth <= 2560 ? 20 : 22
}
