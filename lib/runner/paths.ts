import path from "node:path";

/** A relative path inside the repository, never absolute, never escaping with "..". */
export function safeTestPath(p: string): string {
  const norm = path.posix.normalize(p.replace(/\\/g, "/"));
  if (!norm || norm.startsWith("/") || norm.startsWith("..") || norm.split("/").includes("..") || norm.startsWith(".git/") || norm === ".git") {
    throw new Error(`Unsafe test path: ${p}`);
  }
  return norm;
}
