import { useEffect, useState } from "react";
import type { DomainVariable } from "@pomset/contracts";

interface Props {
  value: DomainVariable;
  onChange: (value: DomainVariable) => void;
  onInvalid: (message?: string) => void;
}

/** Keep the two canonical domain representations visibly distinct. */
export function ParameterFields({ value, onChange, onInvalid }: Props) {
  const [values, setValues] = useState(JSON.stringify(value.values ?? []));
  const declaredValues = JSON.stringify(value.values ?? []);
  useEffect(() => setValues(declaredValues), [declaredValues]);
  const enumerated = value.values !== undefined || value.type !== "int";
  function representation(mode: string) {
    if (mode === "values") {
      const { min, max: _max, step: _step, ...rest } = value;
      const choices = [min ?? 1];
      setValues(JSON.stringify(choices));
      onChange({ ...rest, values: choices });
    } else {
      const { values: choices, ...rest } = value;
      const numeric =
        choices?.filter((item): item is number => typeof item === "number") ??
        [];
      onChange({
        ...rest,
        min: numeric.length ? Math.min(...numeric) : 1,
        max: numeric.length ? Math.max(...numeric) : 1,
        step: 1,
      });
    }
    onInvalid();
  }
  return (
    <>
      {value.type === "int" && (
        <label>
          Domain
          <select
            aria-label={`${value.name} domain representation`}
            value={enumerated ? "values" : "range"}
            onChange={(event) => representation(event.target.value)}
          >
            <option value="range">Range</option>
            <option value="values">Values</option>
          </select>
        </label>
      )}
      {enumerated ? (
        <label>
          Values
          <input
            aria-label={`${value.name} values`}
            value={values}
            onChange={(event) => {
              setValues(event.target.value);
              try {
                const choices: unknown = JSON.parse(event.target.value);
                if (
                  !Array.isArray(choices) ||
                  !choices.length ||
                  choices.some((item: unknown) =>
                    value.type === "int"
                      ? !Number.isSafeInteger(item)
                      : !["string", "number", "boolean"].includes(typeof item),
                  )
                )
                  throw new Error(
                    "Enter a nonempty JSON array of domain values",
                  );
                onChange({ ...value, values: choices });
                onInvalid();
              } catch (error) {
                onInvalid(String(error));
              }
            }}
          />
        </label>
      ) : (
        <>
          <div className="field-row">
            <label>
              Min
              <input
                type="number"
                aria-label={`${value.name} minimum`}
                value={value.min ?? ""}
                onChange={(event) =>
                  onChange({ ...value, min: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Max
              <input
                type="number"
                aria-label={`${value.name} maximum`}
                value={value.max ?? ""}
                onChange={(event) =>
                  onChange({ ...value, max: Number(event.target.value) })
                }
              />
            </label>
          </div>
          <label>
            Step
            <input
              type="number"
              min={1}
              aria-label={`${value.name} step`}
              value={value.step ?? 1}
              onChange={(event) =>
                onChange({ ...value, step: Number(event.target.value) })
              }
            />
          </label>
        </>
      )}
      {value.type === "int" && (
        <label>
          Width
          <select
            aria-label={`${value.name} integer width`}
            value={value.width ?? "i32"}
            onChange={(event) =>
              onChange({
                ...value,
                width: event.target.value as "i32" | "u32" | "i64" | "u64",
              })
            }
          >
            {["i32", "u32", "i64", "u64"].map((width) => (
              <option key={width}>{width}</option>
            ))}
          </select>
        </label>
      )}
    </>
  );
}
