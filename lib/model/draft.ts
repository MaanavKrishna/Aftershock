import type { Drafter } from "@/lib/timetravel/deps";

// Replaced by the model layer in plan Task 9.
export function modelDrafter(): Drafter {
  return {
    draft: async () => {
      throw new Error("No model is configured. Connect one in Integrations to draft tests.");
    },
  };
}
