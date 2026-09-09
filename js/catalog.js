// Catalogue rendering. `filterProfiles` is pure so the filtering rule can be
// read, tested and reused without a DOM.

import { profiles, languages, MODES, SUPPORT, AVAILABILITY } from "./profiles.js";

export const filterProfiles = (list, { mode, language }) =>
  list.filter(
    (profile) =>
      (mode === "all" || profile.mode === mode) &&
      (language === "all" || profile.language === language),
  );

const badge = ({ label, tone }) => `<span class="badge badge--${tone}">${label}</span>`;

const renderProfile = (profile) => `
  <li class="profile">
    <p class="profile__id">${profile.id}</p>
    <h3 class="profile__name">${profile.language} ${profile.version} · ${profile.runtime}</h3>
    <p class="profile__engine">Motor: ${profile.engine}</p>
    <p class="profile__note">${profile.note}</p>
    <p class="profile__states">
      ${badge({ label: MODES[profile.mode], tone: "activity" })}
      ${badge(SUPPORT[profile.support])}
      ${badge(AVAILABILITY[profile.availability])}
    </p>
  </li>
`;

const renderOptions = (values) =>
  values.map((value) => `<option value="${value}">${value}</option>`).join("");

export const initCatalog = () => {
  const grid = document.querySelector("[data-profile-grid]");
  if (!grid) return;

  const modeSelect = document.querySelector("[data-filter-mode]");
  const languageSelect = document.querySelector("[data-filter-language]");
  const count = document.querySelector("[data-profile-count]");
  const empty = document.querySelector("[data-profile-empty]");

  languageSelect.insertAdjacentHTML("beforeend", renderOptions(languages));

  const render = () => {
    const matches = filterProfiles(profiles, {
      mode: modeSelect.value,
      language: languageSelect.value,
    });

    grid.innerHTML = matches.map(renderProfile).join("");
    count.textContent = `${matches.length} de ${profiles.length} perfiles`;
    empty.hidden = matches.length > 0;
  };

  modeSelect.addEventListener("change", render);
  languageSelect.addEventListener("change", render);
  render();
};
