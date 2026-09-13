// Workbench: lanes, their stage machine, and the evidence of the active lane.
//
// Shape of the module: `state` holds everything, small pure helpers build
// markup from it, and `render` writes that markup once. Handlers only change
// state and call `render`, so there is a single place where the DOM is
// touched and no partial updates to keep in sync.

import { profiles, MODES, describe } from "./profiles.js";
import { scenario, evidenceByMode, STAGES } from "./scenario.js";

const MAX_LANES = 4; // Section 6.3: up to four lanes over the same scenario.
const STAGE_MS = 420;

const state = {
  lanes: [],
  activeLane: null,
  selectedRow: null,
  nextId: 1,
};

// Only profiles this scenario admits reach the selector. Explaining why the
// rest do not apply belongs to the catalogue page, not to a lane dropdown.
const selectable = profiles.filter(
  (profile) => profile.language === scenario.language && profile.availability !== "none",
);

const findLane = (id) => state.lanes.find((lane) => lane.id === id);
const activeLane = () => findLane(state.activeLane);

const createLane = (profileId) => ({
  id: state.nextId++,
  profileId,
  stage: -1, // -1 means never run.
  timer: null,
});

const stopTimer = (lane) => {
  clearInterval(lane.timer);
  lane.timer = null;
};

const isRunning = (lane) => lane.timer !== null;
const isDone = (lane) => lane.stage === STAGES.length - 1;

// ---------- markup ----------

const escape = (value) =>
  String(value).replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char]);

const stageState = (lane, index) => {
  if (index < lane.stage) return "done";
  if (index === lane.stage) return isDone(lane) ? "done" : "active";
  return "pending";
};

const renderStages = (lane) => `
  <ul class="stages" aria-hidden="true">
    ${STAGES.map((_, index) => `<li class="stage" data-state="${stageState(lane, index)}"></li>`).join("")}
  </ul>
  <p class="stage-label">${lane.stage < 0 ? "sin ejecutar" : STAGES[lane.stage]}</p>
`;

// A finished lane leads with its verdict: that answer is why the lane exists,
// and the machinery that produced it stays underneath it.
const renderVerdict = (lane) => {
  if (!isDone(lane)) return renderStages(lane);

  const evidence = evidenceByMode[findProfile(lane).mode];
  return `
    <p class="lane__verdict lane__verdict--${evidence.tone}">${evidence.conclusion}</p>
    <p class="lane__meta">${evidence.detail}</p>
  `;
};

const findProfile = (lane) => profiles.find((profile) => profile.id === lane.profileId);

const renderOption = (profile, selectedId) => `
  <option value="${profile.id}" ${profile.id === selectedId ? "selected" : ""}>
    ${describe(profile)}
  </option>
`;

const renderProfileOptions = (selectedId) =>
  selectable.map((profile) => renderOption(profile, selectedId)).join("");

const renderLane = (lane) => {
  const profile = findProfile(lane);
  return `
    <li class="lane" data-lane="${lane.id}" aria-current="${lane.id === state.activeLane}">
      <div class="lane__head">
        <select class="lane__select" data-lane-profile="${lane.id}" aria-label="Perfil del carril ${lane.id}">
          ${renderProfileOptions(lane.profileId)}
        </select>
        <button class="button button--danger" type="button" data-lane-remove="${lane.id}" aria-label="Quitar carril ${lane.id}">×</button>
      </div>
      <div class="lane__body">
        ${renderVerdict(lane)}
        <p class="lane__meta">${profile.engine}</p>
        <button class="button" type="button" data-lane-run="${lane.id}">
          ${isRunning(lane) ? "Cancelar" : isDone(lane) ? "Repetir" : "Ejecutar"}
        </button>
      </div>
    </li>
  `;
};

const renderSource = () => {
  const highlighted = state.selectedRow?.line;
  return scenario.source
    .map(
      (text, index) =>
        `<div class="source__line ${index + 1 === highlighted ? "source__line--marked" : ""}">${escape(text)}</div>`,
    )
    .join("");
};

const renderEvidenceRow = (row) => `
  <tr data-row="${row.seq}" aria-selected="${row.seq === state.selectedRow?.seq}" tabindex="0">
    <td>${row.seq}</td>
    <td>${escape(row.actor)}</td>
    <td>${escape(row.op)}</td>
    <td>${escape(row.resource)}</td>
    <td>${row.line}</td>
  </tr>
`;

