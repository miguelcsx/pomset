// Theme follows the system until the visitor chooses otherwise; the choice
// then persists across visits (docs/about.md section 22.1).

const STORAGE_KEY = "pomset.theme";

const readStored = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const store = (theme) => {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private browsing denies storage. The theme still applies to this page.
  }
};

const systemTheme = () =>
  window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";

// The button shows the theme you would switch to, so its label is the opposite
// of the current one. Which icon is visible is decided in CSS.
const apply = (theme, button) => {
  document.documentElement.dataset.theme = theme;
  button?.setAttribute("aria-label", theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro");
};

export const initTheme = () => {
  const button = document.querySelector("[data-theme-toggle]");
  apply(readStored() ?? systemTheme(), button);

  button?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    apply(next, button);
    store(next);
  });
};
