/** Platform-independent runtime validation of canonical schema documents. */
import { fullFormats } from "ajv-formats/dist/formats.js";
import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";

export type SchemaDocuments = ReadonlyMap<string, Record<string, unknown>>;
export interface SchemaSet { validatorFor(target: string): ValidateFunction; }

export function createSchemaSet(documents: SchemaDocuments): SchemaSet {
  const ajv = new Ajv2020({ strict: false, allErrors: false });
  ajv.addFormat("date-time", fullFormats["date-time"]!);
  const byFile = new Map<string, string>();
  for (const [id, schema] of documents) {
    ajv.addSchema(schema, id);
    const file = id.split("/").pop();
    if (file) byFile.set(file, id);
  }
  return { validatorFor(target: string): ValidateFunction {
    const [file, pointer] = target.split("#");
    const id = byFile.get(file ?? "");
    if (!id) throw new Error(`unknown schema file ${file}`);
    const validate = ajv.getSchema(`${id}#${pointer ?? ""}`);
    if (!validate) throw new Error(`no compiled validator for ${target}`);
    return validate;
  } };
}
