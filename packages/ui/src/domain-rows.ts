import type { Coverage } from "@pomset/contracts";
/** Co-locate only identical recorded constraint sets with non-conflicting property classifications. */
export function domainRows(regions: Coverage["regions"]): Coverage["regions"] {
  const rows: Coverage["regions"][number][] = [];
  for (const region of regions) {
    const key = JSON.stringify([...region.constraints].sort());
    const index = rows.findIndex((row) => JSON.stringify([...row.constraints].sort()) === key && !row.classifications.some((a) => region.classifications.some((b) => a.propertyId === b.propertyId && JSON.stringify(a) !== JSON.stringify(b))));
    const previous = rows[index];
    if (!previous) rows.push(region);
    else rows[index] = { ...previous, classifications: [...previous.classifications, ...region.classifications.filter((item) => !previous.classifications.some((existing) => JSON.stringify(existing) === JSON.stringify(item)))] };
  }
  return rows;
}
