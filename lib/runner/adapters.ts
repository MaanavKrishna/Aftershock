import { frameworkDef, q, type Framework } from "./frameworks";

export { q };

export function imageFor(f: Framework): string {
  return frameworkDef(f).dockerImage;
}

/** Install phase (network allowed). */
export function setupFor(f: Framework, install: string): string {
  return frameworkDef(f).setup(install);
}

/** Test phase (network blocked). One file, one JUnit report. */
export function commandFor(f: Framework, testPath: string, junitPath: string): string {
  return frameworkDef(f).command(testPath, junitPath);
}
