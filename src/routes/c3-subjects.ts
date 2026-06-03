// C3 Subject Overlays + DIAG bundles — read API.
//
// Attorney review approved 2026-06-02: the subject METHOD content (overlay,
// cards, drills, application table, residue) is public. Internal-only surfaces
// stay ADMIN_SECRET-gated: the validators, and the DIAG remediation bundles
// (their source_instances carry answer-choice text — internal tooling only).
import type { Express, Request, Response } from "express";
import {
  listSubjects, getOverlay, getCards, getDrills, getApplicationRows, getResidue,
  getWeakspots, isSubjectCode, type SubjectCode, type ApplicationFilter,
} from "../lib/c3-subjects.js";
import { validateAllSubjects } from "../lib/c3-subjects-validate.js";
import { allBundles, getBundle, bundleCount, validateBundles, c3PhaseCounts } from "../lib/diag-remediation.js";

function requireAdminSecret(req: Request, res: Response): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    res.status(503).json({ error: "admin access not configured (ADMIN_SECRET not set)" });
    return false;
  }
  if (req.headers["x-admin-secret"] !== secret) {
    res.status(403).json({ error: "forbidden" });
    return false;
  }
  return true;
}

function resolveCode(req: Request, res: Response): SubjectCode | null {
  const code = req.params.code;
  if (typeof code !== "string" || !isSubjectCode(code)) {
    res.status(404).json({ error: "unknown subject code" });
    return null;
  }
  return code;
}

export function registerC3SubjectsRoutes(app: Express): void {
  app.get("/api/c3/subjects", (_req, res) => {
    res.json({ subjects: listSubjects() });
  });

  app.get("/api/c3/subjects/:code", (req, res) => {
    const code = resolveCode(req, res);
    if (!code) return;
    const summary = listSubjects().find((s) => s.code === code);
    res.json({ summary, overlay: getOverlay(code) });
  });

  app.get("/api/c3/subjects/:code/cards", (req, res) => {
    const code = resolveCode(req, res);
    if (!code) return;
    const type = typeof req.query.type === "string" ? req.query.type.toUpperCase() : null;
    const cards = getCards(code).filter((c) => (type ? c.type.toUpperCase() === type : true));
    res.json({ subject: code, count: cards.length, cards });
  });

  app.get("/api/c3/subjects/:code/drills", (req, res) => {
    const code = resolveCode(req, res);
    if (!code) return;
    const drills = getDrills(code);
    res.json({ subject: code, count: drills.length, drills });
  });

  app.get("/api/c3/subjects/:code/application", (req, res) => {
    const code = resolveCode(req, res);
    if (!code) return;
    const filter: ApplicationFilter = {};
    for (const k of ["subtopic", "status", "call_class", "pattern_code"] as const) {
      const v = req.query[k];
      if (typeof v === "string" && v) filter[k] = v;
    }
    const rows = getApplicationRows(code, filter);
    res.json({ subject: code, count: rows.length, rows });
  });

  app.get("/api/c3/subjects/:code/residue", (req, res) => {
    const code = resolveCode(req, res);
    if (!code) return;
    res.json({ subject: code, residue: getResidue(code), weakspots: getWeakspots(code) });
  });

  // Internal QA: run every package's acceptance-criteria validators on demand.
  app.get("/api/admin/c3/subjects/validate", (req, res) => {
    if (!requireAdminSecret(req, res)) return;
    const subjects = validateAllSubjects();
    const diag = validateBundles();
    res.json({
      ok: subjects.ok && diag.ok,
      subjects,
      diag: { ...diag, bundle_count: bundleCount(), phase_counts: c3PhaseCounts() },
    });
  });

  // DIAG remediation bundles (draft, pending attorney review).
  app.get("/api/admin/diag/bundles", (req, res) => {
    if (!requireAdminSecret(req, res)) return;
    res.json({
      count: bundleCount(),
      phase_counts: c3PhaseCounts(),
      bundles: allBundles().map((b) => ({
        bundle_id: b.bundle_id, remediation_id: b.remediation_id, title: b.title,
        c3_phase: b.c3_profile?.c3_phase, route_family: b.c3_profile?.route_family,
        status: b.status,
      })),
    });
  });

  app.get("/api/admin/diag/bundles/:id", (req, res) => {
    if (!requireAdminSecret(req, res)) return;
    const id = req.params.id;
    const bundle = typeof id === "string" ? getBundle(id) : null;
    if (!bundle) { res.status(404).json({ error: "bundle not found" }); return; }
    res.json(bundle);
  });
}
