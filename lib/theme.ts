import { createHash } from "node:crypto";

/** Applies a saved theme before first paint; without one, CSS follows the system setting. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("as-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

/** Lets the strict app policy allow exactly this inline script and nothing else inline. */
export const THEME_SCRIPT_HASH = `'sha256-${createHash("sha256").update(THEME_SCRIPT).digest("base64")}'`;
