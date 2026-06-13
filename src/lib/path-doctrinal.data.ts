// J7 doctrinal lessons — content as code. Item 4: a short Criminal Law homicide
// primer authored as a variation of the Criminal Law master sheet
// (CrimLaw_MasterSheet.docx).
//
// ATTORNEY-GATED. This is substantive legal-doctrine content. The route
// (routes/doctrinal.ts) serves it only when DOCTRINAL_APPROVED=1; until then it
// returns 503 and the path engine treats the step as unavailable and routes
// around it. Do NOT set DOCTRINAL_APPROVED in production until attorney sign-off.

export interface DoctrinalLesson {
  slug: string;
  title: string;
  subject: string;
  estimated_minutes: number;
  body_md: string;
}

const CRIMINAL_DAY1: DoctrinalLesson = {
  slug: "criminal-law-day1",
  title: "Criminal Law — Homicide, Fast",
  subject: "Criminal Law",
  estimated_minutes: 8,
  body_md: `# Homicide, fast

Homicide is the most heavily tested Criminal Law area, and almost every hard
question turns on the **same few decision points**. Read this for the seams — the
exact place where one crime becomes another — because that seam is where the MBE
builds its traps.

## 1. The malice quartet — how murder is established

Murder is an unlawful killing committed with **malice aforethought**. Malice is
established by **any one** of four mental states:

1. **Intent to kill.**
2. **Intent to inflict serious bodily harm.**
3. **Depraved heart** — reckless indifference to an unjustifiably high risk to
   human life.
4. **Intent to commit a felony** — the felony-murder rule.

You do not need all four. One is enough. Wrong answers love to demand "specific
intent to kill" when intent to do serious bodily harm — or depraved-heart
recklessness — already supplies malice.

## 2. The degree tree

- **First-degree murder** is statutory. It requires **premeditation and
  deliberation** (a killing thought about, however briefly, in advance) **or** a
  killing committed during an **enumerated felony**.
- **Second-degree murder** is the default murder: malice is present, but there is
  no premeditation. **Depraved-heart** killings live here.

If a fact pattern gives you malice but **no premeditation**, the answer is
second-degree — not first.

## 3. Voluntary manslaughter — the provocation trap

Voluntary manslaughter is an **intentional** killing that would be murder **except
that** adequate provocation negates malice. All four of these must be present:

1. Provocation that would inflame a **reasonable person**;
2. The defendant was **in fact** provoked;
3. **Insufficient time** to cool off;
4. The defendant **did not in fact** cool off.

### The cooling-time trap

This is the single most tested homicide trap. If there is a **meaningful gap**
between the provocation and the killing, the law presumes a reasonable person
**would have cooled off** — so the killing is **murder, not manslaughter**.

> Classic fact pattern: the defendant is provoked, goes home or to work, and kills
> the next day. The time gap = cooled off = **murder**.

### Words alone

At common law, **words alone are almost never adequate provocation** — no matter
how insulting, demeaning, or revealing. A question that rests the manslaughter
theory on what the victim *said* is usually steering you to a wrong answer.

## 4. Involuntary manslaughter

An **unintentional** killing under one of two theories:

- **Criminal negligence** — a grossly negligent act that creates an unjustifiable
  risk; or
- **Misdemeanor-manslaughter** — a death during an unlawful act that is **not** a
  felony.

## 5. Felony murder

A killing — **even an accidental one** — committed during the commission or
attempted commission of an **inherently dangerous felony** (commonly burglary,
arson, robbery, rape, kidnapping). Watch the limits the MBE tests: the felony must
be independent of the killing, and many jurisdictions cut off liability once the
felon reaches a point of temporary safety.

---

**The one move:** when you see a killing, find the **mental state** first (which
branch of the quartet?), then ask whether **provocation** drops it to manslaughter,
and check the **cooling-time** and **words-alone** traps before you commit. The
credited answer is the one that is **true** on the doctrine and **responsive** to
what the call actually asks.`,
};

const LESSONS: Record<string, DoctrinalLesson> = {
  [CRIMINAL_DAY1.slug]: CRIMINAL_DAY1,
};

export function getDoctrinalLesson(slug: string): DoctrinalLesson | null {
  return LESSONS[slug] ?? null;
}

/** True when doctrinal content is cleared for serving (attorney sign-off). */
export function isDoctrinalApproved(): boolean {
  return process.env.DOCTRINAL_APPROVED === "1";
}
