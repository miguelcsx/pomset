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

const apply = (theme, button) => {
  document.documentElement.dataset.theme = theme;
  if (!button) return;
  const next = theme === "dark" ? "claro" : "oscuro";
  button.textContent = theme === "dark" ? "Tema claro" : "Tema oscuro";
  button.setAttribute("aria-label", `Cambiar a tema ${next}`);
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
