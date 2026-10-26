/** Display language only; unknown extension identifiers remain visible. */
const names: Readonly<Record<string, string>> = {
  outputCoverage: "Output coverage", memoryBounds: "Memory bounds", writeWriteConflict: "Write conflicts",
  readWriteConflict: "Read/write conflicts", raceFreedom: "Race freedom", numericalAgreement: "Numerical agreement",
  synchronizationOrdering: "Synchronization ordering", deadlockFreedom: "Deadlock freedom", initialization: "Initialization",
  performanceRegression: "Performance regression",
};
export function propertyLabel(id: string): string { return names[id] ?? id; }
