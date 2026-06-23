import type { Express, Request, Response } from "express";

import {
  buildC3RedZoneCatalog,
  clampLimit,
  getC3Axis,
  getC3ChoicePattern,
  getC3OutlineComponents,
  listC3Axes,
  listC3ChoicePatterns,
  readQueryString,
} from "../lib/c3-redzone-taxonomy.js";

export function registerC3RedZoneTaxonomyRoutes(app: Express): void {
  app.get("/api/red-zones/catalog", (_req: Request, res: Response) => {
    res.json(buildC3RedZoneCatalog());
  });

  app.get("/api/c3/tensions", (req: Request, res: Response) => {
    res.json(
      listC3Axes({
        red_zone_id: readQueryString(req.query.red_zone_id),
        subject: readQueryString(req.query.subject),
        outline_code: readQueryString(req.query.outline_code),
        limit: clampLimit(req.query.limit),
      }),
    );
  });

  app.get("/api/c3/tensions/:axis_id", (req: Request, res: Response) => {
    const result = getC3Axis(readQueryString(req.params.axis_id) ?? "");
    if (!result) {
      res.status(404).json({ error: "axis not found" });
      return;
    }
    res.json(result);
  });

  app.get("/api/c3/traps", (req: Request, res: Response) => {
    res.json(
      listC3ChoicePatterns({
        red_zone_id: readQueryString(req.query.red_zone_id),
        subject: readQueryString(req.query.subject),
        outline_code: readQueryString(req.query.outline_code),
        mold_code: readQueryString(req.query.mold_code),
        filter_broken: readQueryString(req.query.filter_broken),
        limit: clampLimit(req.query.limit),
      }),
    );
  });

  app.get("/api/c3/traps/:choice_pattern_id", (req: Request, res: Response) => {
    const result = getC3ChoicePattern(readQueryString(req.params.choice_pattern_id) ?? "");
    if (!result) {
      res.status(404).json({ error: "choice pattern not found" });
      return;
    }
    res.json(result);
  });

  app.get("/api/c3/outlines/:outline_code/components", (req: Request, res: Response) => {
    const result = getC3OutlineComponents(readQueryString(req.params.outline_code) ?? "");
    if (!result) {
      res.status(404).json({ error: "outline components not found" });
      return;
    }
    res.json(result);
  });
}
