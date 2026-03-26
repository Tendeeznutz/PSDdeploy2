import gsap from "gsap";

function resolveTargets(target) {
  if (!target) return null;
  if (typeof target === "string") {
    const elements = document.querySelectorAll(target);
    return elements.length > 0 ? elements : null;
  }
  if (target instanceof Element) return target;
  if (target.length !== undefined) return target.length > 0 ? target : null;
  return target;
}

export function fadeUp(target, delay = 0) {
  const targets = resolveTargets(target);
  if (!targets) return;
  gsap.from(targets, { opacity: 0, y: 20, duration: 0.4, ease: "power2.out", delay });
}

export function fadeUpFrom(target, delay = 0) {
  const targets = resolveTargets(target);
  if (!targets) return;
  gsap.fromTo(targets,
    { opacity: 0, y: 20 },
    { opacity: 1, y: 0, duration: 0.4, ease: "power2.out", delay }
  );
}

export function staggerRows(target, delay = 0) {
  const targets = resolveTargets(target);
  if (!targets) return;
  gsap.from(targets, { opacity: 0, y: 8, stagger: 0.04, duration: 0.3, ease: "power2.out", delay });
}

export function staggerRowsFrom(target, delay = 0) {
  const targets = resolveTargets(target);
  if (!targets) return;
  gsap.fromTo(targets,
    { opacity: 0, y: 6 },
    { opacity: 1, y: 0, stagger: 0.03, duration: 0.3, ease: "power2.out", delay }
  );
}

export function staggerCards(target, delay = 0) {
  const targets = resolveTargets(target);
  if (!targets) return;
  gsap.fromTo(targets,
    { opacity: 0, y: 24, scale: 0.97 },
    { opacity: 1, y: 0, scale: 1, stagger: 0.12, duration: 0.5, ease: "power2.out", delay }
  );
}

export function slideInLeft(target) {
  const targets = resolveTargets(target);
  if (!targets) return;
  gsap.from(targets, { x: -20, opacity: 0, duration: 0.4, ease: "power2.out" });
}

export function slideInRight(target) {
  const targets = resolveTargets(target);
  if (!targets) return;
  gsap.from(targets, { x: 20, opacity: 0, duration: 0.4, ease: "power2.out" });
}

export function drawerOpen(target) {
  const targets = resolveTargets(target);
  if (!targets) return;
  gsap.from(targets, { x: "100%", duration: 0.35, ease: "power3.out" });
}

export function counterAnimate(element, targetValue, delay = 0) {
  if (!element) return;
  const obj = { n: 0 };
  gsap.to(obj, {
    n: targetValue,
    duration: 1.2,
    ease: "power2.out",
    delay,
    onUpdate: () => { element.textContent = Math.round(obj.n).toString(); },
  });
}
