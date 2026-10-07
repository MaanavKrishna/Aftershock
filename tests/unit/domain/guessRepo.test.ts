import { test, expect } from "vitest";
import { guessRepoId } from "@/lib/domain/guessRepo";

const repos = [
  { id: "a", name: "Aftershock", fullName: "MaanavKrishna/Aftershock" },
  { id: "p", name: "aftershock-playground", fullName: "MaanavKrishna/aftershock-playground" },
];

test("the most specific repository named in the text wins", () => {
  expect(guessRepoId("Postmortem for aftershock-playground: shipping", repos)).toBe("p");
  expect(guessRepoId("See MaanavKrishna/Aftershock#12", repos)).toBe("a");
});

test("no mention means no guess", () => {
  expect(guessRepoId("checkout broke", repos)).toBeUndefined();
  expect(guessRepoId("aftershocks are scary", repos)).toBeUndefined();
});
