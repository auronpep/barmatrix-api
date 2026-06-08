import type { Express } from "express";
import { getMiniDrill, shapeMiniDrill } from "../lib/path-mini-drills.data.js";

// GET /api/study/mini-drill/:drillId
// Public — mini-drill content is static rule content, not test items.
// Returns the full drill (questions + answers + explanations) so the client
// can reveal answers after the student selects a choice.
export function registerMiniDrillRoutes(app: Express): void {
  app.get("/api/study/mini-drill/:drillId", (req, res) => {
    const { drillId } = req.params;
    if (typeof drillId !== "string") {
      res.status(400).json({ error: "invalid_drill_id" });
      return;
    }

    const drill = getMiniDrill(drillId);
    if (!drill) {
      res.status(404).json({ error: "drill_not_found" });
      return;
    }

    res.json(shapeMiniDrill(drill));
  });
}
