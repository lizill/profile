import { formatCareerYear, getCareerYear } from "@/shared/utils/career";
import type { Locale } from "@/shared/i18n/types";

const LOCALE_SCROLL_TIMEOUT_MS = 1200;
const LOCALE_SCROLL_SETTLE_MS = 120;

let localeNavigationInProgress = false;

function getLocaleMenu(trigger: HTMLButtonElement): HTMLElement | null {
  const menuId = trigger.getAttribute("aria-controls");
  const menu = menuId ? document.getElementById(menuId) : null;

  return menu instanceof HTMLElement ? menu : null;
}

function closeLocaleMenu(trigger: HTMLButtonElement): void {
  const menu = getLocaleMenu(trigger);

  if (!menu) {
    return;
  }

  menu.classList.add("hidden");
  trigger.setAttribute("aria-expanded", "false");
}

function closeAllLocaleMenus(except?: HTMLButtonElement): void {
  document.querySelectorAll<HTMLButtonElement>("[data-locale-trigger]").forEach((trigger) => {
    if (trigger !== except) {
      closeLocaleMenu(trigger);
    }
  });
}

function openLocaleMenu(trigger: HTMLButtonElement): void {
  const menu = getLocaleMenu(trigger);

  if (!menu) {
    return;
  }

  closeAllLocaleMenus(trigger);
  menu.classList.remove("hidden");
  trigger.setAttribute("aria-expanded", "true");
}

function toggleLocaleMenu(trigger: HTMLButtonElement): void {
  const isOpen = trigger.getAttribute("aria-expanded") === "true";

  if (isOpen) {
    closeLocaleMenu(trigger);
    return;
  }

  openLocaleMenu(trigger);
}

function navigateAfterScroll(href: string): void {
  if (localeNavigationInProgress) {
    return;
  }

  localeNavigationInProgress = true;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion || window.scrollY <= 1) {
    window.scrollTo({ top: 0, behavior: "auto" });
    window.location.assign(href);
    return;
  }

  const startedAt = window.performance.now();
  let lastScrollY = window.scrollY;
  let settledAt = startedAt;

  window.scrollTo({ top: 0, behavior: "smooth" });

  const waitForTop = () => {
    const now = window.performance.now();
    const currentScrollY = window.scrollY;
    const isAtTop = currentScrollY <= 1;
    const moved = Math.abs(currentScrollY - lastScrollY) > 1;
    const timedOut = now - startedAt >= LOCALE_SCROLL_TIMEOUT_MS;

    if (isAtTop) {
      window.location.assign(href);
      return;
    }

    if (moved) {
      lastScrollY = currentScrollY;
      settledAt = now;
    }

    if (timedOut || now - settledAt >= LOCALE_SCROLL_SETTLE_MS) {
      window.scrollTo({ top: 0, behavior: "auto" });
      window.location.assign(href);
      return;
    }

    window.requestAnimationFrame(waitForTop);
  };

  window.requestAnimationFrame(waitForTop);
}

function setupLocaleMenu(): void {
  const triggers = document.querySelectorAll<HTMLButtonElement>("[data-locale-trigger]");

  triggers.forEach((trigger) => {
    const menu = getLocaleMenu(trigger);

    if (!menu) {
      return;
    }

    trigger.addEventListener("click", () => {
      toggleLocaleMenu(trigger);
    });

    menu.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        closeAllLocaleMenus();
        navigateAfterScroll(link.href);
      });
    });
  });

  document.addEventListener("click", (event) => {
    const target = event.target;

    if (!(target instanceof Node)) {
      return;
    }

    const clickedInsideLocaleSwitcher = Array.from(document.querySelectorAll<HTMLElement>(".locale-switcher")).some(
      (switcher) => switcher.contains(target),
    );

    if (!clickedInsideLocaleSwitcher) {
      closeAllLocaleMenus();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    const openTrigger = Array.from(triggers).find((trigger) => trigger.getAttribute("aria-expanded") === "true");

    closeAllLocaleMenus();
    openTrigger?.focus();
  });
}

function setupMobileMenu(): void {
  const button = document.getElementById("menuBtn");
  const menu = document.getElementById("mobileMenu");

  if (!(button instanceof HTMLButtonElement) || !(menu instanceof HTMLElement)) {
    return;
  }

  const openLabel = button.dataset.openLabel ?? "Open menu";
  const closeLabel = button.dataset.closeLabel ?? "Close menu";

  const setOpen = (isOpen: boolean) => {
    menu.classList.toggle("hidden", !isOpen);
    button.setAttribute("aria-expanded", String(isOpen));
    button.setAttribute("aria-label", isOpen ? closeLabel : openLabel);

    if (!isOpen) {
      closeAllLocaleMenus();
    }
  };

  button.addEventListener("click", () => {
    setOpen(menu.classList.contains("hidden"));
  });

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      setOpen(false);
    });
  });
}

function setupCareerYear(): void {
  document.querySelectorAll<HTMLElement>(".js-career-year").forEach((item) => {
    const startDate = item.dataset.careerStart;
    const locale = item.dataset.careerLocale as Locale | undefined;

    if (!startDate || !locale) {
      return;
    }

    item.textContent = formatCareerYear(getCareerYear(startDate), locale);
  });
}

function setupHeaderState(): void {
  const header = document.getElementById("siteHeader");

  if (!(header instanceof HTMLElement)) {
    return;
  }

  const onScroll = () => {
    header.classList.toggle("scrolled", window.scrollY > 80);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

function setupReveal(): void {
  const items = document.querySelectorAll<HTMLElement>(".reveal");

  if (!("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -20% 0px" },
  );

  items.forEach((item) => observer.observe(item));
}

setupLocaleMenu();
setupMobileMenu();
setupCareerYear();
setupHeaderState();
setupReveal();
