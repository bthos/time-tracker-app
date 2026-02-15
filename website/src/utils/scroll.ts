/**
 * Scroll to an element with offset for fixed header
 * @param elementId - The ID of the element to scroll to
 * @param offset - Offset in pixels (default: 64px for header height)
 */
export const scrollToElement = (elementId: string, offset: number = 64) => {
  const element = document.getElementById(elementId);
  if (element) {
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - offset;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth',
    });
  }
};
