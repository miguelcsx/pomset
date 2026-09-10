// Import form validation.
//
// Rules are data, not branches: each field owns a list of checks and the
// message shown when one fails. `validate` is pure, so the rules can be read
// and reused without a DOM. Native validation is off (`novalidate`) because
// the spec asks for errors beside the field, not a browser bubble.

const isBlank = (value) => value.trim() === "";

const isHttpUrl = (value) => {
  try {
    return ["http:", "https:"].includes(new URL(value.trim()).protocol);
  } catch {
    return false;
  }
};

// Each check returns a message when it fails, or null when it passes.
// Format checks ignore empty input so `required` owns that message alone.
const required = (message) => (value) => (isBlank(value) ? message : null);

const format = (isValid, message) => (value) =>
  isBlank(value) || isValid(value.trim()) ? null : message;

const pattern = (regex, message) => format((value) => regex.test(value), message);

const minLength = (length, message) =>
  format((value) => value.length >= length, message);

export const rules = {
  repo: [
    required("Indica el repositorio."),
    format(isHttpUrl, "Debe ser una URL http o https."),
  ],
  commit: [
    required("Fija un commit: una rama se mueve."),
    pattern(/^[0-9a-f]{7,40}$/i, "7 a 40 caracteres hexadecimales."),
  ],
  root: [
    required("Indica la raíz del proyecto."),
    pattern(/^[\w.\-/]+$/, "Solo letras, números, guiones, puntos y barras."),
  ],
  contact: [
    required("Falta el correo."),
    pattern(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Revisa el formato."),
  ],
  scenario: [
    required("Elige un test o punto de entrada."),
    minLength(6, "Demasiado corto."),
  ],
};

const firstFailure = (checks, value) => checks.map((check) => check(value)).find(Boolean) ?? null;

export const validate = (values, fieldRules) =>
  Object.fromEntries(
    Object.entries(fieldRules)
      .map(([field, checks]) => [field, firstFailure(checks, values[field] ?? "")])
      .filter(([, failure]) => failure !== null),
  );

const setFieldError = (form, field, message) => {
  form.querySelector(`[data-error-for="${field}"]`).textContent = message;
  form.elements[field].setAttribute("aria-invalid", message ? "true" : "false");
};

const paintErrors = (form, errors) =>
  Object.keys(rules).forEach((field) => setFieldError(form, field, errors[field] ?? ""));

const readValues = (form) => Object.fromEntries(new FormData(form));

export const initImportForm = () => {
  const form = document.querySelector("[data-import-form]");
  if (!form) return;

  const status = form.querySelector("[data-form-status]");

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const errors = validate(readValues(form), rules);
    const failed = Object.keys(errors);
    paintErrors(form, errors);

    status.textContent = failed.length
      ? `Revisa ${failed.length} ${failed.length === 1 ? "campo" : "campos"}.`
      : "Snapshot preparado. El mock se detiene aquí: no hay backend.";

    if (failed.length) form.elements[failed[0]].focus();
  });

  // Clearing on input keeps the message from lingering while it is being fixed.
  form.addEventListener("input", (event) => {
    if (event.target.name in rules) setFieldError(form, event.target.name, "");
  });
};
