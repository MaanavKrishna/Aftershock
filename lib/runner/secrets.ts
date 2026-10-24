/** Removes a secret from text that will be stored or shown (run logs, failure excerpts). */
export function redactToken(text: string, token: string | undefined): string {
  if (!token || token.length < 8) return text;
  return text.split(token).join("[redacted]");
}

/**
 * Runs before any repository or model code: drops the authenticated remote and any stored
 * credentials, so a test cannot read the clone token from the checkout.
 */
export const SCRUB_GIT_CREDENTIALS =
  "git remote remove origin >/dev/null 2>&1; git config --global --unset-all credential.helper >/dev/null 2>&1; rm -f ~/.git-credentials .git/credentials; true";
