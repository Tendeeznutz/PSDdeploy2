// Smooth scroll animations inspired by AKIS Studio
// This provides smooth fade-in and scroll-triggered animations

export const initScrollAnimations = () => {
  if (typeof window === 'undefined') return;

  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px',
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
        // Optionally stop observing after animation
        // observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Observe all elements with data-animate attribute
  document.querySelectorAll('[data-animate]').forEach((el) => {
    observer.observe(el);
  });

  // Observe sections for stagger animations
  document.querySelectorAll('[data-animate-stagger]').forEach((container) => {
    const children = container.children;
    Array.from(children).forEach((child, index) => {
      (child as HTMLElement).style.transitionDelay = `${index * 0.1}s`;
      observer.observe(child);
    });
  });
};

export const smoothScrollTo = (elementId: string) => {
  const element = document.getElementById(elementId);
  if (element) {
    const offset = 80; // Account for fixed navbar
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - offset;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth',
    });
  }
};