const renderEvidence = () => {
  const lane = activeLane();
  if (!lane || !isDone(lane)) {
    return `<p class="empty-state">Ejecuta un carril para ver su evidencia.</p>`;
  }

  const evidence = evidenceByMode[findProfile(lane).mode];
  return `
    <table class="evidence-table">
      <caption class="sr-only">Eventos del carril activo</caption>
      <thead>
        <tr><th scope="col">#</th><th scope="col">Actor</th><th scope="col">Operación</th><th scope="col">Recurso</th><th scope="col">Línea</th></tr>
      </thead>
      <tbody>${evidence.rows.map(renderEvidenceRow).join("")}</tbody>
    </table>
  `;
};

// ---------- render ----------

const dom = {};

const render = () => {
  dom.lanes.innerHTML = state.lanes.map(renderLane).join("");
  dom.source.innerHTML = renderSource();
  dom.evidence.innerHTML = renderEvidence();
  dom.addLane.disabled = state.lanes.length >= MAX_LANES;
  dom.laneCount.textContent = `${state.lanes.length}/${MAX_LANES} carriles`;
};

// ---------- behaviour ----------

const advance = (lane) => {
  lane.stage += 1;
  if (isDone(lane)) stopTimer(lane);
  render();
};

// Running a lane focuses it: the evidence panel is bound to the active lane,
// so leaving focus elsewhere would hide the result that was just produced.
const run = (lane) => {
  stopTimer(lane);
  lane.stage = 0;
  state.activeLane = lane.id;
  state.selectedRow = null;
  lane.timer = setInterval(() => advance(lane), STAGE_MS);
  render();
};

const cancel = (lane) => {
  stopTimer(lane);
  lane.stage = -1;
  render();
};

const addLane = (profileId = selectable[state.lanes.length % selectable.length].id) => {
  if (state.lanes.length >= MAX_LANES) return null;
  const lane = createLane(profileId);
  state.lanes.push(lane);
  state.activeLane = lane.id;
  render();
  return lane;
};

// The page opens on the comparison it exists to show: the same file observed
// once and explored once, with two different answers. Landing on an empty
// shell would hide the point behind a button.
const seedComparison = () => {
  const finished = (profileId) => {
    const lane = addLane(profileId);
    lane.stage = STAGES.length - 1;
  };

  finished("py313-asyncio-observe");
  finished("py313-asyncio-explore");
  state.activeLane = state.lanes[1].id;
  state.selectedRow = evidenceByMode.explore.rows.find((row) => row.op === "swallow") ?? null;
  render();
};

const removeLane = (id) => {
  const lane = findLane(id);
  stopTimer(lane);
  state.lanes = state.lanes.filter((candidate) => candidate.id !== id);
  if (state.activeLane === id) state.activeLane = state.lanes[0]?.id ?? null;
  render();
};

const selectRow = (seq) => {
  const lane = activeLane();
  const evidence = evidenceByMode[findProfile(lane).mode];
  state.selectedRow = evidence.rows.find((row) => row.seq === Number(seq)) ?? null;
  render();
};

// One listener per panel instead of one per control: the markup is replaced on
// every render, so delegated handlers survive it.
const onLanesClick = (event) => {
  const button = event.target.closest("button");
  const lane = event.target.closest("[data-lane]");
  if (!lane) return;

  if (!button) {
    state.activeLane = Number(lane.dataset.lane);
    state.selectedRow = null;
    render();
    return;
  }

  const id = Number(button.dataset.laneRun ?? button.dataset.laneRemove);
  if (button.dataset.laneRemove) return removeLane(id);
  if (button.dataset.laneRun) {
    const target = findLane(id);
    return isRunning(target) ? cancel(target) : run(target);
  }
};

const onLanesChange = (event) => {
  const select = event.target.closest("[data-lane-profile]");
  if (!select) return;
  const lane = findLane(Number(select.dataset.laneProfile));
  lane.profileId = select.value;
  lane.stage = -1;
  stopTimer(lane);
  render();
};

const onEvidenceActivate = (event) => {
  const row = event.target.closest("[data-row]");
  if (!row) return;
  if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  selectRow(row.dataset.row);
};

export const initWorkbench = () => {
  dom.lanes = document.querySelector("[data-lane-list]");
  if (!dom.lanes) return;

  dom.source = document.querySelector("[data-source]");
  dom.evidence = document.querySelector("[data-evidence]");
  dom.addLane = document.querySelector("[data-add-lane]");
  dom.laneCount = document.querySelector("[data-lane-count]");

  dom.lanes.addEventListener("click", onLanesClick);
  dom.lanes.addEventListener("change", onLanesChange);
  dom.evidence.addEventListener("click", onEvidenceActivate);
  dom.evidence.addEventListener("keydown", onEvidenceActivate);
  dom.addLane.addEventListener("click", () => addLane());

  seedComparison();
};
