// GENERATED FILE — do not edit by hand.
// Source: scripts/build_foundations.py over the C3 lesson markdown.
// Regenerate: uv run python scripts/build_foundations.py

import type { FoundationsCourse } from "./foundations.js";

export const FOUNDATIONS_COURSE: FoundationsCourse = {
  "slug": "the-method",
  "title": "The Method",
  "subtitle": "Cut → Clash → Call — the BarMatrix wrong-answer method",
  "tagline": "Before you touch the bank, learn the one frame the whole platform runs on: the credited answer is the choice that is TRUE and RESPONSIVE, and every wrong answer is engineered to fail one of those two tests.",
  "version": "v2",
  "lesson_count": 14,
  "drill_item_count": 700,
  "est_total_minutes": 425,
  "parts": [
    {
      "roman": "I",
      "title": "Foundations — the frame",
      "lesson_numbers": [
        1,
        2,
        3
      ]
    },
    {
      "roman": "II",
      "title": "The Ear — cut the not-true answers",
      "lesson_numbers": [
        4,
        5,
        6
      ]
    },
    {
      "roman": "III",
      "title": "Issue-Sense — cut the not-responsive answers",
      "lesson_numbers": [
        7,
        8,
        9,
        10
      ]
    },
    {
      "roman": "IV",
      "title": "Architecture — the meta-skill",
      "lesson_numbers": [
        11,
        12
      ]
    },
    {
      "roman": "V",
      "title": "Calibration & integration",
      "lesson_numbers": [
        13,
        14
      ]
    }
  ],
  "lessons": [
    {
      "slug": "lesson-01",
      "number": 1,
      "part": "I",
      "part_title": "Foundations — the frame",
      "title": "The One Idea: TRUE and RESPONSIVE",
      "objective": "Adopt the one frame: the credited answer is TRUE and RESPONSIVE; name the break on every choice you cut.",
      "est_minutes": 30,
      "body_md": "### Where this sits\n\nThis lesson plants the single frame the entire course runs on. Everything after it — the mold families, the tension points, the anchor deck, the timing drills — is machinery for executing this one idea faster and catching subtler versions of it. If you internalize Lesson 1 and nothing else, you will already answer MBE questions differently than most test-takers. The rest of the course is speed and edge cases.\n\n### The one idea\n\nOn every MBE question, exactly one answer choice is at once a correct statement of the law — **TRUE** — and an answer to the precise question asked — **RESPONSIVE**. The other three are not weaker versions of the right answer. They are engineered, each to fail one of those two tests. A distractor is either **not true** (it misstates the law) or **true but not responsive** (it states the law correctly but does not answer *this* question).\n\nThat is the whole game. You are not ranking four answers by quality and picking the best one. You are running each of the four through two filters and finding the one that survives both. Three will break a filter. Name the break for each, and the survivor is forced — you don't choose it, you're left with it.\n\n### Why this is the right frame, and \"pick the best answer\" is a trap\n\nThe most dangerous distractor on the exam is *true*. If your test is \"does this sound like correct law,\" a true-but-not-responsive choice passes — it *is* correct law — and you may cut the credited answer because it addresses a narrower, less familiar, or more specific point. You end up choosing the fluent restatement of a rule you recognize over the answer that actually resolves the question.\n\nSo the question you ask of each choice is not \"is this true?\" It is \"does this answer the question they asked?\" Truth is necessary but not sufficient. A choice earns the credit only by clearing both filters. Most of the points lost on this exam are lost right here: a true distractor felt safe, and the real answer got cut.\n\n### Two filters, two skills\n\nThe two filters correspond to two distinct skills, named now and trained across the rest of the course:\n\n- The **Ear** hears when a choice is *not true* — when it overclaims, reverses a standard, invents a requirement, or flatly misstates a rule. The Ear is **fact-independent**: you can often hear a false answer without reading the fact pattern at all, because a false statement of law is false regardless of the facts. Lessons 4–6 build the Ear.\n\n- **Issue-Sense** sees when a choice is *true but not responsive* — a correct statement of law aimed at the wrong question. Issue-Sense is **fact-dependent**: you cannot catch it without the stem, because \"responsive\" is defined entirely by the facts. The same true proposition is the right answer to one question and a trap on another. Lessons 7–10 build Issue-Sense.\n\nThese two skills fail differently and you train them differently. The Ear is drillable on bare answer choices. Issue-Sense is not — it needs the fact pattern, every time. Hold that distinction; it shapes how you study.\n\n### The discipline that makes the method work\n\nOne rule, starting with the very first question you drill: **for every choice you reject, name the filter it breaks.**\n\nNot \"this feels off.\" Not \"I'm pretty sure it's D.\" For each of the three you eliminate, you must be able to say one of two things — *\"false: here is the misstatement,\"* or *\"true, but it answers the wrong question: here is the question it actually answers.\"*\n\nIf you cannot name the break, you have not eliminated the choice. You have guessed, and you are exposed to exactly the failure described above — cutting the true-and-responsive answer because a true-but-not-responsive one felt safer. Naming the break is not a study-time nicety you abandon on exam day. It is the mechanism itself. Under time pressure it compresses to a flash — *\"false rule,\" \"right area, wrong question\"* — but it never disappears. A test-taker who can't articulate why three answers are wrong is not solving the question; they're recognizing a vibe, and vibes are what the distractors are built to exploit.\n\n### Worked example\n\nA motion to dismiss for failure to serve process: the plaintiff's lawyer filed the complaint on time but then forgot to serve the defendant for four months. One choice reads, in substance, *\"Deny — under the Federal Rules, filing the complaint commences the action, and the complaint was filed within the limitations period.\"*\n\nEvery word of that is correct law. It is also the wrong answer. The motion is not about *filing*; it is about *service*. Filing did commence the action — but the question on the table is whether a four-month, unexplained failure to serve warrants dismissal, and it does, because forgetting is not good cause. The credited answer addresses the service failure directly. The filing choice is the trap: true, fluent, and aimed at a question no one asked.\n\nRun the filters:\n\n- *\"Filing commenced the action and was timely.\"* — **TRUE, but NOT RESPONSIVE.** It answers \"was the action timely commenced?\" The question is \"should it be dismissed for failure to serve?\"\n- *\"No good cause was shown for the failure to serve.\"* — **TRUE, and RESPONSIVE.** It answers the question actually asked.\n\nThe remaining two distractors each break a filter of their own (one misstates the consequence of notice, one misstates the limitations rule). You did not feel your way to the answer. You named three breaks, and the fourth survived. That is Lesson 1.\n\n---",
      "drills": [
        {
          "id": "1.1",
          "title": "Is it TRUE? (Pure law. No fact pattern.)",
          "instructions_md": "Mark each proposition **T** or **F**. This is the Ear's raw material: hearing correct law from incorrect law with no stem to lean on.",
          "items": [
            "1. A merchant's signed written promise to hold an offer open is irrevocable without consideration for the time stated, up to three months.",
            "2. Courts assess the adequacy of consideration to ensure the exchange is fair.",
            "3. The parol evidence rule bars evidence of a *subsequent* oral modification.",
            "4. A private recorded restrictive covenant is an encumbrance that can render title unmarketable.",
            "5. A zoning ordinance restricting the use of land renders the seller's title unmarketable.",
            "6. The Seventh Amendment right to a civil jury has been incorporated against the states.",
            "7. Under Rule 50(b), a party may join a renewed motion for judgment as a matter of law with a motion for a new trial.",
            "8. A parent is vicariously liable for all torts committed by the parent's minor child.",
            "9. Keeping a wild animal subjects the keeper to strict liability for harm caused by the animal's dangerous propensities.",
            "10. A testifying witness's memory loss renders the witness not \"subject to cross-examination\" for purposes of admitting a prior statement."
          ],
          "item_count": 10,
          "key_md": "1. **T** — UCC 2-205 firm offer.\n2. **F** — courts do not weigh adequacy; a peppercorn suffices.\n3. **F** — the PER bars prior/contemporaneous terms, not later modifications.\n4. **T** — a covenant is an encumbrance affecting marketability.\n5. **F** — zoning is a public regulation, not a title defect.\n6. **F** — the Seventh Amendment is not incorporated.\n7. **T** — Rule 50(b) expressly allows joining a Rule 59 motion.\n8. **F** — no general vicarious parental liability; liability is for the parent's own negligence.\n9. **T** — strict liability for the dangerous propensity.\n10. **F** — *United States v. Owens*: memory loss does not remove a witness from cross."
        },
        {
          "id": "1.2",
          "title": "Which filter breaks? (Short stem + one wrong choice.)",
          "instructions_md": "For each item, the choice given is **wrong**. Classify it: **[NOT TRUE]** or **[TRUE BUT NOT RESPONSIVE]**.",
          "items": [
            "1. *Motion to dismiss for failure to serve; the lawyer forgot to serve for four months.* — \"Deny: filing the complaint commenced the action, and it was filed in time.\"",
            "2. *Is a federal regulation that applies a generally-applicable rule to state governments valid?* — \"No: the federal government has sovereign immunity and can't be sued without consent.\"",
            "3. *Plaintiff sues over an ad that used his identity but not his name.* — \"For the defendant: appropriation requires use of the plaintiff's name.\"",
            "4. *Tenants run an illegal gambling operation; may the landlord terminate the lease?* — \"Yes: terminate the lease and keep the security deposit as a forfeit.\"",
            "5. *May a party join a renewed JMOL with a new-trial motion?* — \"No: a party may file only one of the two.\"",
            "6. *Buyer wants out of a land-sale contract because zoning bars her intended use.* — \"For the buyer: the zoning restriction makes the title unmarketable.\"",
            "7. *Is the President's refusal to spend appropriated funds constitutional?* — \"Yes: the President has inherent executive power to control federal expenditures.\"",
            "8. *Plaintiff seeks the opinions of an expert the defense retained but will not call.* — \"The plaintiff is entitled to full disclosure of the expert's qualifications, opinions, and bases.\"",
            "9. *A class representative seeks a jury; the damages claim is legal but certification is contested.* — \"No jury at all: class actions are historically equitable devices.\"",
            "10. *A deposition question seeks an association's contributor names; the association objects on First-Amendment grounds.* — \"Overruled: the proper time to object to testimony is at trial.\""
          ],
          "item_count": 10,
          "key_md": "1. **TRUE BUT NOT RESPONSIVE** — true about *filing*; the question is *service*.\n2. **TRUE BUT NOT RESPONSIVE** — sovereign immunity is a real doctrine, but the issue is Congress's power over states.\n3. **NOT TRUE** — indicia of identity suffice; the name is not required.\n4. **NOT TRUE** — a security deposit is not automatically forfeitable (overclaim).\n5. **NOT TRUE** — Rule 50(b) allows joining the new-trial motion.\n6. **NOT TRUE** — zoning is not a title defect.\n7. **NOT TRUE** — there is no inherent impoundment power.\n8. **TRUE BUT NOT RESPONSIVE** — that is the *testifying*-expert rule; this expert is non-testifying (right rule, wrong category).\n9. **NOT TRUE** — the legal damages claim carries a jury right; \"no jury at all\" overstates.\n10. **NOT TRUE** — discovery objections are made during discovery, not deferred to trial."
        },
        {
          "id": "1.3",
          "title": "Spot the residual. (Full compact question; name every break.)",
          "instructions_md": "For each, pick the survivor and, in the key, confirm the break on each of the three distractors.",
          "items": [
            "1. A flour wholesaler \"assigned\" all its sale contracts to a reputable miller; the buyer refuses the first delivery. May the buyer reject?\n A) Yes — requirements contracts can't be assigned. B) Yes — duties transfer only by the delegatee's express promise. C) Yes — \"assignment\" transfers rights only, never duties. D) No — assignable so long as quantity isn't disproportionately changed.",
            "2. After a defense verdict (plaintiff moved for JMOL before submission), may she file a renewed JMOL *and* a new-trial motion?\n A) No — new-trial only. B) No — only one. C) Yes — both. D) Yes — and combine with a motion for relief from judgment.",
            "3. A merchant retailer's signed letter assures firm catalog prices \"throughout the coming year\"; a month later it tries to raise prices for the following month's orders. Effective for that month?\n A) No — irrevocable under promissory estoppel. B) No — merchant firm offer, irrevocable for that month. C) Yes — no consideration for the assurance. D) Yes — the assurance ran longer than three months.",
            "4. A closely-supervised eight-year-old's grocery cart injures a shopper; assume the child was negligent and the mother under-supervised. Suing the mother in negligence, does the shopper prevail?\n A) Yes — the child was negligent. B) Yes — the mother is liable for any harm her child causes. C) Yes — the mother assumed the risk. D) Yes — the mother failed to adequately supervise.",
            "5. A land-sale contract promises a warranty deed without exceptions; the buyer's search reveals a recorded restrictive covenant. Must she buy?\n A) No — the covenant renders title unmarketable. B) No — the zoning clouds title. C) Yes — she'd get a warranty deed without exceptions. D) Yes — the contract was silent on title quality.",
            "6. A child's interred body is left improperly secured, taken by vandals, and found nearby; the mother suffers severe emotional distress. Does she prevail against the mausoleum?\n A) No — no threat to her own safety. B) No — the conduct wasn't extreme and outrageous. C) Yes — the mausoleum negligently failed to safeguard the body. D) No — she suffered no physical harm.",
            "7. A retailer-sold safety device fails from a manufacturing defect; the climber falls; a rescuer is hurt reaching him. Suing the retailer, does the rescuer prevail?\n A) No — the retailer couldn't find the defect on reasonable inspection. B) No — the rescuer didn't rely on any implied representation. C) Yes — the climber wasn't negligent in failing to test it. D) Yes — injury to someone in the rescuer's position was foreseeable.",
            "8. Parties agree on a building plus sidewalk paving for $200k; later they orally agree to drop the paving but keep the $200k; the contractor builds but won't pave. Breach?\n A) No — the oral modification was good-faith and enforceable. B) Yes — discharge must be in writing. C) Yes — the parol evidence rule bars the modification. D) Yes — no consideration supported discharging the paving duty.",
            "9. An attorney directs a deponent not to answer non-privileged questions, never moves to limit the deposition, defies an order to compel, and the client refuses for months. Opponent moves for **Rule 11** sanctions. Granted?\n A) No — should have been under Rule 26(g). B) No — Rule 11 doesn't apply to discovery, only pleadings. C) Yes — the court must prevent the deponent benefiting from the refusal. D) Yes — the court may convert a Rule 11 motion into a Rule 37(b) motion.",
            "10. An assault victim with no memory of the attack would testify that, before losing consciousness, he told a passerby the defendant hit him. Defense objects: hearsay, no personal knowledge. Admissible?\n A) No — no showing he more-likely-than-not had personal knowledge. B) No — memory loss means he can't be effectively cross-examined. C) Yes — he's subject to cross and personal knowledge is sufficiently shown. D) Yes — it's his own out-of-court statement."
          ],
          "item_count": 10,
          "key_md": "1. **D.** A/B/C all misstate UCC 2-210 (assignable; no express promise needed; a general assignment delegates duties too).\n2. **C.** A/B false (50(b) allows joining); D misfit (Rule 60 isn't the post-verdict vehicle).\n3. **B.** A misfit (it's 2-205, not PE); C backwards (firm offers need no consideration); D — the cap is three months and the relevant month falls inside it, so the increase doesn't reach it.\n4. **D.** A wrong-element (the child's fault isn't the mother's); B overclaim (no general vicarious liability); C misfit (assumption of risk isn't an affirmative basis).\n5. **A.** B false (zoning ≠ title defect); C misfit (deed type doesn't cure an encumbrance); D backwards (marketable title is implied despite silence).\n6. **C.** A misfit (zone-of-danger doesn't govern); B bait-doctrine (that's IIED; this is negligent mishandling); D backwards (the corpse exception waives physical harm).\n7. **D.** A misfit (inspection is a negligence defense, not strict liability); B backwards (no reliance required); C misfit (wrong party's conduct).\n8. **D.** A misfit (UCC good-faith-modification rule on a services contract); B false (no general writing requirement); C backwards (PER doesn't bar a subsequent modification).\n9. **B.** A near-miss (right that Rule 11 is out, but 26(g) isn't the vehicle for a deposition refusal — Rule 37 is); C misfit (policy gloss, not the rule); D fabrication (no such conversion).\n10. **C.** A half-truth (misstates the showing); B backwards (*Owens*); D fabrication (one's own statement isn't itself an exception)."
        },
        {
          "id": "1.4",
          "title": "The true-versus-true cut. (Isolate the RESPONSIVE choice.)",
          "instructions_md": "Each item gives a stem and **two** choices. Both state real legal propositions — or one states a real rule misapplied to these facts. Picking by \"which is true law\" will not work. Pick the one that **answers the question asked.**",
          "items": [
            "1. *Failure-to-serve motion; the lawyer forgot for four months.* (A) Filing commenced the action and was timely. (B) No good cause was shown for the failure to serve.",
            "2. *Federal generally-applicable fleet regulation applied to a city; the city seeks an injunction.* (A) Valid under the commerce clause; no Tenth Amendment violation. (B) The federal government has sovereign immunity and can't be sued without consent.",
            "3. *In **state** court, the employee demands a jury under the Seventh Amendment in a suit seeking an injunction.* (A) The Seventh Amendment hasn't been incorporated against the states. (B) The Seventh Amendment reaches only suits at common law, and this is equity.",
            "4. *Plaintiff seeks the opinions of an expert the defense retained but will not call.* (A) Discoverable on substantial need and undue hardship. (B) Discoverable only on exceptional circumstances making the facts/opinions impracticable to obtain otherwise.",
            "5. *Shopper sues the under-supervising **mother**; the child was negligent.* (A) The child was negligent. (B) The mother failed to adequately supervise.",
            "6. *Amendment: original claim = failure to disclose an alternative method (informed consent); new claim = negligent surgical performance.* (A) The amendment relates back to the original complaint. (B) The new claim didn't arise from the same event as the original.",
            "7. *Resident sues under a **state** statute that copies a federal one (minus the interstate limit); claims federal-question jurisdiction.* (A) The claim incorporates an essential, determinative element of federal law. (B) The claim does not concern a federal question.",
            "8. *In **state** court, the contractor demands a jury for a contract dispute; state rules grant a jury in contract cases.* (A) The Seventh Amendment isn't incorporated against the states. (B) State law provides for jury trials in contract disputes.",
            "9. *The plaintiff moves to add, by **supplemental** pleading, an intentional tort the defendant committed **after** the original filing.* (A) The tort occurred after the original lawsuit was filed. (B) It is a timely supplemental pleading.",
            "10. *Buyer's purchase order (offer); seller mails acceptance the same day; the next day, before the letter arrives, the buyer phones a revocation. Contract?* (A) The order was an irrevocable offer for a reasonable time. (B) The seller accepted by mailing before the buyer's attempted revocation."
          ],
          "item_count": 10,
          "key_md": "1. **B** — the motion is about service, not filing. (A) answers the wrong question.\n2. **A** — the issue is Congress's power over states; sovereign immunity (B) isn't in play.\n3. **A** — he invoked the Seventh Amendment in **state** court; the dispositive point is that it doesn't reach state courts at all. (B) is true but isn't the precise rebuttal to his specific demand.\n4. **B** — non-testifying/consulting-expert standard. (A) is the fact-work-product standard, the wrong protection.\n5. **B** — the claim is against the **mother**; her own negligence is the responsive basis. The child's negligence (A) doesn't establish it.\n6. **B** — different occurrences (pre-surgery disclosure vs surgical performance), so no relation-back. (A) is the right rule applied to the wrong facts.\n7. **B** — copied text is not a substantial, disputed federal issue. (A) invokes a Grable hook the facts don't support.\n8. **B** — the question is entitlement to a jury; state law grants it. (A) answers \"is there a *federal* right,\" not the question asked.\n9. **B** — Rule 15(d) is exactly for post-filing events. (A) is true, but it's the *trigger* for a supplemental pleading, not a bar.\n10. **B** — mailbox rule: acceptance is effective on dispatch, before the revocation. (A) is false — a buyer's order is not a firm offer."
        },
        {
          "id": "1.5",
          "title": "Mixed: keep or break? (Includes credited answers.)",
          "instructions_md": "Not every choice here is wrong. For each, classify: **[SURVIVES]** (true and responsive — this is the credited answer), **[NOT TRUE]**, or **[TRUE BUT NOT RESPONSIVE]**.",
          "items": [
            "1. *Ad used the plaintiff's identity but not his name.* — \"For the defendant: appropriation requires using the plaintiff's name.\"",
            "2. *Same ad.* — \"For the plaintiff: there are sufficient indicia of his identity to support liability.\"",
            "3. *Failure-to-serve motion.* — \"Filing commenced the action and it was timely.\"",
            "4. *President refuses to spend appropriated funds.* — \"He is obligated to spend the funds as Congress directed.\"",
            "5. *First-degree murder = poison or premeditation; laxatives given to cause discomfort, idiosyncratic death.* — \"Guilty: both poison and premeditation.\"",
            "6. *State sold its gas field by bid and chose a lower local bidder.* — \"For the state: it acted as a market participant.\"",
            "7. *Federal generally-applicable regulation applied to states.* — \"Sovereign immunity bars suit without consent.\"",
            "8. *Hiker struck by a limb while trespassing; natural termite-weakened condition.* — \"For the owner: no duty was breached to a trespasser.\"",
            "9. *May a party join a renewed JMOL with a new-trial motion?* — \"Only one motion may be filed, not both.\"",
            "10. *Residential-picketing ban with an exception for zoning-topic picketing.* — \"Challenge succeeds: the ordinance is content-based.\""
          ],
          "item_count": 10,
          "key_md": "1. **NOT TRUE** — indicia of identity suffice; no name required.\n2. **SURVIVES** — true and responsive (the appropriation claim stands).\n3. **TRUE BUT NOT RESPONSIVE** — answers filing, not service.\n4. **SURVIVES** — the anti-impoundment rule answers the question.\n5. **NOT TRUE** — laxatives aren't poison and intending discomfort isn't premeditation; neither predicate is met.\n6. **SURVIVES** — market-participant doctrine takes it outside the dormant commerce clause.\n7. **TRUE BUT NOT RESPONSIVE** — a real doctrine, but the issue is Congress's power over states.\n8. **SURVIVES** — limited duty to a trespasser resolves it.\n9. **NOT TRUE** — Rule 50(b) allows both.\n10. **SURVIVES** — the content-based exception triggers strict scrutiny; the challenge prevails."
        }
      ],
      "how_to_use_md": "Run the drills cold, then check keys and **say the missed filter aloud** — the verbalization is the training. Drill 1.1 should approach 100%; if it doesn't, that's an Ear gap to close before moving on. Drills 1.3 and 1.4 are the ones that predict exam performance: 1.4 in particular isolates the skill that decides hard questions — refusing to pick a choice merely because it states real law. When 1.4 feels automatic, you're ready for Lesson 2, which names the two skills formally and lays out the Cut→Clash→Call workflow you'll run on every question.",
      "drill_item_count": 50
    },
    {
      "slug": "lesson-02",
      "number": 2,
      "part": "I",
      "part_title": "Foundations — the frame",
      "title": "Two Skills, One Workflow: the Ear, Issue-Sense, and Cut → Clash → Call",
      "objective": "Run the two skills (the Ear, Issue-Sense) through one procedure: Cut → Clash → Call.",
      "est_minutes": 32,
      "body_md": "### Where this sits\n\nLesson 1 gave you the frame: the credited answer is the one choice that is TRUE and RESPONSIVE; the other three are engineered to fail one of those tests. Lesson 2 gives you the two faculties that execute the frame and the three-phase procedure you run on every question. From here, Part II sharpens the first faculty and Part III the second. This lesson is the operating manual they both plug into.\n\n### The two skills, formally\n\n**The Ear** detects *not true*. It hears when a choice overclaims, reverses a standard, invents a requirement, or flatly misstates a rule. The Ear is **fact-independent** — a false statement of law is false no matter what the facts are — so it can run before you have even read the fact pattern, on the answer choices alone.\n\n**Issue-Sense** detects *not responsive*. It sees when a choice is a correct statement of law aimed at the wrong question, or a correct rule misapplied to these particular facts. Issue-Sense is **fact-dependent** — \"responsive\" is defined entirely by the stem — so it cannot run on answer choices alone. It needs the facts, every time.\n\n#### The operational test for which skill applies\n\nYou will constantly need to know which of the two is doing the work. The test is one question:\n\n> **Do you need the facts to see the error?**\n\nIf the choice is wrong on its face — a misstatement of a rule that no fact pattern could rescue — that is the **Ear**, and you don't need the stem. *\"A merchant's firm offer requires consideration\"* is false in every universe; the Ear kills it cold.\n\nIf the choice states a real rule that is simply pointed at the wrong question, or true in the abstract but wrong on these facts — that is **Issue-Sense**, and you cannot see the error without the stem. *\"The claim relates back to the original complaint\"* is a true rule; whether it's the right answer depends entirely on whether these two claims arose from the same occurrence, which only the facts can tell you.\n\nThis is also why a strong Ear with weak Issue-Sense is the common failure profile: it aces rule questions and gets trapped by true-but-off distractors, because the Ear has nothing to say about a statement that is true. The two skills fail independently, so you build them independently.\n\n### The workflow: Cut → Clash → Call\n\nEvery question, the same three phases, in this order.\n\n**CUT.** Run both filters across all four choices. The Ear cuts the not-true; Issue-Sense cuts the not-responsive. **Most questions end here** — three choices break a filter and one survives. A clean cut to a single answer is the goal, and it happens far more often than test-takers expect. Name three breaks and you are done; do not keep deliberating.\n\n**CLASH.** When the cut leaves exactly two survivors, they disagree on exactly one axis — a tension point. The two are usually the same rule applied to opposite facts, or two true rules competing for the same question. Name the axis, locate the one fact in the stem that sits on it, and the fact decides. This is the phase where the stem is load-bearing.\n\n**CALL.** When the clash does not resolve — the fact is genuinely ambiguous, or both survivors seem to fit — apply a structural tiebreaker. Call is a **last resort**, and pure-Call situations are rare. If the tiebreaker is itself a coin, flag the question, take the lean, and move on. A flagged coin is an honest 50/50, not a failure.\n\n### The decision rule: the survivor count tells you the phase\n\n- **Torn among three or four** → you are not done **cutting**. Go back; you skipped a filter. This is the single most common avoidable error — agonizing among answers when one of them should already be dead.\n- **Down to exactly two** → **clash**. Name the axis and find the fact.\n- **Axis won't resolve on the facts** → **call**. Apply a tiebreaker.\n- **Tiebreaker is a coin** → flag, lean, move on.\n\nMost misses come from being in the wrong phase for the question in front of you: clashing two answers when a third should have been cut, or guessing when a clean cut was sitting there. The count is your diagnostic.\n\n### Four high-yield Call heuristics\n\nThe full anchor deck is Lesson 12. Four tiebreakers carry most of the load and are worth having now:\n\n- **Hedged > absolute.** Between two responsive answers, the one with a qualifier — *\"unless,\" \"generally,\" \"provided that\"* — usually beats the unqualified absolute, because legal rules carry exceptions and the absolute version overstates.\n- **Default tier > heightened.** When the question turns on a standard of review or burden, and no trigger is shown, the default governs: rational basis over strict scrutiny, preponderance over clear-and-convincing, Pike balancing over strict scrutiny for a non-discriminatory commerce burden.\n- **Threshold > merits.** When one answer disposes of the case on a threshold ground — standing, jurisdiction, timeliness, waiver — and another reaches the merits, the threshold answer usually controls. You never reach the merits if the threshold ends it.\n- **Fact-engaged > abstract.** Between a choice that ties the rule to these specific facts and one that recites the rule in the abstract, the fact-engaged choice is usually credited. The exam rewards application, not recitation.\n\n### Worked example (Cut → Clash, the fact resolves)\n\nA land-sale contract is signed May 1. On June 1 the seller sends a letter repudiating. On June 5 the buyer buys a second tract at a higher price as a substitute. On June 10 the seller communicates a retraction of the repudiation. The buyer never tenders on July 1 and then sues. Will the buyer prevail?\n\n- A) No — the seller retracted before the time for performance.\n- B) No — the buyer's tender was a constructive condition to the seller's duty.\n- C) Yes — a repudiation can't be retracted once communicated.\n- D) Yes — the buyer bought the substitute before the seller's retraction.\n\n**Cut.** Choice C is *not true* — a repudiation **is** retractable until the other party relies on it; the Ear kills C with no facts needed. Choice B is *not responsive* — constructive conditions are real, but the question is about retracting a repudiation, not about a condition to the seller's duty; Issue-Sense kills B. Two down.\n\n**Clash.** A and D survive, and they disagree on one axis: **was the retraction effective?** A retraction is effective *unless* the other party has materially changed position in reliance. The axis is reliance. Now go to the stem for the fact that sits on it: the buyer bought a substitute tract on June 5 — **before** the June 10 retraction. That is material reliance. The retraction came too late; it is ineffective; the buyer prevails. **D.**\n\nYou did not weigh which answer \"felt\" stronger. You cut two on named breaks, named the axis the last two disagreed on, and let one fact decide. That is the whole workflow.\n\n### When the fact doesn't decide: a Call\n\nSuppose instead a Con Law question leaves two survivors — one upholds a law under rational basis, the other strikes it under strict scrutiny — and the facts identify no suspect classification and no fundamental right. The stem handed you no deciding fact. Reach for a Call: **default tier governs unless a trigger is shown.** Nothing triggers heightened review, so rational basis applies and the law stands. You didn't find a fact; you applied a structural default. That is what Call is for, and it is the exception, not the rule.\n\n---",
      "drills": [
        {
          "id": "2.1",
          "title": "Which skill catches it? (Ear or Issue-Sense.)",
          "instructions_md": "Each choice is wrong. Label the faculty that catches it: **[EAR]** (false on its face) or **[ISSUE-SENSE]** (true in the abstract, wrong here). Use the operational test: *do you need the facts to see the error?*",
          "items": [
            "1. *(Land sale, repudiation.)* \"Yes — a repudiation can't be retracted once communicated.\"",
            "2. *(Federal regulation applied to states.)* \"No — sovereign immunity bars suit without consent.\"",
            "3. *(Firm offer.)* \"Yes — the price assurance was unsupported by consideration.\"",
            "4. *(Failure-to-serve motion.)* \"Deny — filing commenced the action and it was timely.\"",
            "5. *(Escaped wild snake; strict liability.)* \"No — the escape was caused by a force of nature.\"",
            "6. *(Expert the defense retained but won't call.)* \"Discoverable — the estate gets full disclosure of the expert's opinions and bases.\"",
            "7. *(Parent of a negligent child.)* \"Yes — the mother is liable for any harm her child causes.\"",
            "8. *(SCOTUS review of a state decision.)* \"Yes — SCOTUS may review any state ruling that determines the constitutionality of federal laws.\"",
            "9. *(Class representative's jury demand on a damages claim.)* \"No jury on anything — class actions are historically equitable.\"",
            "10. *(Amendment: informed-consent claim, then a negligent-performance claim.)* \"Yes — the negligence claim relates back to the original complaint.\""
          ],
          "item_count": 10,
          "key_md": "1. **EAR** — false flat: a repudiation is retractable until relied on.\n2. **ISSUE-SENSE** — sovereign immunity is a real doctrine; the issue is Congress's power over states.\n3. **EAR** — false flat: firm offers need no consideration.\n4. **ISSUE-SENSE** — true about filing; the question is service.\n5. **EAR** — false flat: \"force of nature\" is not a defense to wild-animal strict liability.\n6. **ISSUE-SENSE** — that is the testifying-expert rule; this expert is non-testifying (right rule, wrong category — you need the facts to know which category).\n7. **EAR** — false flat: no general vicarious parental liability (overclaim).\n8. **EAR** — false flat: that statement of SCOTUS jurisdiction is too narrow.\n9. **EAR** — false/overbroad: the legal damages claim carries a jury right.\n10. **ISSUE-SENSE** — relation-back is a true rule; on these facts the claims are different occurrences, so it doesn't apply. You need the facts to see it — the dividing line between the two skills."
        },
        {
          "id": "2.2",
          "title": "How many survive the Cut?",
          "instructions_md": "For each full question, run the cut and report the **survivor count** and the **next phase**: *1 → done*, *2 → Clash*, or *3–4 → recount, you missed a cut*.",
          "items": [
            "1. A wholesaler \"assigns\" its sale contracts to a reputable miller; may the buyer reject the first delivery? A) requirements contracts can't be assigned; B) duties pass only by express promise; C) \"assignment\" transfers rights only; D) assignable absent disproportionate quantity change.",
            "2. *(Repudiation, retraction after a substitute purchase — the worked example.)* A) retracted before performance; B) tender was a constructive condition; C) repudiation not retractable once communicated; D) buyer relied before retraction.",
            "3. After a defense verdict (JMOL moved before submission), may she file renewed JMOL and a new-trial motion? A) new-trial only; B) only one; C) both; D) combine with relief from judgment.",
            "4. Patient (State A) sues a State-B dentist and a State-A nurse; nurse moves to dismiss for no complete diversity. Grant? A) supplemental jurisdiction, same case/controversy; B) judicial economy; C) no complete diversity, no SMJ; D) the nurse claim isn't part of the same case/controversy.",
            "5. *(Negligent child, suit against the under-supervising mother.)* A) the child was negligent; B) liable for any harm the child causes; C) assumed the risk; D) failed to adequately supervise.",
            "6. Estate seeks to depose an expert the defense retained and won't call. A) full disclosure of qualifications/opinions/bases; B) nonprivileged and relevant; C) only on substantial need and undue hardship; D) only on exceptional circumstances, impracticable otherwise.",
            "7. *(Buyer wants out; recorded restrictive covenant; zoning bars her use.)* A) covenant renders title unmarketable; B) zoning clouds title; C) she'd get a warranty deed without exceptions; D) contract was silent on title.",
            "8. Seller offers to prove a 5%-tolerance trade usage against a \"complete and exclusive\" 100,000-bushel contract. Admissible? A) inconsistent with the express language; B) the contract was totally integrated; C) shows substantial performance; D) explains/supplements by usage of trade.",
            "9. *(Improperly secured corpse taken by vandals; mother's emotional distress.)* A) no threat to her safety; B) not extreme and outrageous; C) negligent failure to safeguard the body; D) no physical harm.",
            "10. State sold its gas field by bid and chose a lower local bidder; the high bidder sues. A) compelling interest in cheaper gas; B) market participant; C) irrational, denied due process; D) discriminated against interstate commerce."
          ],
          "item_count": 10,
          "key_md": "1. **1 → done.** D survives (A/B/C all false-law).\n2. **2 → Clash.** A and D (C false, B misfit). Axis: reliance.\n3. **1 → done.** C survives (A/B false, D misfit).\n4. **2 → Clash.** A and C (B misfit, D wrong-rationale). Axis: does §1367(b) bar supplemental jurisdiction in a diversity case here?\n5. **1 → done.** D survives (A wrong-element, B overclaim, C misfit).\n6. **2 → Clash.** C and D (A wrong-category, B half-truth). Axis: fact-work-product vs non-testifying-consultant protection.\n7. **1 → done.** A survives (B false, C misfit, D backwards).\n8. **2 → Clash.** A and D (B half-truth, C misfit). Axis: does the usage contradict the express term or explain it?\n9. **1 → done.** C survives (A misfit, B bait-doctrine, D backwards).\n10. **2 → Clash.** B and D (A misfit, C misfit). Axis: market participant vs regulator."
        },
        {
          "id": "2.3",
          "title": "Name the Clash axis.",
          "instructions_md": "Each item cuts to the two survivors shown. State the **single axis** they disagree on and the **fact** that resolves it.",
          "items": [
            "1. *(Repudiation.)* A \"retracted before performance\" vs D \"buyer relied before retraction.\"",
            "2. *(State gas field.)* B \"market participant\" vs D \"discriminated against interstate commerce.\"",
            "3. *(Retained-but-uncalled expert.)* C \"substantial need + undue hardship\" vs D \"exceptional circumstances, impracticable otherwise.\"",
            "4. *(Trade usage vs integrated contract.)* A \"inconsistent with the express language\" vs D \"explains/supplements by usage of trade.\"",
            "5. *(Dentist + nurse diversity.)* A \"supplemental jurisdiction\" vs C \"no complete diversity, no SMJ.\"",
            "6. *(State law struck under both federal and state due process; SCOTUS review?)* A \"adequate and independent state ground\" vs C \"rests on an interpretation of federal law.\"",
            "7. *(Laxatives given to cause discomfort; idiosyncratic death; first-degree murder = poison or premeditation.)* C \"both poison and premeditation\" vs D \"No.\"",
            "8. *(Informed-consent claim, then negligent-performance amendment.)* B \"didn't arise from the same event\" vs D \"relates back.\"",
            "9. *(Contractor demands a jury in state court; state rules grant juries in contract cases.)* B \"Seventh Amendment not incorporated\" vs D \"state law provides for jury trials.\"",
            "10. *(Residential-picketing ban exempting zoning-topic picketing.)* A \"content-neutral\" vs D \"content-based.\""
          ],
          "item_count": 10,
          "key_md": "1. **Axis: did the buyer rely before the retraction?** Fact: substitute bought June 5, before the June 10 retraction → reliance → **D**.\n2. **Axis: market participant or regulator?** Fact: the state owned the field and sold it by bid → market participant → **B**.\n3. **Axis: fact-work-product or non-testifying consultant?** Fact: retained for litigation and not called → consulting expert → **D**.\n4. **Axis: does the usage contradict or merely explain the quantity term?** A quantity-tolerance usage qualifies rather than flatly contradicts, and usage of trade is admissible even against an integrated contract → **D**.\n5. **Axis: does §1367(b)'s diversity carve-out bar supplemental jurisdiction here?** Fact: diversity basis + plaintiff adding a non-diverse co-defendant → §1367(b) bars it → **C**.\n6. **Axis: independent state ground or federal-law ground?** Fact: the court struck the law under **both** the state and federal due-process clauses → adequate and independent state ground → no review → **A**.\n7. **Axis: do the facts satisfy a first-degree predicate?** Fact: laxatives (not poison) given for discomfort (not premeditation), idiosyncratic death → neither predicate → **D**.\n8. **Axis: same occurrence?** Fact: informed-consent disclosure vs surgical performance → different occurrences → no relation-back → **B**.\n9. **Axis: federal right or state-law right?** Fact: state rules grant a jury in contract cases → state law provides it → **D**.\n10. **Axis: content-based or content-neutral?** Fact: it exempts zoning-topic picketing while banning others → content-based → **D**."
        },
        {
          "id": "2.4",
          "title": "The Call. (Apply the tiebreaker.)",
          "instructions_md": "In each item two answers survive and **the stem gives you nothing further to distinguish them**. Pick the survivor by applying the named heuristic. (Call is a last resort; these pairs are deliberately fact-thin to isolate it.)",
          "items": [
            "1. *(Default tier > heightened.)* Economic regulation; no suspect class, no fundamental right. A) upheld under rational basis; B) struck under strict scrutiny.",
            "2. *(Hedged > absolute.)* A) the evidence is always admissible; B) admissible unless its probative value is substantially outweighed by unfair prejudice.",
            "3. *(Threshold > merits.)* Motion to dismiss on both lack of standing and weakness of the claim. A) dismissed for lack of standing; B) dismissed because the claim fails on the merits.",
            "4. *(Fact-engaged > abstract.)* A) no liability — landowners owe limited duties to trespassers; B) no liability — the owner had no reason to anticipate this trespasser here, and the condition was natural.",
            "5. *(Default tier > heightened.)* Burden in an ordinary civil claim, no special category. A) preponderance of the evidence; B) clear and convincing evidence.",
            "6. *(Hedged > absolute.)* A) the search was valid; B) the search was valid if conducted incident to a lawful arrest.",
            "7. *(Threshold > merits.)* A) affirmed — the appeal was untimely and must be dismissed; B) affirmed — the trial court's ruling was correct.",
            "8. *(Fact-engaged > abstract.)* A) admissible as an excited utterance; B) admissible — hearsay exceptions exist for spontaneous statements.",
            "9. *(Default tier > heightened.)* A non-discriminatory state law incidentally burdens interstate commerce. A) upheld unless the burden clearly exceeds the local benefits; B) struck unless it survives strict scrutiny.",
            "10. *(Hedged > absolute.)* A) the modification is enforceable; B) the modification is enforceable if supported by consideration or made in good faith under the UCC."
          ],
          "item_count": 10,
          "key_md": "1. **A** — nothing triggers heightened review; default governs.\n2. **B** — the qualifier tracks Rule 403; the absolute overstates.\n3. **A** — standing is a threshold; the merits are never reached.\n4. **B** — ties the rule to these facts; the abstract recitation is the weaker twin.\n5. **A** — default civil burden; no heightened category triggered.\n6. **B** — the conditional states the actual doctrine.\n7. **A** — timeliness disposes of the appeal before the merits.\n8. **A** — names the operative exception rather than gesturing at \"exceptions.\"\n9. **A** — non-discriminatory burden → Pike balancing (the default), not strict scrutiny.\n10. **B** — the qualified statement tracks the real requirement."
        },
        {
          "id": "2.5",
          "title": "Full workflow. (Pick the answer; name the deciding phase.)",
          "instructions_md": "Run Cut → Clash → Call on each. Give the answer and the **phase that decided it**: CUT, CLASH, or CALL.",
          "items": [
            "1. *(Wholesaler assigns sale contracts to a reputable miller.)* A) can't assign; B) only by express promise; C) rights only; D) assignable absent disproportionate change.",
            "2. *(Repudiation retracted after a substitute purchase.)* A) retracted before performance; B) constructive condition; C) not retractable once communicated; D) relied before retraction.",
            "3. *(Negligent child; suit against the mother.)* A) child negligent; B) liable for any harm; C) assumed risk; D) failed to supervise.",
            "4. *(State gas field sold by bid to a lower local bidder.)* A) compelling interest; B) market participant; C) irrational/due process; D) discriminated against commerce.",
            "5. *(Informed-consent claim, then negligent-performance amendment.)* A) SOL expired the next day; B) different occurrence; C) knew-or-should-have-known but for a mistake; D) relates back.",
            "6. *(Improperly secured corpse; mother's distress.)* A) no threat to safety; B) not extreme/outrageous; C) negligent failure to safeguard; D) no physical harm.",
            "7. *(Dentist + nurse; no complete diversity; supplemental jurisdiction argued.)* A) supplemental jurisdiction; B) judicial economy; C) no complete diversity, no SMJ; D) not the same case/controversy.",
            "8. *(Residential-picketing ban exempting zoning topics.)* A) content-neutral; B) regulates conduct; C) irrational discrimination; D) content-based.",
            "9. *(Buyer wants out; recorded restrictive covenant; zoning bars use.)* A) covenant unmarketable; B) zoning clouds title; C) warranty deed without exceptions; D) silent on title.",
            "10. *(Laxatives given for discomfort; idiosyncratic death; first-degree = poison or premeditation.)* A) only poison; B) only premeditation; C) both; D) No."
          ],
          "item_count": 10,
          "key_md": "1. **D — CUT.** Three false-law cuts leave D.\n2. **D — CLASH.** A vs D on reliance; the substitute purchase before retraction decides it.\n3. **D — CUT.** A wrong-element, B overclaim, C misfit; D survives.\n4. **B — CLASH.** Market-participant fact takes it outside the dormant commerce clause.\n5. **B — CLASH.** Different-occurrence fact defeats relation-back (C is the wrong relation-back prong; cut at CUT).\n6. **C — CUT.** A misfit, B bait-doctrine, D backwards; C survives.\n7. **C — CLASH (by rule).** §1367(b) bars supplemental jurisdiction over a plaintiff's claim against a non-diverse co-defendant in diversity.\n8. **D — CLASH.** Content-based exception → strict scrutiny → challenge prevails.\n9. **A — CUT.** B false, C misfit, D backwards; A survives.\n10. **D — CLASH.** The facts negate both first-degree predicates.\n\nNotice the tally: every question resolved at CUT or CLASH; none needed CALL. That is the normal distribution. When Call starts feeling necessary on routine questions, suspect that you under-cut or under-clashed — not that the questions got harder."
        }
      ],
      "how_to_use_md": "Drill 2.1 is the skill-attribution check — if you can't reliably sort errors into Ear vs Issue-Sense, the rest of the course's two-track structure won't land, so get this near-automatic. Drills 2.2 and 2.3 train the control logic: count survivors, name the axis. Drill 2.5 is the rehearsal of the real motion — run all three phases and stay aware of which one is carrying the question. When the phase you're in always matches the survivor count without your thinking about it, you're ready for Lesson 3, which explains *why* some questions die instantly at the Cut and others fight you all the way to the Call: the difference between rules and standards.",
      "drill_item_count": 50
    },
    {
      "slug": "lesson-03",
      "number": 3,
      "part": "I",
      "part_title": "Foundations — the frame",
      "title": "Standards vs Rules: the Crackability Gradient",
      "objective": "Classify every question as a rule or a standard so you know whether structure or an anchor will crack it.",
      "est_minutes": 30,
      "body_md": "### Where this sits\n\nLesson 2 ended on a question it didn't answer: why do some questions die instantly at the Cut while others fight you to the Call? The answer is the single most useful piece of triage on the exam, and it's the whole of Lesson 3. Before you read a question's facts, you can predict *how* it can be cracked — and which of your two skills will do the work — by classifying one thing: is the governing law a **rule** or a **standard**?\n\n### The two kinds of law\n\nA **rule** is bright-line. It has an edge you can stub your toe on: \"irrevocable for up to three months,\" \"complete diversity,\" \"a writing is required,\" \"ninety days to serve,\" \"felony of the first degree if by poison.\" A rule is either satisfied or not; there is no spectrum.\n\nA **standard** is a gradient. It resolves on a spectrum of degree: \"reasonable,\" \"material,\" \"substantial,\" \"foreseeable,\" \"extreme and outrageous,\" \"undue burden,\" \"minimum contacts,\" and every tier of scrutiny. A standard is applied, not merely checked, and reasonable people calibrate it differently.\n\n### Why the distinction predicts the distractors\n\nThe test-writer builds wrong answers differently depending on which kind of law governs, because the two kinds offer different room to hide.\n\n**Rules leave no room to misapply, so the writer misstates them silently.** You can't make \"ninety days\" feel like a judgment call, so the distractor swaps the number, flips the default, names the wrong sub-rule, or states a real rule from an adjacent doctrine. The error is a clean factual misstatement of law. These questions are **anchor-dominant**: you crack them by *knowing the rule precisely*. If you know it, the Ear hears the misstatement and the cut is clean. If you don't, you cannot reason your way to a bright line you never learned — and the honest move is to flag and lean, not to agonize. This is the roughly twenty-percent floor of questions that knowledge, not technique, decides.\n\n**Standards leave enormous room to misapply, so the writer can't easily misstate them — instead the distractors are fingerprints.** Because \"reasonable\" can't be falsified the way \"ninety days\" can, the writer reaches for the tells: the answer that says *always* or *never* where the standard says *it depends*; the answer that picks the wrong point on the gradient; the answer that applies the right factor too absolutely. These questions are **Ear-dominant**: the overclaim and distortion molds light them up, and the absolute answer is usually the trap. This is the roughly eighty percent where technique, not memorized minutiae, wins.\n\n### The triage, stated as a habit\n\nThe moment you identify the governing law, you've chosen your tool:\n\n- **Standard in play** (reasonable, material, substantial, foreseeable, scrutiny, undue burden) → expect overclaim and distortion distractors; listen with the Ear; distrust any answer stated as an absolute. You can often do well here even on a doctrine you half-remember, because the *shape* of the wrong answers is predictable.\n- **Rule in play** (a number, a bright line, a categorical requirement, a named procedural mechanism) → you need to *know it cold*; the distractors will misstate it in small, plausible ways. Recognize early whether you have the rule. If you don't, flag and lean — don't burn ninety seconds reasoning toward an edge you can't see.\n\nThis is also why your two skills have different ceilings. The Ear, applied to standards, scales to most of the exam. Anchor knowledge, applied to rules, has a floor you can only raise by learning more rules. Lessons 4–6 maximize the first; Lesson 12 builds the second.\n\n### Worked example: the same surface, opposite cracks\n\n**Rule-driven.** A merchant's signed letter assures firm catalog prices \"throughout the coming year\"; a month later it tries to raise prices for the following month's orders. The governing law is UCC 2-205 — a bright line: a merchant's firm offer is irrevocable for the time stated, capped at three months. You cannot *reason* to this; you either know the three-month cap or you don't. Knowing it, the cut is clean: the relevant month falls inside the firm period, so the increase doesn't reach it. The distractors misstate the rule silently — one says firm offers need consideration (false), one invokes promissory estoppel (wrong doctrine), one misapplies the cap. Anchor-dominant.\n\n**Standard-driven.** A surgeon withholds a 2% mortality statistic; the operation succeeds and the patient is unharmed but furious. The governing law is the informed-consent standard, which resolves on materiality *and* requires a resulting injury. Here the Ear does the work: the answer reciting that \"a patient must always be told the risk factors\" is an absolute on a standard — a fingerprint — and it ignores the missing element (harm). The credited answer engages the gradient and the facts: no harm, no recovery. You didn't need to have memorized an informed-consent sub-rule; you needed to hear the absolute and check the elements. Ear-dominant.\n\nTwo questions that look alike on the surface. One is decided by what you *know*; the other by what you can *hear*. Classifying rule-versus-standard tells you which, before you spend a second on the facts.\n\n---",
      "drills": [
        {
          "id": "3.1",
          "title": "Rule or Standard?",
          "instructions_md": "Classify the governing concept in each as **[RULE]** (bright-line) or **[STANDARD]** (gradient).",
          "items": [
            "1. Whether a merchant's firm offer is still open four months after it was made.",
            "2. Whether a defendant's conduct was negligent.",
            "3. Whether a federal court has complete diversity.",
            "4. Whether a contract breach was material.",
            "5. Whether a search was conducted incident to a lawful arrest.",
            "6. Whether a statement is an excited utterance.",
            "7. Whether the plaintiff served process within the time the rules allow.",
            "8. Whether a state law imposes an undue burden on interstate commerce.",
            "9. Whether a killing was \"by poison\" under a first-degree-murder statute.",
            "10. Whether a public figure proved actual malice."
          ],
          "item_count": 10,
          "key_md": "1. **RULE** — three-month cap.\n2. **STANDARD** — reasonableness gradient.\n3. **RULE** — categorical (all plaintiffs diverse from all defendants).\n4. **STANDARD** — degree of breach.\n5. **RULE-ish, applied** — the categories are bright-line, though \"lawful arrest\" embeds judgment; treat as RULE for triage (you must know the search-incident categories).\n6. **STANDARD** — spontaneity/stress gradient.\n7. **RULE** — a fixed period.\n8. **STANDARD** — Pike balancing, a gradient of burden vs benefit.\n9. **RULE** — categorical predicate.\n10. **STANDARD** — a state of mind proven by degree of evidence."
        },
        {
          "id": "3.2",
          "title": "Predict the distractor.",
          "instructions_md": "For each governing law, predict whether the wrong answers will be **[SILENT MISSTATEMENTS]** of the rule or **[FINGERPRINTS]** (overclaim/distortion) on a standard.",
          "items": [
            "1. The three-month cap on firm offers.",
            "2. The reasonableness of a landowner's precautions.",
            "3. The 90-day service window.",
            "4. Foreseeability of a rescuer.",
            "5. The complete-diversity requirement.",
            "6. Whether emotional-distress conduct was extreme and outrageous.",
            "7. The relation-back same-occurrence requirement.",
            "8. The level of scrutiny for a content-based speech regulation.",
            "9. The categories of searches valid without a warrant.",
            "10. Whether a contractor substantially performed."
          ],
          "item_count": 10,
          "key_md": "1. **SILENT MISSTATEMENTS** — wrong number, wrong default, wrong doctrine (PE).\n2. **FINGERPRINTS** — \"always liable,\" \"never liable,\" wrong point on the gradient.\n3. **SILENT MISSTATEMENTS** — wrong period, wrong consequence.\n4. **FINGERPRINTS** — absolutes about who can recover.\n5. **SILENT MISSTATEMENTS** — \"minimal diversity suffices,\" supplemental-jurisdiction confusion.\n6. **FINGERPRINTS** — overclaim on the IIED standard.\n7. **SILENT MISSTATEMENTS** — wrong relation-back prong, wrong rule cited. (Application to facts is Issue-Sense, but the *distractors* tend to misstate the rule.)\n8. **SILENT/MIXED → mostly SILENT** — the tier itself is a near-rule (content-based → strict scrutiny); distractors misname the tier.\n9. **SILENT MISSTATEMENTS** — invented categories, wrong scope.\n10. **FINGERPRINTS** — absolutes (\"any deviation is a breach\")."
        },
        {
          "id": "3.3",
          "title": "Standard-driven cut. (Hear the absolute.)",
          "instructions_md": "Each question is governed by a standard, and the trap is an answer stated as an absolute or pinned to the wrong point on the gradient. Pick the survivor.",
          "items": [
            "1. *(Informed consent; successful surgery, no harm.)* A) the surgeon used his best judgment; B) the operation succeeded and the plaintiff suffered no harm; C) the plaintiff would have refused; D) a patient must always be told the risk factors.",
            "2. *(Hiker hit by a limb while trespassing; natural condition.)* A) the owner couldn't foresee any injury; B) no duty breached to a trespasser; C) the owner must prevent his trees from ever becoming dangerous; D) the owner is liable for all hidden dangers.",
            "3. *(Mausoleum mishandles a corpse; mother's distress.)* A) no threat to her own safety; B) the conduct wasn't extreme and outrageous; C) the mausoleum negligently failed to safeguard the body; D) no physical harm resulted.",
            "4. *(Rescuer hurt reaching a climber after a defective safety device failed.)* A) the retailer couldn't find the defect on inspection; B) the rescuer didn't rely on any representation; C) the climber wasn't negligent; D) injury to a rescuer was foreseeable.",
            "5. *(High-speed tire failure; failure-to-warn products claim.)* A) speeding was a misuse; B) the car wasn't defective; C) the manual's tire statement didn't adequately warn of the high-speed danger; D) speeding was inexcusable negligence per se.",
            "6. *(Plaintiff's negligence claim; defendant argues the plaintiff's own conduct.)* A) any contributory negligence bars recovery entirely; B) recovery is reduced by the plaintiff's share of fault; C) the plaintiff's conduct is irrelevant; D) the plaintiff assumed all risk by participating.",
            "7. *(IIED claim; defendant's insult was rude but ordinary.)* A) all insults are actionable; B) the conduct was not extreme and outrageous; C) any emotional harm suffices; D) the defendant is strictly liable for distress.",
            "8. *(Negligence; was the harm foreseeable?)* A) the defendant is liable for every consequence of his act; B) liability extends to foreseeable consequences within the risk created; C) the defendant is liable only if he intended the harm; D) the defendant is never liable for intervening causes.",
            "9. *(Defamation by a public figure.)* A) any false statement is actionable; B) the plaintiff must prove the statement was made with knowledge of falsity or reckless disregard; C) negligence as to truth is enough for a public figure; D) truth is irrelevant once reputation is harmed.",
            "10. *(Strict products liability; the plaintiff misused the product in an unforeseeable way.)* A) misuse is never a defense; B) unforeseeable misuse defeats the claim; C) the manufacturer is liable for all uses; D) any plaintiff conduct bars recovery."
          ],
          "item_count": 10,
          "key_md": "1. **B** — no harm; D is the absolute trap.\n2. **B** — trespasser duty; C/D are absolutes.\n3. **C** — negligent mishandling; A/B/D misframe or overstate.\n4. **D** — foreseeable rescuer; A/B are negligence-frame misfits.\n5. **C** — inadequate warning; A/B/D overstate the plaintiff's conduct.\n6. **B** — comparative fault reduces, not bars; A/C/D are absolutes.\n7. **B** — not extreme/outrageous; A/C/D overstate.\n8. **B** — foreseeable-risk scope; A/C/D are absolutes.\n9. **B** — actual malice; A/C/D misstate the standard.\n10. **B** — unforeseeable misuse is a defense; A/C/D are absolutes."
        },
        {
          "id": "3.4",
          "title": "Rule-driven cut. (Know it, or flag it.)",
          "instructions_md": "Each turns on a bright-line rule. Pick the answer that states the rule correctly. If you genuinely don't know the rule, mark **[FLAG]** — that, too, is a correct response on a rule you never learned.",
          "items": [
            "1. After a defense verdict (JMOL moved before submission), may the loser file a renewed JMOL and a new-trial motion? A) new-trial only; B) only one; C) both; D) combine with a motion for relief from judgment.",
            "2. A merchant's firm-offer assurance \"for the coming year\"; price raised for a month inside that year. Effective? A) irrevocable under promissory estoppel; B) irrevocable for that month (firm offer); C) no consideration, so revocable; D) the assurance exceeded three months.",
            "3. Patient (State A) sues a State-B dentist and a State-A nurse, >$75k; nurse moves to dismiss for no complete diversity. Grant? A) supplemental jurisdiction; B) judicial economy; C) yes, no complete diversity; D) no, not the same case/controversy.",
            "4. May a court of appeals permit an interlocutory appeal of a class-certification order? A) of cert and the merits; B) of the merits only; C) of certification only; D) of neither.",
            "5. Does a private recorded restrictive covenant render title unmarketable? A) yes; B) no, only zoning does; C) no, a warranty deed cures it; D) no, the contract was silent.",
            "6. Is the President's refusal to spend appropriated funds constitutional? A) no, he failed to invoke foreign-affairs powers; B) no, he must spend as Congress directs; C) yes, inherent power over expenditures; D) yes, foreign-affairs power.",
            "7. Does Rule 11 govern a deposition refusal? A) it should have been Rule 26(g); B) no, Rule 11 doesn't apply to discovery; C) yes, the court must prevent the benefit; D) yes, by conversion to Rule 37(b).",
            "8. Is a generally-applicable federal commerce regulation valid as applied to state governments? A) yes, valid; no Tenth Amendment violation; B) no, sovereign immunity; C) no, reserved state rights; D) no, exceeds the commerce power as applied.",
            "9. Is a buyer's purchase order a firm (irrevocable) offer? A) yes, for a reasonable time; B) only if the seller ships; C) no — a buyer's order is revocable until accepted; D) yes, if the goods are specially manufactured.",
            "10. Has the Seventh Amendment been incorporated against the states? A) yes; B) no; C) only for contract suits; D) only where damages exceed $20."
          ],
          "item_count": 10,
          "key_md": "1. **C** — Rule 50(b) allows both.\n2. **B** — within the three-month cap.\n3. **C** — §1367(b) bars supplemental jurisdiction over the plaintiff's claim against a non-diverse co-defendant in diversity.\n4. **C** — Rule 23(f), certification only.\n5. **A** — a covenant is an encumbrance; zoning is not a title defect.\n6. **B** — no inherent impoundment power.\n7. **B** — Rule 11(d) excludes discovery.\n8. **A** — Garcia: generally-applicable regulation is valid.\n9. **C** — a buyer's order is revocable until accepted (mailbox rule governs acceptance timing).\n10. **B** — not incorporated."
        },
        {
          "id": "3.5",
          "title": "Classify, then crack.",
          "instructions_md": "For each: label **[RULE]** or **[STANDARD]**, then pick the answer.",
          "items": [
            "1. *(Repudiation retracted after the buyer bought a substitute.)* A) retracted before performance; B) constructive condition; C) not retractable once communicated; D) buyer relied before retraction.",
            "2. *(Was the landowner's precaution reasonable given a foreseeable child intruder?)* A) strictly liable for all child injuries; B) liable if a reasonable owner would have guarded a known attractive hazard; C) never liable to trespassing children; D) liable for any injury on the land.",
            "3. *(Same-occurrence relation-back: informed-consent claim, then negligent-performance claim.)* A) SOL expired the next day; B) different occurrence; C) knew-or-should-have-known but for a mistake; D) relates back.",
            "4. *(Excited utterance: statement made minutes after a startling event while still upset.)* A) inadmissible hearsay; B) admissible as an excited utterance; C) admissible only if the declarant is unavailable; D) admissible as a present sense impression only if contemporaneous.",
            "5. *(Content-based picketing ban with a zoning-topic exception.)* A) content-neutral; B) regulates conduct; C) irrational discrimination; D) content-based.",
            "6. *(Was the breach material, excusing the other party?)* A) any breach excuses performance; B) only a material breach excuses performance; C) no breach ever excuses performance; D) breach excuses performance only if willful.",
            "7. *(Marketable title: recorded covenant limiting use.)* A) covenant renders title unmarketable; B) zoning clouds title; C) warranty deed cures it; D) contract silent on title.",
            "8. *(Foreseeable plaintiff: bystander injured by a negligently handled risk.)* A) liable to all persons however remote; B) liable to plaintiffs within the foreseeable zone of risk; C) liable only to those physically touched; D) never liable to bystanders.",
            "9. *(Firm offer cap, one-month assurance inside three months.)* A) PE; B) firm for that month; C) no consideration; D) exceeded three months.",
            "10. *(Was the officer's stop supported by reasonable suspicion?)* A) any hunch suffices; B) specific, articulable facts giving rise to reasonable suspicion; C) probable cause is always required to stop; D) no suspicion is ever required."
          ],
          "item_count": 10,
          "key_md": "1. **RULE** (retractability rule) → **D** (reliance defeats the retraction).\n2. **STANDARD** → **B** (reasonable-owner gradient; A/C/D are absolutes).\n3. **RULE** (relation-back), applied via facts → **B** (different occurrence; C is the wrong prong).\n4. **STANDARD** → **B** (excited-utterance gradient; C/D add false requirements).\n5. **RULE-ish tier** → **D** (content-based exception triggers strict scrutiny).\n6. **STANDARD** → **B** (materiality; A/C/D are absolutes).\n7. **RULE** → **A** (covenant = encumbrance; zoning ≠ defect).\n8. **STANDARD** → **B** (foreseeable-zone; A/C/D are absolutes).\n9. **RULE** → **B** (within the cap).\n10. **STANDARD** → **B** (reasonable-suspicion gradient; A/C/D are absolutes)."
        }
      ],
      "how_to_use_md": "Drill 3.1 is the reflex to build: rule or standard, decided in the first second. Drills 3.3 and 3.4 train the two different motions that follow — hear the absolute on a standard, recall the bright line on a rule, and flag honestly when the rule isn't there. Drill 3.5 fuses them. Once you classify before reading the facts and feel your tool snap into place, you're ready for Part II, which spends three lessons making the Ear — your weapon against standards, the larger share of the exam — fast and exact. Lesson 4 starts with the loudest tell: overclaim.",
      "drill_item_count": 50
    },
    {
      "slug": "lesson-04",
      "number": 4,
      "part": "II",
      "part_title": "The Ear — cut the not-true answers",
      "title": "The Ear I — Overclaim",
      "objective": "Hear the overclaim family — answers that say more than the law supports.",
      "est_minutes": 30,
      "body_md": "### Where this sits\n\nPart II builds the Ear, your weapon against the standards that make up most of the exam. The Ear catches three families of falsehood, and this lesson is the first and loudest: **overclaim** — answers that say more than the law says. Overclaim is the highest-yield tell on the test because it requires no facts to hear, it shows up across every subject, and the human writing the distractors reaches for it constantly. Learn to hear it and a large fraction of wrong answers will start eliminating themselves before you finish reading them.\n\n### What overclaim is\n\nLaw is full of qualifiers — *generally, usually, unless, ordinarily, may, in most circumstances.* Overclaim strips the qualifier and states the proposition as an absolute, or invents a requirement the law never imposed, or pushes a real rule to an extreme it doesn't reach. Three sub-molds:\n\n**Tiered-absolute.** The answer uses an absolute quantifier — *always, never, all, none, any, must, only, cannot, no exceptions* — where the governing law is a standard or a rule riddled with exceptions. The tell is the word itself. When the law is a gradient (\"reasonable,\" \"material\"), an answer that admits no gradient is almost always wrong: *\"a patient must always be told every risk,\" \"any breach excuses performance,\" \"the parent is liable for any harm the child causes.\"* The absoluteness is the error, independent of the facts.\n\n**Fabricated rule.** The answer invents a requirement, threshold, or doctrine that does not exist. It sounds lawyerly and plausible — *\"a discharge must be in writing,\" \"the plaintiff must plead facts constituting a cause of action,\" \"injunctive relief has more than de minimis value under the Seventh Amendment\"* — but no such rule is on the books. The tell is that you cannot name the authority, because there isn't one.\n\n**Extreme-of-range.** The answer takes a real rule and overstates its reach — the firm-offer cap becomes \"irrevocable forever,\" a qualified privilege becomes \"absolute immunity,\" a foreseeable-zone duty becomes \"liable to all persons however remote.\" The kernel is real; the magnitude is wrong.\n\n### Why overclaim works on you\n\nOverclaim exploits a true memory. You *do* recall that patients must be informed of risks, that breaches can excuse performance, that parents can be liable for a child's conduct. The absolute version activates that memory and feels confirmed. The discipline is to hear the quantifier as a separate object from the doctrine: the doctrine may be real, but *\"always,\" \"any,\" \"must\"* is a claim of its own, and on a standard it is almost always false. Train yourself to flinch at absolutes the way you'd flinch at a misspelled word.\n\n### Calibration with the standards/rules lesson\n\nOverclaim is the dominant distractor on **standard-driven** questions (Lesson 3). A standard resolves on a gradient, so an answer that denies the gradient — *always, never* — is a fingerprint. On **rule-driven** questions overclaim shows up as extreme-of-range (overstating a bright line). Either way, the absolute is the thing to distrust first. A useful prior: when two answers say the same thing but one is hedged (\"generally,\" \"unless\") and one is absolute (\"always\"), the hedged one usually wins — the *hedged-beats-absolute* Call from Lesson 2, here grounded in why absolutes are built to fail.\n\n### One caution: not every absolute is wrong\n\nSome rules really are categorical, and the exam knows you've been trained to fear absolutes — so it occasionally makes the correct answer the absolute one (the 7th Amendment really *has not* been incorporated; complete diversity really *does* require all parties diverse). Overclaim is a strong prior, not a law of nature. Hear the absolute, treat it as presumptively wrong, then check whether the governing law is genuinely a bright-line categorical rule. If it is, the absolute can stand. The flinch is the default; the check is what keeps the flinch honest.\n\n### Worked example\n\nA grocery cart pushed by a closely-supervised eight-year-old injures a shopper; assume the child was negligent and the mother under-supervised. The shopper sues the **mother**.\n\n- A) Yes — the child was negligent.\n- B) Yes — the mother is liable for any harm caused by the child.\n- C) Yes — the mother assumed the risk.\n- D) Yes — the mother failed to adequately supervise.\n\nRun the Ear for overclaim. **B is tiered-absolute**: *\"liable for any harm caused by the child\"* asserts general vicarious parental liability, which does not exist — parents answer only for their own negligence. The word *any* is the tell, and it's false on the law no matter the facts. (A is a different mold — wrong-element — and C is a misfit, both covered in Part III.) D survives: the mother's own failure to supervise is the real basis. The overclaim in B is the kind of answer you should be able to kill on the first read, before you've even sorted A and C.\n\n---",
      "drills": [
        {
          "id": "4.1",
          "title": "Spot the overclaim. (Mark the absolute or invented rule.)",
          "instructions_md": "Each statement is offered as a legal proposition. Mark **[OVERCLAIM]** (false because it overstates/invents) or **[SOUND]** (a correct categorical rule).",
          "items": [
            "1. A patient must be told every conceivable risk of a procedure to give informed consent.",
            "2. The Seventh Amendment has not been incorporated against the states.",
            "3. A parent is liable for any tort committed by the parent's minor child.",
            "4. Complete diversity requires that no plaintiff share citizenship with any defendant.",
            "5. A discharge of a contractual duty must be in writing to be effective.",
            "6. Any breach of contract excuses the other party's performance.",
            "7. A merchant's firm offer is irrevocable for the time stated, capped at three months.",
            "8. A landowner is liable for all hidden dangers to anyone who enters the land.",
            "9. Under Rule 50(b), a renewed JMOL may be joined with a motion for a new trial.",
            "10. A defendant is liable for every consequence that follows from his negligent act."
          ],
          "item_count": 10,
          "key_md": "1. **OVERCLAIM** — tiered-absolute (material risks, not every conceivable one).\n2. **SOUND** — genuinely categorical.\n3. **OVERCLAIM** — tiered-absolute (only own negligence).\n4. **SOUND** — categorical.\n5. **OVERCLAIM** — fabricated rule.\n6. **OVERCLAIM** — tiered-absolute (only material breach).\n7. **SOUND** — the rule, stated correctly with its cap.\n8. **OVERCLAIM** — extreme-of-range (duty varies by entrant status).\n9. **SOUND** — correct rule.\n10. **OVERCLAIM** — extreme-of-range (foreseeable consequences within the risk)."
        },
        {
          "id": "4.2",
          "title": "Name the sub-mold.",
          "instructions_md": "Each is an overclaim. Label it **[TIERED-ABSOLUTE]**, **[FABRICATED RULE]**, or **[EXTREME-OF-RANGE]**.",
          "items": [
            "1. \"Injunctive relief has more than de minimis value under the Seventh Amendment.\"",
            "2. \"A repudiation can never be retracted once communicated.\"",
            "3. \"A qualified privilege gives the speaker absolute immunity from suit.\"",
            "4. \"The plaintiff must plead facts constituting a cause of action.\"",
            "5. \"Any contributory negligence completely bars the plaintiff's recovery.\" (in a pure-comparative jurisdiction)",
            "6. \"A firm offer remains irrevocable indefinitely.\"",
            "7. \"All hearsay is inadmissible without exception.\"",
            "8. \"A search is valid only if the officer first obtains a warrant.\" (ignoring recognized exceptions)",
            "9. \"The seller's silence about the gasoline leak transfers all liability to the seller alone.\"",
            "10. \"A contract must be supported by adequate, fair consideration to be enforceable.\""
          ],
          "item_count": 10,
          "key_md": "1. **FABRICATED RULE** — no such \"value\" test exists.\n2. **TIERED-ABSOLUTE** — \"never\"; retractable until relied on.\n3. **EXTREME-OF-RANGE** — overstates a qualified privilege into absolute immunity.\n4. **FABRICATED RULE** — old code-pleading phrase, not the federal standard.\n5. **TIERED-ABSOLUTE** — \"any/completely\" false in pure comparative.\n6. **EXTREME-OF-RANGE** — overstates the firm-offer rule (three-month cap).\n7. **TIERED-ABSOLUTE** — \"all/without exception\" false.\n8. **TIERED-ABSOLUTE** — \"only if a warrant\" ignores exceptions.\n9. **EXTREME-OF-RANGE** — overstates allocation (\"all liability... alone\").\n10. **FABRICATED RULE** — adequacy of consideration isn't required."
        },
        {
          "id": "4.3",
          "title": "Cut the overclaim in context.",
          "instructions_md": "Each question's trap is an overclaim. Identify the choice to cut and pick the survivor.",
          "items": [
            "1. *(Informed consent; surgery succeeded, no harm.)* A) best judgment; B) operation succeeded, no harm; C) plaintiff would have refused; D) a patient must always be told the risk factors.",
            "2. *(Suit against the under-supervising mother of a negligent child.)* A) child negligent; B) liable for any harm the child causes; C) assumed risk; D) failed to supervise.",
            "3. *(Land sale; repudiation retracted after a substitute purchase.)* A) retracted before performance; B) constructive condition; C) a repudiation can never be retracted once communicated; D) buyer relied before retraction.",
            "4. *(Hiker hit by a limb while trespassing; natural condition.)* A) couldn't foresee any injury; B) no duty breached to a trespasser; C) the owner must prevent his trees from ever becoming dangerous; D) liable for all hidden dangers.",
            "5. *(Oral discharge of a paving duty; no consideration.)* A) good-faith modification, enforceable; B) discharge must be in writing; C) parol evidence bars it; D) no consideration for the discharge.",
            "6. *(Pleading sufficiency; defendant says no facts show access.)* A) didn't identify the legal theory; B) discovery will reveal what the director received; C) failed to plead elements or facts; D) doesn't meet \"facts constituting a cause of action.\"",
            "7. *(Employee demands a jury in state court for an injunction, under the Seventh Amendment.)* A) Seventh Amendment not incorporated; B) equity, no jury; C) the Seventh Amendment applies to all contract suits; D) injunctive relief has de minimis value.",
            "8. *(Defamation by a public figure.)* A) any false statement is actionable; B) actual malice required; C) negligence suffices; D) truth is irrelevant.",
            "9. *(Comparative-fault jurisdiction; plaintiff partly at fault.)* A) any contributory negligence bars recovery; B) recovery reduced by the plaintiff's share; C) plaintiff conduct irrelevant; D) plaintiff assumed all risk.",
            "10. *(Firm offer; one-month assurance inside three months.)* A) PE; B) firm for that month; C) no consideration; D) the assurance was longer than three months."
          ],
          "item_count": 10,
          "key_md": "1. Cut **D** (always) → **B**.\n2. Cut **B** (any) → **D**.\n3. Cut **C** (never) → **D**.\n4. Cut **C**/**D** (overclaims) → **B**.\n5. Cut **B** (fabricated writing rule) → **D**.\n6. Cut **D** (fabricated standard) → ... and A (fabricated) — survivor **B** (discovery will reveal access; the credited answer here).\n7. Cut **C** (all contract suits) and **D** (de minimis) → **A**.\n8. Cut **A/C/D** (overclaims/misstatements) → **B**.\n9. Cut **A** (any), **C**, **D** → **B**.\n10. Cut **C** (no consideration) and note **D** misapplies the cap → **B**."
        },
        {
          "id": "4.4",
          "title": "Overclaim vs sound categorical. (Don't over-flinch.)",
          "instructions_md": "Each item pairs a doctrine with an absolute statement of it. Decide: **[FALSE — OVERCLAIM]** because the law is a gradient, or **[TRUE — CATEGORICAL]** because the law really is bright-line.",
          "items": [
            "1. \"All plaintiffs must be diverse from all defendants for complete diversity.\"",
            "2. \"A defendant is always liable for emotional distress he causes.\"",
            "3. \"The Seventh Amendment never applies in state court of its own force.\"",
            "4. \"A firm offer is irrevocable for any period the offeror states.\"",
            "5. \"Rule 11 never applies to discovery requests, responses, or motions.\"",
            "6. \"A landowner always owes the highest duty of care to everyone on the premises.\"",
            "7. \"A buyer's purchase order is never, by itself, an irrevocable offer.\"",
            "8. \"Any deviation from contract specifications is a material breach.\"",
            "9. \"Zoning restrictions never render a seller's title unmarketable.\"",
            "10. \"Punitive damages are always available for breach of contract.\""
          ],
          "item_count": 10,
          "key_md": "1. **TRUE — CATEGORICAL.**\n2. **FALSE — OVERCLAIM** (IIED/NIED have thresholds).\n3. **TRUE — CATEGORICAL** (not incorporated).\n4. **FALSE — OVERCLAIM** (three-month cap).\n5. **TRUE — CATEGORICAL** (Rule 11(d)).\n6. **FALSE — OVERCLAIM** (duty varies by status).\n7. **TRUE — CATEGORICAL** (a buyer's order is revocable until accepted).\n8. **FALSE — OVERCLAIM** (materiality is a gradient).\n9. **TRUE — CATEGORICAL** (zoning ≠ title defect).\n10. **FALSE — OVERCLAIM** (punitives generally unavailable for breach)."
        },
        {
          "id": "4.5",
          "title": "Mixed overclaim hunt.",
          "instructions_md": "Each item gives a stem and one choice. Classify: **[OVERCLAIM — CUT]**, **[SOUND — KEEP]**, or **[OTHER ERROR]** (true but not responsive, or false for a non-overclaim reason — you'll name those molds in later lessons; here just don't mislabel them as overclaim).",
          "items": [
            "1. *(Negligent-child suit against the mother.)* \"Liable for any harm the child causes.\"",
            "2. *(Service-failure motion.)* \"Filing commenced the action and it was timely.\"",
            "3. *(Wild snake escapes; strict liability.)* \"No — the escape was a force of nature.\"",
            "4. *(Informed consent, no harm.)* \"A patient must always be told the risk factors.\"",
            "5. *(Marketable title; recorded covenant.)* \"The covenant renders the title unmarketable.\"",
            "6. *(Public-figure defamation.)* \"Any false statement about him is actionable.\"",
            "7. *(Repudiation retracted after reliance.)* \"A repudiation can never be retracted once communicated.\"",
            "8. *(Federal regulation applied to states.)* \"Sovereign immunity bars suit without consent.\"",
            "9. *(Comparative-fault jurisdiction.)* \"Any contributory negligence bars recovery entirely.\"",
            "10. *(Trespasser hit by a natural-condition limb.)* \"No duty was breached to a trespasser.\""
          ],
          "item_count": 10,
          "key_md": "1. **OVERCLAIM — CUT** (any; vicarious).\n2. **OTHER ERROR** — true but not responsive (filing vs service), not overclaim.\n3. **OTHER ERROR** — false, but it's a fabricated defense/misfit, not an absolute-quantifier overclaim.\n4. **OVERCLAIM — CUT** (always).\n5. **SOUND — KEEP.**\n6. **OVERCLAIM — CUT** (any; ignores actual malice).\n7. **OVERCLAIM — CUT** (never).\n8. **OTHER ERROR** — true doctrine, not responsive (the issue is Congress's power over states), not overclaim.\n9. **OVERCLAIM — CUT** (any; pure comparative).\n10. **SOUND — KEEP.**"
        }
      ],
      "how_to_use_md": "Drills 4.1 and 4.2 train the raw catch — hearing the absolute and naming why it's built to fail. Drill 4.4 is the corrective that keeps you from over-flinching: a quarter of the time the absolute is the correct categorical rule, and a test-taker who reflexively cuts every absolute will start missing the real ones. Drill 4.5 mixes overclaim with the other molds so you don't label *every* wrong answer an overclaim — discipline about *which* mold is what makes the Ear precise rather than just suspicious. When you can hear an absolute, treat it as presumptively wrong, and check whether the law is genuinely categorical in one beat, you're ready for Lesson 5 and the second Ear family: answers that are simply false — backwards, self-contradictory, or flatly wrong.",
      "drill_item_count": 50
    },
    {
      "slug": "lesson-05",
      "number": 5,
      "part": "II",
      "part_title": "The Ear — cut the not-true answers",
      "title": "The Ear II — Falsity",
      "objective": "Hear the falsity family — answers that are backwards, contradictory, or flatly false.",
      "est_minutes": 29,
      "body_md": "### Where this sits\n\nLesson 4 caught answers that say *too much*. Lesson 5 catches answers that are simply *false* — not overstated, just wrong. These are the second Ear family, and they are in some ways easier to kill than overclaims, because there's no qualifier to argue about: the proposition is incorrect, full stop. The catch is that the most dangerous false answers are false in a *direction*, and the direction is plausible. Three sub-molds: **backwards**, **contradiction**, and **flat misstatement**.\n\n### What falsity is\n\n**Backwards.** The answer states a real rule in reverse — it inverts the default, swaps the trigger and the consequence, or reverses which party bears the burden. The doctrine is real and recognizable, which is exactly why the reversal slips past: you hear the familiar words and your memory supplies a checkmark before you've checked the direction. Examples: *\"the parol evidence rule bars a subsequent modification\"* (it bars prior and contemporaneous terms, not later ones); *\"memory loss makes a witness not subject to cross-examination\"* (the opposite — the witness remains subject to cross); *\"a firm offer requires consideration\"* (it requires none); *\"zoning restrictions render title unmarketable\"* (they don't; private encumbrances do). The tell is that the answer points the rule the wrong way.\n\n**Contradiction.** The answer is internally inconsistent — its rationale defeats its own conclusion, or it asserts two things that cannot both be true. *\"Yes, the defendant is liable, because he owed no duty.\"* *\"No jury, because the suit is at common law.\"* The reasoning and the result don't connect, or the clause cancels itself. The tell is that you can break the answer using only the answer.\n\n**Flat misstatement.** The answer states a rule that simply is not the law — not a reversal, not an overstatement, just incorrect. *\"SCOTUS has appellate jurisdiction only over state decisions about the constitutionality of federal laws.\"* *\"A claim arises under federal law whenever a state statute is modeled on a federal one.\"* The doctrine described doesn't exist in that form. The tell is that you can't reconcile it with anything you actually learned.\n\n### Why falsity works on you\n\nBackwards is the dangerous one, and it works by borrowing a true memory and reversing the polarity. You remember \"parol evidence rule — bars extrinsic evidence,\" and an answer that says it bars *the modification* rides that memory in. The defense is to make the rule's *direction* a separate thing you verify: not just \"is this the right doctrine?\" but \"is it pointed the right way?\" For contradiction, the defense is to read the answer as a closed system — does the *because* support the *yes*? For flat misstatement, the defense is the authority check: if you can't trace the rule to something real, distrust it.\n\n### Falsity vs overclaim\n\nOverclaim keeps the rule true but inflates it (*always, any, forever*). Falsity makes the rule itself wrong (reversed, self-cancelling, or invented-as-stated). The practical line: if removing a quantifier would fix the answer, it's overclaim; if the proposition stays wrong with every quantifier removed, it's falsity. You don't need to label them perfectly under time pressure — both get cut by the Ear — but knowing the difference makes your catch faster, because backwards answers in particular need a *direction* check that overclaims don't.\n\n### Worked example\n\nAn assault victim with no memory of the attack would testify that, before losing consciousness, he told a passerby the defendant had hit him. The defense objects: hearsay, and no personal knowledge.\n\n- A) No — the prosecution hasn't shown the victim more likely than not had personal knowledge.\n- B) No — the victim's memory loss means he cannot be effectively cross-examined.\n- C) Yes — the victim is subject to cross-examination and personal knowledge is sufficiently shown.\n- D) Yes — it's the victim's own out-of-court statement.\n\nRun the Ear for falsity. **B is backwards**: memory loss does *not* remove a witness from cross-examination — under *Owens*, a witness who can't remember is still \"subject to cross,\" which is the whole point of the rule, and B asserts the reverse. **D is a flat misstatement**: being one's *own* out-of-court statement is not itself a basis for admission; there is no such rule. (A is a half-truth — a distortion mold from Lesson 6 — misstating the showing required.) C survives: the witness testifies, is subject to cross, and personal knowledge is shown. The killer move was hearing B point the rule the wrong way — the direction check.\n\n---",
      "drills": [
        {
          "id": "5.1",
          "title": "True or false? (Direction included.)",
          "instructions_md": "Mark each **T** or **F**. For each F, note in your head the correct version.",
          "items": [
            "1. The parol evidence rule bars a subsequent oral modification.",
            "2. A merchant's firm offer requires consideration to be irrevocable.",
            "3. A witness's memory loss renders the witness not subject to cross-examination.",
            "4. Zoning restrictions render a seller's title unmarketable.",
            "5. A repudiation may be retracted until the other party materially relies on it.",
            "6. In strict products liability, the retailer's inability to discover the defect on inspection is a complete defense.",
            "7. A general assignment of a sales contract delegates the assignor's duties as well as transferring rights.",
            "8. SCOTUS may review a state high-court decision that rests on adequate and independent state grounds.",
            "9. A consulting (non-testifying) expert's opinions are discoverable only on a showing of exceptional circumstances.",
            "10. The mailbox rule makes an acceptance effective when received."
          ],
          "item_count": 10,
          "key_md": "1. **F** — backwards; it bars prior/contemporaneous, not subsequent.\n2. **F** — backwards; firm offers require no consideration.\n3. **F** — backwards; still subject to cross (*Owens*).\n4. **F** — backwards; zoning is not a title defect.\n5. **T.**\n6. **F** — backwards; inability to inspect is a negligence defense, not a strict-liability defense.\n7. **T.**\n8. **F** — flat misstatement; SCOTUS may not review when there's an adequate and independent state ground.\n9. **T.**\n10. **F** — backwards; acceptance is effective on dispatch, not receipt."
        },
        {
          "id": "5.2",
          "title": "Name the sub-mold.",
          "instructions_md": "Each is false. Label **[BACKWARDS]**, **[CONTRADICTION]**, or **[FLAT MISSTATEMENT]**.",
          "items": [
            "1. \"No jury trial, because this suit is at common law.\"",
            "2. \"The parol evidence rule bars proof of a later modification.\"",
            "3. \"SCOTUS has appellate jurisdiction only over decisions determining the constitutionality of federal laws.\"",
            "4. \"Yes, the landowner is liable, because she owed the trespasser no duty.\"",
            "5. \"A buyer's purchase order is an irrevocable offer for a reasonable time.\"",
            "6. \"Memory loss prevents effective cross-examination, so the prior statement is inadmissible.\"",
            "7. \"A claim arises under federal law whenever the state statute copies a federal one.\"",
            "8. \"The defendant is not liable, because his negligence was the proximate cause of the harm.\"",
            "9. \"Firm offers are revocable unless supported by consideration.\"",
            "10. \"Rule 11 governs discovery requests and responses.\""
          ],
          "item_count": 10,
          "key_md": "1. **CONTRADICTION** — common-law suits are exactly where the jury right attaches.\n2. **BACKWARDS** — PER direction.\n3. **FLAT MISSTATEMENT** — false statement of SCOTUS jurisdiction.\n4. **CONTRADICTION** — \"no duty\" can't support \"is liable.\"\n5. **FLAT MISSTATEMENT** — a buyer's order is revocable; no such irrevocability rule. (Borderline backwards; accept either, but it's stated as an invented rule.)\n6. **BACKWARDS** — *Owens* direction.\n7. **FLAT MISSTATEMENT** — no such arising-under rule.\n8. **CONTRADICTION** — proximate cause supports liability, not its absence.\n9. **BACKWARDS** — firm offers need no consideration.\n10. **FLAT MISSTATEMENT** — Rule 11(d) excludes discovery."
        },
        {
          "id": "5.3",
          "title": "Cut the false answer in context.",
          "instructions_md": "Each question's trap is a falsity (backwards / contradiction / flat misstatement). Identify the cut and pick the survivor.",
          "items": [
            "1. *(Victim with no memory; prior statement to a passerby.)* A) no showing of personal knowledge; B) memory loss means no effective cross; C) subject to cross, personal knowledge shown; D) it's his own out-of-court statement.",
            "2. *(Oral discharge of a paving duty; no consideration.)* A) good-faith modification, enforceable; B) discharge must be in writing; C) parol evidence bars the oral modification; D) no consideration for the discharge.",
            "3. *(Marketable title; recorded covenant; zoning bars use.)* A) covenant renders title unmarketable; B) zoning clouds title; C) warranty deed cures it; D) silent on title.",
            "4. *(Repudiation retracted after a substitute purchase.)* A) retracted before performance; B) constructive condition; C) not retractable once communicated; D) relied before retraction.",
            "5. *(SCOTUS review; state law struck under both federal and state due process.)* A) adequate and independent state ground; B) jurisdiction only over federal-law-constitutionality decisions; C) jurisdiction over any ruling interpreting federal law; D) jurisdiction over decisions striking state laws under the federal Constitution.",
            "6. *(Rescuer hurt after a defective device failed; products claim against the retailer.)* A) couldn't discover the defect on inspection; B) rescuer didn't rely; C) climber wasn't negligent; D) injury to a rescuer was foreseeable.",
            "7. *(Federal question from a copied state statute.)* A) arises under the federal law it copied; B) incorporates an essential federal element; C) federal interest insufficient; D) does not concern a federal question.",
            "8. *(Wholesaler \"assigns\" sale contracts to a reputable miller.)* A) requirements contracts can't be assigned; B) duties pass only by express promise; C) assignment transfers rights only, not duties; D) assignable absent disproportionate change.",
            "9. *(Buyer's order; seller mails acceptance; buyer phones a revocation next day before the letter arrives.)* A) the order was acceptable only by shipment, revoked before shipment; B) the buyer never agreed to the price; C) the order was an irrevocable offer for a reasonable time; D) the seller accepted before the revocation.",
            "10. *(Employee demands a jury for an injunction; state court; under the Seventh Amendment.)* A) Seventh Amendment not incorporated; B) equity, no jury; C) the Seventh Amendment applies because the suit involves a contract; D) injunctive relief has de minimis value."
          ],
          "item_count": 10,
          "key_md": "1. Cut **B** (backwards) and **D** (flat misstatement) → **C**.\n2. Cut **C** (backwards — PER) and **B** (fabricated) → **D**.\n3. Cut **B** (backwards — zoning) → **A**.\n4. Cut **C** (backwards — retractability) → **D**.\n5. Cut **B/C/D** (flat misstatements of SCOTUS jurisdiction) → **A**.\n6. Cut **A** (backwards — inspection is a negligence defense) and **B** (backwards — reliance) → **D**.\n7. Cut **A/B** (false arising-under) → **D**.\n8. Cut **C** (backwards — assignment delegates duties) and **A/B** (false) → **D**.\n9. Cut **C** (flat misstatement — not irrevocable) → **D**.\n10. Cut **C** (contradiction — equity isn't \"involving a contract\" for jury purposes) and **D** (fabricated) → **A**."
        },
        {
          "id": "5.4",
          "title": "Backwards detector. (Which direction is right?)",
          "instructions_md": "Each item states a rule. If it's pointed correctly, mark **[CORRECT]**; if reversed, mark **[BACKWARDS]** and the correct direction is in the key.",
          "items": [
            "1. \"Acceptance is effective on dispatch; revocation is effective on receipt.\"",
            "2. \"A firm offer needs consideration; an option contract does not.\"",
            "3. \"Strict liability requires proof the defendant could have discovered the defect.\"",
            "4. \"A general 'assignment' of a contract transfers rights only.\"",
            "5. \"Comparative fault reduces recovery; contributory negligence (at common law) bars it.\"",
            "6. \"Memory loss bars cross-examination; thus the prior statement is excluded.\"",
            "7. \"Public-figure plaintiffs must prove actual malice; private figures may recover on negligence as to truth.\"",
            "8. \"Zoning is a title encumbrance; a private covenant is not.\"",
            "9. \"A repudiation is irrevocable once made; reliance is irrelevant.\"",
            "10. \"The party seeking to admit a prior inconsistent statement for impeachment may also use it as substantive evidence in all cases.\""
          ],
          "item_count": 10,
          "key_md": "1. **CORRECT.**\n2. **BACKWARDS** — a firm offer needs *no* consideration; an option *does* (or a substitute).\n3. **BACKWARDS** — strict liability doesn't require discoverability.\n4. **BACKWARDS** — it transfers rights *and* delegates duties.\n5. **CORRECT.**\n6. **BACKWARDS** — memory loss does not bar cross.\n7. **CORRECT.**\n8. **BACKWARDS** — a private covenant *is* an encumbrance; zoning is not.\n9. **BACKWARDS** — retractable until reliance.\n10. **BACKWARDS** — generally impeachment-only unless an exception (e.g., prior sworn testimony) applies; \"in all cases\" is also an overclaim."
        },
        {
          "id": "5.5",
          "title": "Mixed falsity hunt.",
          "instructions_md": "Each gives a stem and one choice. Classify: **[FALSITY — CUT]** (backwards/contradiction/flat), **[OVERCLAIM — CUT]**, **[SOUND — KEEP]**, or **[NOT RESPONSIVE]** (true but wrong question — don't mislabel as falsity).",
          "items": [
            "1. *(Repudiation retracted after reliance.)* \"A repudiation can never be retracted once communicated.\"",
            "2. *(Victim with no memory.)* \"Memory loss means he can't be cross-examined.\"",
            "3. *(Marketable title.)* \"Zoning clouds the title.\"",
            "4. *(Service-failure motion.)* \"Filing commenced the action and it was timely.\"",
            "5. *(Negligent-child suit against the mother.)* \"Liable for any harm the child causes.\"",
            "6. *(Wholesaler assigns sale contracts.)* \"Assignment transfers rights only, not duties.\"",
            "7. *(SCOTUS review; independent state ground.)* \"Jurisdiction over any state decision determining the constitutionality of federal laws.\"",
            "8. *(Federal regulation applied to states.)* \"Valid under the commerce clause; no Tenth Amendment violation.\"",
            "9. *(Trespasser hit by a natural-condition limb.)* \"Liable, because he owed no duty to a trespasser.\"",
            "10. *(Firm offer, one month inside three.)* \"Firm for that month.\""
          ],
          "item_count": 10,
          "key_md": "1. **OVERCLAIM — CUT** (never). (Also reads as backwards-by-absolute; primary tell is the absolute.)\n2. **FALSITY — CUT** (backwards).\n3. **FALSITY — CUT** (backwards/flat — zoning isn't a title defect).\n4. **NOT RESPONSIVE** — true, wrong question.\n5. **OVERCLAIM — CUT** (any).\n6. **FALSITY — CUT** (backwards — assignment delegates duties).\n7. **FALSITY — CUT** (flat misstatement of SCOTUS jurisdiction).\n8. **SOUND — KEEP.**\n9. **FALSITY — CUT** (contradiction — \"no duty\" can't support \"liable\").\n10. **SOUND — KEEP.**"
        }
      ],
      "how_to_use_md": "Drill 5.1 trains the direction check, and Drill 5.4 isolates it — backwards is the falsity mold that costs prepared test-takers the most, because the doctrine is right and only the polarity is wrong, so practice flipping every rule to its correct direction until it's reflexive. Drill 5.5 keeps you honest about *which* mold you're cutting and reminds you that a true-but-off-question answer is not \"false\" — it's a different problem entirely, the one Part III is built for. When you can hear a reversal as fast as you hear an absolute, you've got two-thirds of the Ear. Lesson 6 finishes it with the subtlest family: distortions that are *partly* true.",
      "drill_item_count": 50
    },
    {
      "slug": "lesson-06",
      "number": 6,
      "part": "II",
      "part_title": "The Ear — cut the not-true answers",
      "title": "The Ear III — Distortion",
      "objective": "Hear the distortion family — answers that are partly true but bent.",
      "est_minutes": 29,
      "body_md": "### Where this sits\n\nOverclaim says too much; falsity says something wrong. Distortion — the third and subtlest Ear family — says something *partly true*. These are the hardest false answers to hear, because there is a real, correct kernel inside them, and your memory latches onto the kernel and ignores the part that's been bent. Distortions are where a well-prepared test-taker who has mastered Lessons 4 and 5 still bleeds points. Four sub-molds: **half-truth**, **colloquialism**, **even-split**, and **autonomy-appeal**.\n\n### What distortion is\n\n**Half-truth.** The answer states something true but *incomplete* — it omits a necessary element or a controlling condition, and the omission changes the result. The classic: in an informed-consent case where the surgery succeeded and the patient was unharmed, the choice *\"the plaintiff would have refused the operation had he known\"* is true and even sympathetic — but it supplies only causation and silently drops the requirement of *harm*. Every word is accurate; the answer is still wrong because of what it leaves out. The tell is that the statement is true but doesn't carry the whole burden the question puts on it.\n\n**Colloquialism.** The answer reasons in lay terms — *fairness, common sense, what anyone would do* — instead of the legal standard. It sounds reasonable and humane, and that's the trap: the exam tests doctrine, not intuition, and an answer that resolves a duty question by \"it's only fair\" or a causation question by \"common sense says\" has substituted a feeling for a rule. The tell is the absence of law — the answer never names the doctrine it's supposedly applying.\n\n**Even-split.** The answer splits the difference, treats a one-sided rule as if both parties share equally, or offers a balanced-sounding compromise that isn't the law. It exploits a bias toward the moderate-sounding option. *\"Both parties bear the loss equally\"* where the rule places it on one; *\"the court should weigh the equities\"* where a bright-line rule controls. The tell is that \"balanced\" has replaced \"correct.\"\n\n**Autonomy-appeal.** The answer leans on a party's freedom, choice, or rights — *\"she was entitled to decide for herself,\" \"he was free to contract,\" \"it was his property to do with as he pleased\"* — in a way that sounds principled but isn't the governing rule. Autonomy is a real value in the law, but it rarely *is* the operative test, and an answer that resolves the question by invoking it has usually dodged the actual doctrine. The tell is a rights-flavored conclusion with no rule underneath.\n\n### Why distortion works on you\n\nAll four exploit the same vulnerability: a true or attractive fragment. Half-truth gives you accurate law and hopes you won't notice the missing element. Colloquialism gives you a satisfying intuition. Even-split gives you the comfort of moderation. Autonomy-appeal gives you a sympathetic principle. In each case the antidote is the same — *run the elements*. Don't ask \"is this true or appealing?\"; ask \"does this supply everything the question requires, stated as the actual rule?\" Distortions survive vibes and die to element-checks.\n\n### Distortion in the standards/rules frame\n\nDistortions cluster on **standard-driven** questions, where the gradient gives room for a partly-right answer to feel right. The half-truth in particular is the signature trap on multi-element claims (informed consent, negligence, IIED, defamation): the answer nails one element and omits another. The discipline from Lesson 3 — identify the governing standard, then run *all* its elements — is precisely what defeats the half-truth.\n\n### Worked example\n\nA patient with a serious but non-urgent circulatory problem has bypass surgery; the surgeon withholds a 2% mortality statistic, reasoning the patient was \"a worrier.\" The operation succeeds; the patient recovers fully but is furious to learn of the risk, insisting he'd have refused. He sues in negligence.\n\n- A) No — the surgeon used his best personal judgment in shielding the patient.\n- B) No — the operation succeeded and the patient suffered no harm.\n- C) Yes — the patient would have refused had he been informed.\n- D) Yes — a patient must be told the risk factors to give informed consent.\n\nRun the Ear for distortion. **C is a half-truth**: it's true that he'd have refused (causation), but a negligence claim needs *harm*, and there is none — the omission is fatal. **A is an autonomy/colloquial blend** dressed as \"best judgment\" — the therapeutic-privilege gesture isn't the operative test and supplies no doctrine. **D is an overclaim** (Lesson 4 — *must* be told *the* risk factors) that also ignores harm. B survives: no injury, no recovery. The trap that catches strong test-takers here is C, because it's both true and sympathetic — and it's wrong purely for what it omits.\n\n---",
      "drills": [
        {
          "id": "6.1",
          "title": "Complete or half-true?",
          "instructions_md": "Each statement is true as far as it goes. Mark **[COMPLETE]** if it carries the full burden of the question implied, or **[HALF-TRUTH]** if it omits a necessary element. The missing element is in the key.",
          "items": [
            "1. *(Negligence claim:)* \"The defendant breached a duty of care to the plaintiff.\"",
            "2. *(Informed-consent claim, successful surgery:)* \"The patient would have refused had he been informed.\"",
            "3. *(Battery:)* \"The defendant intended to cause a harmful or offensive contact, and such contact resulted.\"",
            "4. *(Negligence, undisclosed risk that never materialized:)* \"The doctor failed to disclose a material risk.\"",
            "5. *(Adverse possession:)* \"The possessor occupied the land openly and continuously for the statutory period.\"",
            "6. *(Defamation by a private figure on a private matter:)* \"The defendant published a false statement of fact about the plaintiff.\"",
            "7. *(Strict products liability:)* \"The product was defective when it left the manufacturer and the defect caused the plaintiff's injury.\"",
            "8. *(Negligence:)* \"The defendant's conduct was a but-for cause of the harm.\"",
            "9. *(IIED:)* \"The defendant's conduct was extreme and outrageous and caused the plaintiff severe emotional distress.\"",
            "10. *(Promissory estoppel:)* \"The promisor made a promise the promisee relied upon.\""
          ],
          "item_count": 10,
          "key_md": "1. **HALF-TRUTH** — missing causation and damages.\n2. **HALF-TRUTH** — missing harm/injury.\n3. **COMPLETE** — intent, contact, and result stated.\n4. **HALF-TRUTH** — missing that the risk materialized and caused harm.\n5. **HALF-TRUTH** — missing hostile/adverse and exclusive (and often \"actual\"); typically also exclusivity.\n6. **HALF-TRUTH** — missing fault and damages (and publication is there).\n7. **COMPLETE** — defect at departure plus causation.\n8. **HALF-TRUTH** — missing duty, breach, proximate cause, damages.\n9. **COMPLETE** — the IIED elements are present.\n10. **HALF-TRUTH** — missing that reliance was foreseeable and that injustice requires enforcement."
        },
        {
          "id": "6.2",
          "title": "Name the sub-mold.",
          "instructions_md": "Each is a distortion. Label **[HALF-TRUTH]**, **[COLLOQUIALISM]**, **[EVEN-SPLIT]**, or **[AUTONOMY-APPEAL]**.",
          "items": [
            "1. \"No liability, because it's only fair that people watch where they're going.\"",
            "2. \"The patient would have refused, so the doctor is liable.\" *(no-harm case)*",
            "3. \"The loss should be split evenly between the buyer and seller.\"",
            "4. \"She owned the land, so she could keep the dangerous condition if she wished.\"",
            "5. \"Common sense tells us the harm was foreseeable.\"",
            "6. \"The statement was published and false, so it's defamatory.\" *(private figure, private matter)*",
            "7. \"He was free to sign whatever contract he liked, so it binds him.\" *(infancy/incapacity at issue)*",
            "8. \"The fairest result is for each party to bear its own costs.\"",
            "9. \"The defendant caused the harm in fact, so he's liable.\" *(proximate cause disputed)*",
            "10. \"He had every right to speak his mind.\" *(actual-malice defamation at issue)*"
          ],
          "item_count": 10,
          "key_md": "1. **COLLOQUIALISM** — \"only fair,\" no duty analysis.\n2. **HALF-TRUTH** — omits harm.\n3. **EVEN-SPLIT** — invents an equal division.\n4. **AUTONOMY-APPEAL** — ownership doesn't answer the duty owed to entrants.\n5. **COLLOQUIALISM** — \"common sense,\" not the foreseeability standard applied.\n6. **HALF-TRUTH** — omits fault and damages.\n7. **AUTONOMY-APPEAL** — \"free to sign\" dodges capacity.\n8. **EVEN-SPLIT** — balanced-sounding, not the rule.\n9. **HALF-TRUTH** — but-for without proximate cause.\n10. **AUTONOMY-APPEAL** — \"right to speak\" dodges the actual-malice test."
        },
        {
          "id": "6.3",
          "title": "Cut the distortion in context.",
          "instructions_md": "Each question's trap is a distortion. Identify the cut and pick the survivor.",
          "items": [
            "1. *(Informed consent; surgery succeeded, no harm.)* A) best judgment shielding the patient; B) no harm; C) would have refused; D) must always be told the risks.",
            "2. *(Mausoleum mishandles a corpse; mother's distress.)* A) no threat to her safety; B) not extreme and outrageous; C) negligently failed to safeguard the body; D) no physical harm.",
            "3. *(Trespasser hit by a natural-condition limb.)* A) no foreseeable injury; B) no duty breached to a trespasser; C) it's only fair that landowners maintain their trees; D) liable for all hidden dangers.",
            "4. *(Buyer wants out; recorded covenant; warranty deed promised.)* A) covenant unmarketable; B) zoning clouds title; C) she should accept since she gets a warranty deed; D) silent on title.",
            "5. *(Victim with no memory; prior statement.)* A) no showing of personal knowledge \"more likely than not\"; B) memory loss bars cross; C) subject to cross, knowledge shown; D) his own statement.",
            "6. *(Aunt offers to sell a business for $125k \"if the landlord assents\"; later backs out after the landlord assents; niece sues.)* A) motivation was affection, not price; B) consideration inadequate vs market value; C) the landlord-assent condition was beyond either party's control; D) the unsigned writing was a record, not a condition.",
            "7. *(Comparative-fault jurisdiction; plaintiff partly at fault.)* A) any contributory negligence bars recovery; B) recovery reduced by plaintiff's share; C) it's fairest to split the loss in half; D) plaintiff assumed all risk.",
            "8. *(Products; high-speed tire failure; failure to warn.)* A) speeding was misuse; B) not defective; C) the manual's tire statement didn't adequately warn; D) speeding was inexcusable negligence per se.",
            "9. *(Defamation; dean repeats a rumor the professor's own agent solicited.)* A) the professor invited the libel; B) no pecuniary loss; C) the dean should have investigated first; D) it was in writing.",
            "10. *(Rescuer hurt after a defective device failed.)* A) couldn't discover the defect on inspection; B) rescuer didn't rely; C) the climber wasn't negligent in failing to test; D) injury to a rescuer was foreseeable."
          ],
          "item_count": 10,
          "key_md": "1. Cut **C** (half-truth — no harm), **A** (autonomy/colloquial), **D** (overclaim) → **B**.\n2. Cut **B** (bait-doctrine — IIED standard, addressed in L8) → **C**; here the distortion to notice is B's borrowed standard. Survivor **C**.\n3. Cut **C** (colloquialism) and the overclaims **A/D** → **B**.\n4. Cut **C** (half-truth/even-split — deed type doesn't cure an encumbrance) → **A**.\n5. Cut **A** (half-truth — misstates the showing) and **B** (backwards), **D** (flat) → **C**.\n6. Cut **A** (autonomy/colloquial — motive), **B** (overclaim — adequacy) → survivor **D** (the writing was a record, not a condition). (C is the trap; the condition was satisfied.)\n7. Cut **C** (even-split) and overclaims **A/D** → **B**.\n8. Cut **A/B/D** (misframes of the plaintiff's conduct) → **C**.\n9. Cut **C** (colloquial — \"should have investigated\") and **B/D** (the libel-form points) → **A** (invited).\n10. Cut **A** (backwards — inspection defense), **B** (backwards — reliance), **C** (half-truth — wrong party) → **D**."
        },
        {
          "id": "6.4",
          "title": "Half-truth: name the missing element.",
          "instructions_md": "Each choice is offered to win a multi-element claim. It's a half-truth. Name the **missing element** (key has it); the choice is always **[CUT]**.",
          "items": [
            "1. *(Negligence:)* \"The defendant owed and breached a duty.\"",
            "2. *(Informed consent, no harm:)* \"The patient would have refused.\"",
            "3. *(Negligence, undisclosed risk that never materialized:)* \"A material risk was not disclosed.\"",
            "4. *(Battery via a thing set in motion:)* \"The defendant set the object in motion.\"",
            "5. *(Defamation, private figure:)* \"The statement was false and published.\"",
            "6. *(Conversion:)* \"The defendant exercised dominion over the plaintiff's chattel.\"",
            "7. *(Nuisance:)* \"The defendant's use interfered with the plaintiff's enjoyment.\"",
            "8. *(Negligence per se:)* \"The defendant violated a statute.\"",
            "9. *(Fraud:)* \"The defendant made a false statement of material fact.\"",
            "10. *(Strict liability, wild animal:)* \"The defendant kept a wild animal.\""
          ],
          "item_count": 10,
          "key_md": "1. Missing **causation and damages.**\n2. Missing **harm.**\n3. Missing **that the risk materialized and caused injury.**\n4. Missing **intent and resulting harmful/offensive contact.**\n5. Missing **fault and damages.**\n6. Missing **that the interference was so serious as to warrant a forced sale (vs trespass to chattels).**\n7. Missing **that the interference was substantial and unreasonable.**\n8. Missing **that the plaintiff was in the protected class, the harm was the type the statute guards against, and causation/damages.**\n9. Missing **scienter, intent to induce reliance, justifiable reliance, and damages.**\n10. Missing **that the harm flowed from the animal's dangerous propensity (and causation).**"
        },
        {
          "id": "6.5",
          "title": "Mixed Ear hunt. (All three families.)",
          "instructions_md": "Each gives a stem and one choice. Classify with the full Ear taxonomy: **[OVERCLAIM]**, **[FALSITY]** (backwards/contradiction/flat), **[DISTORTION]** (half-truth/colloquial/even-split/autonomy), **[SOUND — KEEP]**, or **[NOT RESPONSIVE]**.",
          "items": [
            "1. *(Informed consent, no harm.)* \"The patient would have refused had he known.\"",
            "2. *(Repudiation retracted after reliance.)* \"A repudiation can never be retracted once communicated.\"",
            "3. *(Victim with no memory.)* \"Memory loss means he can't be cross-examined.\"",
            "4. *(Trespasser hit by a natural-condition limb.)* \"It's only fair that owners maintain their trees.\"",
            "5. *(Marketable title.)* \"Zoning clouds the title.\"",
            "6. *(Service-failure motion.)* \"Filing commenced the action and it was timely.\"",
            "7. *(Negligent-child suit against the mother.)* \"Liable for any harm the child causes.\"",
            "8. *(Property owner keeps a dangerous condition.)* \"She owned it, so she could keep it however she liked.\"",
            "9. *(Corpse mishandling NIED.)* \"The mausoleum negligently failed to safeguard the body.\"",
            "10. *(Comparative-fault jurisdiction.)* \"The fairest result is to split the loss evenly.\""
          ],
          "item_count": 10,
          "key_md": "1. **DISTORTION** — half-truth (omits harm).\n2. **OVERCLAIM** — never.\n3. **FALSITY** — backwards.\n4. **DISTORTION** — colloquialism.\n5. **FALSITY** — backwards/flat.\n6. **NOT RESPONSIVE** — true, wrong question.\n7. **OVERCLAIM** — any.\n8. **DISTORTION** — autonomy-appeal.\n9. **SOUND — KEEP.**\n10. **DISTORTION** — even-split."
        }
      ],
      "how_to_use_md": "Distortions are the molds that separate a good Ear from a great one, and the half-truth is the one to over-practice — Drills 6.1 and 6.4 build the reflex that beats it: on any multi-element claim, run *every* element and notice the one the answer skipped. Drill 6.5 is your first full Ear integration across all three families; if you can sort a wrong answer into overclaim, falsity, or distortion quickly, the Ear is built. That completes Part II. Part III turns to the harder skill — the one that needs the facts, every time — starting with Lesson 7 and the single habit that prevents most Issue-Sense misses: predicting the answer before you look at the choices.",
      "drill_item_count": 50
    },
    {
      "slug": "lesson-07",
      "number": 7,
      "part": "III",
      "part_title": "Issue-Sense — cut the not-responsive answers",
      "title": "Issue-Sense I — Predict Before You Peek",
      "objective": "Predict the issue and the dispositive fact before you read the choices.",
      "est_minutes": 30,
      "body_md": "### Where this sits\n\nPart II built the Ear, which needs no facts. Part III builds Issue-Sense, which needs the facts every time, and it starts here — with the single habit that prevents most Issue-Sense misses. The validated lesson behind this whole course is blunt: when test-takers fail a hard question, they fail by cutting the true-and-responsive answer because a true-but-off-question distractor looked correct. There is one reliable inoculation against that, and it is to decide what the question is asking, and what answers it, *before you read the choices.* Predict before you peek.\n\n### Why prediction is the keystone\n\nThe choices are an adversarial environment. Three of the four are engineered to look attractive, and the most dangerous one is a true statement of law aimed at a question you weren't asked. If you walk into that environment without a prior — without having already decided what the question turns on — you are reacting, and the distractors are built to exploit reaction. A fluent, familiar, *true* statement will pull you toward it precisely because it's true, and you'll talk yourself out of the narrower, less familiar answer that actually responds.\n\nIf instead you arrive with a prediction — \"this is a service question, not a filing question; the answer turns on whether there was good cause for the four-month delay; there wasn't, so it should be dismissed\" — then the true-but-off-question distractor has nothing to grab. You read *\"filing commenced the action and it was timely,\"* recognize it as true, and *also* recognize it isn't your question, because you already know what your question is. Prediction converts the choices from a menu you browse into a key you check your answer against.\n\n### The three things to fix before you peek\n\nReading the stem, settle three things — and only then look at the choices:\n\n1. **The call of the question.** What, exactly, is being asked? Not the topic — the precise question. \"Should the motion to dismiss be granted?\" is different from \"is there personal jurisdiction?\" which is different from \"is venue proper?\" The call is narrow, and distractors love to answer an adjacent call.\n2. **The dispositive fact.** What one fact decides it? Stems are mostly scenery; usually a single fact carries the outcome — the timing of a reliance, the status of an entrant, whether two claims share an occurrence, whether a substance is deadly. Find it. (Lesson 9 develops this; here, just locate it.)\n3. **The predicted answer.** Given the call and the dispositive fact, what's the outcome and the reason? You won't always be right, and you won't always be precise — but even a rough prediction (\"for the defendant, on duty grounds\") arms you against the off-question trap.\n\n### What prediction is *not*\n\nPrediction is not certainty, and it is not stubbornness. On hard questions you'll predict the issue but not the exact answer, and that's fine — narrowing the *question* is most of the protection. And when the choices reveal that your prediction missed a wrinkle, you update; the point of predicting is to enter the choices with a frame, not to defend a guess against the facts. The failure mode prediction prevents is *driftless reaction*; it does not license ignoring what the choices teach you.\n\n### The stem-dependency you already proved\n\nThis habit only works because Issue-Sense is fact-dependent. You cannot predict the answer from the choices — you predict from the *stem*, because the stem is where the dispositive fact lives. This is the same lesson the whole method rests on: the questions that turn on a fact are answerable only with the fact in hand, and prediction is how you put the fact in hand *first*, before the choices can mislead you about which fact matters.\n\n### Worked example\n\nThe stem: a buyer's lawyer tries to settle pre-suit; three days before the limitations period runs, she tells the seller's lawyer she'll file that day and asks if he'll accept service; he agrees; she files but forgets to serve; four months later the seller's lawyer asks whether she ever filed; she immediately mails the complaint; the seller moves to dismiss for failure to effect timely service.\n\nPredict before peeking. **Call:** should the motion to dismiss be granted? (Not \"was the complaint timely filed\" — *that's the adjacent call the distractor will answer.*) **Dispositive fact:** she forgot to serve for four months, far past the service window, with nothing but forgetfulness to explain it. **Prediction:** granted — forgetting is not good cause for the service failure.\n\nNow look at the choices. One says *\"deny — filing commenced the action and the complaint was timely filed.\"* True law. But you already know your call is about *service*, not filing, so it slides right off. The choice that matches your prediction — *\"granted, because the buyer's attorney showed no good cause for the failure to effect timely service\"* — is the answer. You didn't choose between four attractive options; you checked four options against a prediction you'd already made, and one matched.\n\n---",
      "drills": [
        {
          "id": "7.1",
          "title": "Name the call. (Stem only.)",
          "instructions_md": "For each compact stem, state the **precise question** being asked — and, where there's an adjacent call a distractor might answer, name that too.",
          "items": [
            "1. A lawyer filed on time but forgot to serve for four months; the defendant moves to dismiss for failure to serve.",
            "2. A merchant's firm-offer letter promises firm prices \"for the coming year\"; a month later it raises prices for the following month.",
            "3. A patient (State A) sues a State-B dentist and a State-A nurse; the nurse moves to dismiss for lack of complete diversity.",
            "4. A seller repudiates a land contract; the buyer buys a substitute; the seller then retracts; the buyer sues.",
            "5. A federal statute applies a generally-applicable fleet rule to a city; the city sues for an injunction.",
            "6. A state court strikes a law under both the federal and state due-process clauses; a party petitions the U.S. Supreme Court.",
            "7. A writer sues for plagiarism; the defendant moves to dismiss, saying no facts show he received the manuscript.",
            "8. After a defense verdict, the loser (who moved for JMOL pre-submission) wants post-verdict relief.",
            "9. A grocery cart pushed by a supervised child injures a shopper; the shopper sues the mother in negligence.",
            "10. A buyer wants out of a land contract after discovering a recorded restrictive covenant; the deed promised was a warranty deed without exceptions."
          ],
          "item_count": 10,
          "key_md": "1. Should the motion to **dismiss for failure to serve** be granted? *Adjacent call:* was the complaint timely *filed*.\n2. Is the price increase **effective for that month's orders**? *Adjacent:* whether a firm offer needs consideration.\n3. Should the court **dismiss for lack of subject-matter jurisdiction**? *Adjacent:* whether the claims share a case/controversy.\n4. Will the **buyer prevail** (was the retraction effective)? *Adjacent:* whether tender was a condition.\n5. Should the **injunction issue** (is the statute constitutional as applied to states)? *Adjacent:* sovereign immunity.\n6. May the **U.S. Supreme Court exercise jurisdiction** to review? *Adjacent:* the scope of SCOTUS jurisdiction in the abstract.\n7. Should the court **grant the 12(b)(6) motion** (is the complaint sufficient)? *Adjacent:* the pre-Twombly \"facts constituting a cause of action.\"\n8. May the loser file a **renewed JMOL and a new-trial motion**? *Adjacent:* whether the two can be combined with other post-judgment motions.\n9. Will the shopper recover **against the mother** (her own negligence)? *Adjacent:* the child's negligence / vicarious liability.\n10. **Must the buyer purchase** (is title marketable)? *Adjacent:* the effect of zoning."
        },
        {
          "id": "7.2",
          "title": "Find the dispositive fact. (Stem only.)",
          "instructions_md": "For each, name the **one fact** that decides the outcome.",
          "items": [
            "1. *(Repudiation, retraction.)* Seller repudiates June 1; buyer buys a substitute June 5; seller retracts June 10.",
            "2. *(Diversity + added defendant.)* Plaintiff State A; dentist State B; nurse State A; suit on diversity.",
            "3. *(First-degree murder = poison or premeditation.)* Employee drops laxatives to cause discomfort; victim, on other medication, dies.",
            "4. *(SCOTUS review.)* The state court rested its judgment on both the federal *and* the state constitution.",
            "5. *(Relation back.)* Original claim: failure to disclose an alternative method; new claim: negligent surgical performance.",
            "6. *(Dormant commerce.)* The state owned the gas field and chose a bidder by taking bids.",
            "7. *(Premises liability.)* The injured entrant was on the land without permission or knowledge of the owner; the limb fell from a termite-weakened tree.",
            "8. *(Defamation.)* The dean's statement was a response to a letter from the organization the professor asked to represent him.",
            "9. *(Firm offer.)* The assurance covered \"the coming year,\" and the disputed orders fall in a month one month after the offer.",
            "10. *(Supplemental pleading.)* The intentional tort occurred after the original complaint was filed."
          ],
          "item_count": 10,
          "key_md": "1. The substitute purchase (June 5) preceded the retraction (June 10) → reliance.\n2. The nurse and plaintiff are both State A → no complete diversity.\n3. The substance was a laxative given for discomfort, with an idiosyncratic death → no poison, no premeditation.\n4. The judgment rests on an adequate and independent state ground.\n5. The two claims arise from different occurrences (disclosure vs performance).\n6. The state acted as a seller/owner → market participant.\n7. The entrant was a trespasser; the condition was natural.\n8. The professor (through his agent) solicited the statement → invited.\n9. The disputed month falls within the three-month firm-offer cap.\n10. The tort post-dates the filing → Rule 15(d) supplemental pleading."
        },
        {
          "id": "7.3",
          "title": "Predict the answer. (Stem only — commit before the key.)",
          "instructions_md": "For each, write your **predicted outcome and reason**. Then check the key for the credited answer.",
          "items": [
            "1. *(Service forgotten four months; motion to dismiss.)*",
            "2. *(Firm-offer price raised for a month inside the year.)*",
            "3. *(Nurse, non-diverse co-defendant, diversity suit; motion to dismiss.)*",
            "4. *(Seller retracts after the buyer bought a substitute; buyer sues.)*",
            "5. *(Generally-applicable federal fleet rule applied to a city; injunction sought.)*",
            "6. *(State decision on both federal and state grounds; SCOTUS petition.)*",
            "7. *(Plagiarism complaint; defendant says no facts show he received the manuscript.)*",
            "8. *(Laxatives to cause discomfort; idiosyncratic death; first-degree-murder charge.)*",
            "9. *(Supervised child's cart injures a shopper; suit against the mother.)*",
            "10. *(Recorded restrictive covenant discovered; warranty deed promised; buyer wants out.)*"
          ],
          "item_count": 10,
          "key_md": "1. **Granted** — forgetting isn't good cause for the service failure.\n2. **Not effective** — the month is within the three-month firm period.\n3. **Dismiss** — §1367(b) bars supplemental jurisdiction over the plaintiff's claim against the non-diverse co-defendant.\n4. **Buyer prevails** — reliance defeated the retraction.\n5. **No injunction** — valid generally-applicable regulation (Garcia).\n6. **No review** — adequate and independent state ground.\n7. **Deny** — the access fact is properly developed in discovery; the complaint is sufficient.\n8. **Not first degree (acquit of first degree)** — no poison in the deadly sense, no premeditation.\n9. **Recovers against the mother** — her own negligent supervision.\n10. **Need not purchase** — the covenant renders title unmarketable."
        },
        {
          "id": "7.4",
          "title": "Predict, then match. (Stem, then choices.)",
          "instructions_md": "Predict first (cover the choices). Then reveal the choices and pick the one that matches your prediction — resisting any true-but-off-question option.",
          "items": [
            "1. *(Service forgotten.)* A) filing commenced the action and was timely; B) the lawyer agreed to accept service; C) no good cause for the failure to serve; D) the limitations period expired without service.",
            "2. *(Diversity + nurse.)* A) supplemental jurisdiction; B) judicial economy; C) no complete diversity, no SMJ; D) not the same case/controversy.",
            "3. *(Repudiation/retraction.)* A) retracted before performance; B) constructive condition; C) not retractable once communicated; D) relied before retraction.",
            "4. *(SCOTUS review, dual grounds.)* A) adequate and independent state ground; B) jurisdiction only over federal-law-constitutionality decisions; C) over any federal-law interpretation; D) over decisions striking state laws under the federal Constitution.",
            "5. *(Plagiarism 12(b)(6).)* A) didn't identify the theory; B) discovery will reveal what he received; C) failed to plead elements/facts; D) doesn't meet \"facts constituting a cause of action.\"",
            "6. *(Firm offer.)* A) PE; B) firm for that month; C) no consideration; D) longer than three months.",
            "7. *(Suit against the mother.)* A) child negligent; B) liable for any harm; C) assumed risk; D) failed to supervise.",
            "8. *(Marketable title.)* A) covenant unmarketable; B) zoning clouds title; C) warranty deed cures it; D) silent on title.",
            "9. *(Federal fleet rule on a city.)* A) valid; no Tenth Amendment violation; B) sovereign immunity; C) reserved state rights; D) exceeds commerce power as applied.",
            "10. *(First-degree murder; laxatives for discomfort.)* A) only poison; B) only premeditation; C) both; D) No."
          ],
          "item_count": 10,
          "key_md": "1. **C** (resist A — filing).\n2. **C** (resist A — supplemental).\n3. **D** (resist A — no reliance assumed).\n4. **A** (resist C — the federal-interpretation lure).\n5. **B** (resist C/D — the deficiency lure).\n6. **B** (resist D — cap misapplied).\n7. **D** (resist A — child's fault).\n8. **A** (resist B — zoning).\n9. **A** (resist B — sovereign immunity).\n10. **D** (resist C — assuming the worst facts)."
        },
        {
          "id": "7.5",
          "title": "Catch the mismatch.",
          "instructions_md": "Each gives a stem and one tempting choice. Does the choice answer the **actual call**? Mark **[MATCHES — RESPONSIVE]** or **[MISMATCH — answers an adjacent call]** (name the call it actually answers).",
          "items": [
            "1. *(Service-failure motion.)* \"Filing commenced the action and the complaint was timely.\"",
            "2. *(Firm-offer price increase.)* \"The original offer was irrevocable for that month.\"",
            "3. *(Diversity + nurse; motion to dismiss.)* \"The claims share a common case or controversy.\"",
            "4. *(Federal fleet rule applied to a city.)* \"The federal government has sovereign immunity and can't be sued without consent.\"",
            "5. *(SCOTUS review, dual grounds.)* \"SCOTUS may review any state ruling interpreting federal law.\"",
            "6. *(Relation back: disclosure claim, then performance claim.)* \"The amendment relates back to the original complaint.\"",
            "7. *(Plaintiff sues the mother of a negligent child.)* \"The mother failed to adequately supervise.\"",
            "8. *(Supplemental pleading of a post-filing tort.)* \"The tort occurred after the original lawsuit was filed.\"",
            "9. *(Buyer wants out; recorded covenant.)* \"The covenant renders the title unmarketable.\"",
            "10. *(Employee demands a jury under the Seventh Amendment in state court for an injunction.)* \"The Seventh Amendment applies only to suits at common law, and this is equity.\""
          ],
          "item_count": 10,
          "key_md": "1. **MISMATCH** — answers \"was filing timely,\" not the service motion.\n2. **MATCHES** — answers the effectiveness of the increase.\n3. **MISMATCH** — answers \"same case/controversy,\" not \"is there SMJ\" (diversity is destroyed regardless).\n4. **MISMATCH** — answers a suit-against-the-U.S. question, not Congress's power over states.\n5. **MISMATCH** — answers SCOTUS jurisdiction in the abstract, not whether review is barred here (independent state ground).\n6. **MISMATCH** — answers a different-facts relation-back; these are different occurrences, so it's not responsive.\n7. **MATCHES** — answers the claim against the mother.\n8. **MISMATCH** — true, but it's the *trigger* for a supplemental pleading, not the answer to whether it's permitted; the responsive answer is that the supplemental pleading is timely.\n9. **MATCHES** — answers marketability.\n10. **MISMATCH (here)** — true, but the responsive ground for his *specific* Seventh-Amendment demand in *state* court is non-incorporation; the equity point answers a federal-court version of the question."
        }
      ],
      "how_to_use_md": "Do Drills 7.1–7.3 with the choices physically covered — the entire skill is operating from the stem, and any peeking trains the habit you're trying to break. Drill 7.4 is the rehearsal of the real motion: predict, then check the choices against the prediction, and feel the off-question distractor fail to grab you. Drill 7.5 sharpens the discrimination between an answer that responds and one that answers the question next door. When you instinctively settle the call and the dispositive fact before your eyes reach the choices, you've built the spine of Issue-Sense. Lesson 8 names the specific molds that produce off-question answers, so you can catch them by type instead of one at a time.",
      "drill_item_count": 50
    },
    {
      "slug": "lesson-08",
      "number": 8,
      "part": "III",
      "part_title": "Issue-Sense — cut the not-responsive answers",
      "title": "Issue-Sense II — The Not-Responsive Molds",
      "objective": "Catch the not-responsive molds: misfit, bait-doctrine, wrong-element.",
      "est_minutes": 30,
      "body_md": "### Where this sits\n\nLesson 7 gave you the habit — predict the call and the dispositive fact before you peek. Lesson 8 gives you the three shapes a true-but-not-responsive answer takes, so you can catch them by type instead of feeling your way each time. These are the molds that the Ear cannot touch, because every one of them is *true*. They fail the second filter, not the first. Three molds: **misfit**, **bait-doctrine**, and **wrong-element** — arranged from easiest to subtlest.\n\n### The three molds\n\n**Misfit.** The doctrine in the answer is not in play at all — it's borrowed from a different area of law. The issue is whether a repudiation could be retracted, and the answer talks about a *constructive condition*. The issue is Congress's power over the states, and the answer invokes *sovereign immunity*. The issue is the dormant commerce clause, and the answer reaches for *due process*. The rule stated is real and correctly stated; it just isn't this question's law. The tell: name the governing doctrine yourself (you did this in Lesson 7), and the misfit answer is reaching for a *different* doctrine. The further the answer's doctrine sits from the one you predicted, the louder the misfit.\n\n**Bait-doctrine (true rule, wrong context).** This is the dangerous one. The answer states a real rule from the *right area* of law — but a rule that governs a *different context* within that area, not this one. The issue is discovery of a *non-testifying* expert, and the answer recites the *testifying*-expert disclosure rule (right area — expert discovery; wrong context — wrong kind of expert). The issue is *negligent* mishandling of a corpse, and the answer applies the *intentional* infliction standard, \"extreme and outrageous\" (right area — emotional-distress torts; wrong context — wrong tort). The issue is adding a *claim*, and the answer applies the relation-back prong for adding a *party* (right area — Rule 15(c); wrong prong). Bait-doctrine is hard precisely because the area is right and the rule is true — your memory confirms it on both counts. The only defense is the *context* check: this rule is real, but does it govern *this* situation, or its neighbor?\n\n**Wrong-element.** The answer states a true proposition about an element of the claim — but not the *contested, dispositive* element. The plaintiff sues the mother; the answer says *\"the child was negligent\"* — true, and an element of *someone's* liability, but not the mother's. The negligence claim fails for want of harm; the answer establishes *breach* instead. The answer is on-topic and true, but it resolves an element nobody is fighting about while the dispositive element goes unaddressed. The tell: you predicted the dispositive fact (Lesson 7) — the wrong-element answer addresses a *different* element.\n\n### Why these molds beat the Ear\n\nThe Ear hears falsehood. These three are true: a correctly stated rule from another area (misfit), a correctly stated rule from a neighboring context (bait-doctrine), a correctly stated point about a non-dispositive element (wrong-element). Run the Ear over any of them and it stays silent. The catch comes only from Issue-Sense — from having a prediction about what *this* question turns on, and noticing that the answer, however true, isn't about that. This is why Lesson 7 comes first: without a prediction, you have nothing to measure the answer against, and a true off-question answer looks exactly like a right one.\n\n### The discrimination among the three\n\nPractically, you rarely need to label which of the three you're cutting — all three are \"true but not responsive.\" But the distinctions sharpen your eye. Ask, in order: *Is the doctrine even in this area?* (No → misfit.) *Is it the right rule for this context within the area?* (No → bait-doctrine.) *Is it about the element actually in dispute?* (No → wrong-element.) Bait-doctrine is the one to fear; misfit and wrong-element you'll catch quickly once you've predicted the call.\n\n### Worked example\n\nA patient dies; the estate sues the hospital for negligence. The hospital had retained a physician to help its lawyers prepare the defense, then decided *not* to call him as an expert. The estate subpoenas the physician to depose him about his research. The hospital moves to quash. Should the motion be granted?\n\n- A) No — the estate is entitled to full disclosure of experts: qualifications, opinions, and bases.\n- B) No — the physician has nonprivileged information relevant to the estate's claims.\n- C) Yes — unless the estate shows substantial need and undue hardship in obtaining the material otherwise.\n- D) Yes — unless the estate shows exceptional circumstances making it impracticable to obtain the facts or opinions by other means.\n\nYou predicted the call: discovery of an expert the defense retained *but won't call* — a **non-testifying (consulting) expert.** Now sort the molds. **A is bait-doctrine**: the full-disclosure rule is real, but it governs *testifying* experts — right area, wrong kind of expert. **B is wrong-element/half-truth**: relevance is true but isn't the protective standard for a retained consultant. **C is bait-doctrine**: \"substantial need and undue hardship\" is the real standard — for ordinary *fact work product*, not for a consulting expert's opinions. **D** is the consulting-expert standard, and it survives. The two traps (A and C) are both true rules from the right neighborhood; only the *context* check separates them from the answer.\n\n---",
      "drills": [
        {
          "id": "8.1",
          "title": "Name the mold.",
          "instructions_md": "Each choice is true but not responsive. Label **[MISFIT]** (wrong area), **[BAIT-DOCTRINE]** (right area, wrong context), or **[WRONG-ELEMENT]** (not the contested element).",
          "items": [
            "1. *(Discovery of a non-testifying expert.)* \"The estate gets full disclosure of the expert's qualifications, opinions, and bases.\"",
            "2. *(Repudiation retraction.)* \"The buyer's tender was a constructive condition to the seller's duty.\"",
            "3. *(Suit against the mother of a negligent child.)* \"The child was negligent.\"",
            "4. *(Negligent mishandling of a corpse.)* \"The conduct wasn't extreme and outrageous.\"",
            "5. *(Congress's power over states.)* \"The federal government has sovereign immunity.\"",
            "6. *(Adding a *claim* by amendment.)* \"The defendant knew or should have known he'd be sued but for a mistake.\"",
            "7. *(Dormant commerce; state chose a lower bidder.)* \"The state acted irrationally and denied due process.\"",
            "8. *(Informed consent, no harm.)* \"A material risk was not disclosed.\"",
            "9. *(Discovery of a consulting expert.)* \"Discoverable on substantial need and undue hardship.\"",
            "10. *(Strict products liability against a retailer.)* \"The retailer couldn't discover the defect on reasonable inspection.\""
          ],
          "item_count": 10,
          "key_md": "1. **BAIT-DOCTRINE** — testifying-expert rule, wrong kind of expert.\n2. **MISFIT** — constructive conditions aren't the repudiation-retraction issue.\n3. **WRONG-ELEMENT** — the child's fault isn't the mother's liability.\n4. **BAIT-DOCTRINE** — IIED standard in a negligence (NIED) case.\n5. **MISFIT** — sovereign immunity vs Congress's power over states.\n6. **BAIT-DOCTRINE** — the change-of-*party* prong, not the add-a-*claim* prong.\n7. **MISFIT** — due process vs dormant commerce.\n8. **WRONG-ELEMENT** — addresses disclosure, not the missing harm element.\n9. **BAIT-DOCTRINE** — fact-work-product standard, wrong context (it's a consulting expert).\n10. **BAIT-DOCTRINE** — the reasonable-inspection (negligence) standard, wrong theory (strict liability)."
        },
        {
          "id": "8.2",
          "title": "Misfit check. (Is the doctrine even in play?)",
          "instructions_md": "For each, the choice invokes a doctrine. Mark **[IN PLAY]** or **[MISFIT]** (wrong area for this question).",
          "items": [
            "1. *(Retracting a repudiation.)* \"Constructive conditions of exchange.\"",
            "2. *(Dormant commerce; favoring a local bidder.)* \"Procedural due process.\"",
            "3. *(Marketable title; recorded covenant.)* \"The implied covenant of marketable title.\"",
            "4. *(Congress regulating state governments.)* \"Sovereign immunity.\"",
            "5. *(Admissibility of a prior identification by a forgetful witness.)* \"The rule on prior identifications and cross-examination.\"",
            "6. *(A buyer's revocable purchase order.)* \"The merchant firm-offer rule.\"",
            "7. *(Failure to serve within the window.)* \"Rule 4(m) and good cause.\"",
            "8. *(Parol evidence offered to show a subsequent modification.)* \"The parol evidence rule.\"",
            "9. *(Whether a wild-animal keeper is liable for fright.)* \"Strict liability for dangerous propensities.\"",
            "10. *(Whether Rule 11 sanctions lie for a deposition refusal.)* \"Rule 11.\""
          ],
          "item_count": 10,
          "key_md": "1. **MISFIT** — the issue is retractability, not conditions.\n2. **MISFIT** — dormant commerce governs, not due process.\n3. **IN PLAY.**\n4. **MISFIT** — Congress's commerce power and anti-commandeering govern.\n5. **IN PLAY.**\n6. **MISFIT** — a buyer's order isn't a merchant firm offer (the firm-offer rule doesn't make it irrevocable).\n7. **IN PLAY.**\n8. **MISFIT** — the PER doesn't reach subsequent modifications.\n9. **IN PLAY.**\n10. **MISFIT** — Rule 11(d) excludes discovery; Rule 37 governs."
        },
        {
          "id": "8.3",
          "title": "Bait-doctrine. (Right area, right context?)",
          "instructions_md": "Each choice states a real rule from the right area. Decide: **[FITS — this context]** or **[BAIT — neighboring context]** (name the context it actually governs).",
          "items": [
            "1. *(Non-testifying expert.)* \"Exceptional circumstances; impracticable to obtain otherwise.\"",
            "2. *(Non-testifying expert.)* \"Full disclosure of qualifications, opinions, and bases.\"",
            "3. *(Negligent corpse mishandling.)* \"Liability requires extreme and outrageous conduct.\"",
            "4. *(Negligent corpse mishandling.)* \"A defendant who negligently mishandles a body is liable for resulting emotional distress without physical harm.\"",
            "5. *(Adding a claim against the same defendant.)* \"Relates back if it arises from the same conduct, transaction, or occurrence.\"",
            "6. *(Adding a claim against the same defendant.)* \"Relates back if the new party knew or should have known but for a mistake.\"",
            "7. *(Impeaching a witness with a prior bad act.)* \"Extrinsic evidence of the act is not admissible; inquiry on cross only.\"",
            "8. *(Showing a witness's bias.)* \"Extrinsic evidence of the act is not admissible; inquiry on cross only.\"",
            "9. *(Prior identification by a forgetful witness.)* \"Admissible if the declarant testifies and is subject to cross.\"",
            "10. *(Hearsay statement offered for its truth, made by a now-forgetful declarant who testifies.)* \"Inadmissible because the declarant cannot recall the statement.\""
          ],
          "item_count": 10,
          "key_md": "1. **FITS** — consulting-expert standard.\n2. **BAIT** — testifying-expert disclosure.\n3. **BAIT** — IIED context; this is negligent (NIED) mishandling.\n4. **FITS** — the corpse-mishandling NIED rule.\n5. **FITS** — add-a-claim prong.\n6. **BAIT** — change-of-party prong.\n7. **FITS** — 608(b): no extrinsic evidence of specific acts.\n8. **BAIT** — bias may be shown by extrinsic evidence; the no-extrinsic rule governs *character* acts, not bias.\n9. **FITS** — prior-ID / *Owens*.\n10. **BAIT** — memory loss doesn't bar; the declarant is still subject to cross."
        },
        {
          "id": "8.4",
          "title": "Wrong-element. (Is this the contested element?)",
          "instructions_md": "For each, the choice addresses an element. Mark **[DISPOSITIVE — the contested element]** or **[WRONG-ELEMENT]** (name the element actually in dispute).",
          "items": [
            "1. *(Suit against the mother of a negligent child.)* \"The child was negligent.\"",
            "2. *(Informed consent, no harm.)* \"The patient would have refused had he known.\"",
            "3. *(Negligence, undisclosed risk that never materialized.)* \"The risk was material and undisclosed.\"",
            "4. *(Defamation, public figure.)* \"The statement was false.\"",
            "5. *(Negligence, proximate cause disputed.)* \"The defendant's act was a but-for cause.\"",
            "6. *(Strict products liability, defect causation disputed.)* \"The product was unreasonably dangerous.\"",
            "7. *(Battery, intent disputed.)* \"A harmful contact resulted.\"",
            "8. *(First-degree murder = poison or premeditation; deadliness disputed.)* \"The defendant intended to cause discomfort.\"",
            "9. *(Negligent supervision claim against the mother.)* \"The mother failed to adequately supervise.\"",
            "10. *(Defamation, private figure, fault disputed.)* \"The statement was published to a third party.\""
          ],
          "item_count": 10,
          "key_md": "1. **WRONG-ELEMENT** — the contested element is the *mother's* breach (supervision).\n2. **WRONG-ELEMENT** — the contested element is *harm* (there is none).\n3. **WRONG-ELEMENT** — the contested element is whether the risk *materialized and caused harm*.\n4. **WRONG-ELEMENT** — the contested element is *actual malice*.\n5. **WRONG-ELEMENT** — the contested element is *proximate* cause.\n6. **DISPOSITIVE** — if defect/danger is the contested point. (If causation is the fight, treat as wrong-element; per the framing here, danger is contested → dispositive.)\n7. **WRONG-ELEMENT** — the contested element is *intent*.\n8. **DISPOSITIVE-ADJACENT** — intent-to-discomfort is exactly what negates premeditation/poison-as-deadly; treat as **dispositive** here (it resolves the contested predicate).\n9. **DISPOSITIVE** — the mother's own breach is the contested element.\n10. **WRONG-ELEMENT** — the contested element is *fault* as to falsity."
        },
        {
          "id": "8.5",
          "title": "Cut the not-responsive answers in context.",
          "instructions_md": "Full questions. Cut the misfit / bait-doctrine / wrong-element distractors and pick the survivor.",
          "items": [
            "1. *(Quash subpoena of a retained-but-uncalled expert.)* A) full disclosure of opinions/bases; B) nonprivileged and relevant; C) substantial need + undue hardship; D) exceptional circumstances, impracticable otherwise.",
            "2. *(Repudiation retracted after a substitute purchase.)* A) retracted before performance; B) constructive condition; C) not retractable once communicated; D) relied before retraction.",
            "3. *(Suit against the mother of a negligent child.)* A) child negligent; B) liable for any harm; C) assumed risk; D) failed to supervise.",
            "4. *(Negligent corpse mishandling; mother's distress.)* A) no threat to her safety; B) not extreme and outrageous; C) negligently failed to safeguard the body; D) no physical harm.",
            "5. *(Federal fleet rule applied to a city; injunction sought.)* A) valid; no Tenth Amendment violation; B) sovereign immunity; C) reserved state rights; D) exceeds commerce power as applied.",
            "6. *(Add a negligence claim; original claim was failure to disclose an alternative method.)* A) SOL expired the next day; B) different occurrence; C) knew-or-should-have-known but for a mistake; D) relates back.",
            "7. *(Dormant commerce; state chose a lower local bidder.)* A) compelling interest; B) market participant; C) irrational, due process; D) discriminated against commerce.",
            "8. *(Informed consent, no harm.)* A) best judgment; B) no harm; C) would have refused; D) must always be told the risks.",
            "9. *(Prior statement by a forgetful assault victim.)* A) no showing of personal knowledge; B) memory loss bars cross; C) subject to cross, knowledge shown; D) his own out-of-court statement.",
            "10. *(Rescuer hurt after a defective device failed; products claim.)* A) couldn't discover the defect on inspection; B) rescuer didn't rely; C) climber wasn't negligent; D) injury to a rescuer was foreseeable."
          ],
          "item_count": 10,
          "key_md": "1. **D.** A bait (testifying rule); B wrong-element (relevance); C bait (fact-WP standard).\n2. **D.** B misfit (constructive condition); A is the opposite-fact twin (no reliance); C is false (Ear).\n3. **D.** A wrong-element (child's fault); B overclaim; C misfit (assumption of risk).\n4. **C.** A misfit (zone of danger); B bait (IIED); D backwards (corpse exception waives physical harm).\n5. **A.** B misfit (sovereign immunity); C/D misstate the commerce/Tenth-Amendment law.\n6. **B.** C bait (change-of-party prong); A wrong-element (ignores relation-back); D is the opposite-conclusion twin (these are different occurrences).\n7. **B.** A misfit (no valid protectionist interest); C misfit (due process); D is the regulator twin (state was a market participant).\n8. **B.** A autonomy/colloquial; C half-truth/wrong-element (no harm); D overclaim.\n9. **C.** A half-truth; B backwards; D flat misstatement.\n10. **D.** A bait (negligence inspection defense); B backwards (reliance); C wrong-element (climber's conduct)."
        }
      ],
      "how_to_use_md": "Bait-doctrine is the mold this lesson exists for — Drill 8.3 isolates it, and it's worth more reps than the other two, because it's the one your memory actively confirms while leading you wrong. The discipline that beats it is the context check: *this rule is real — does it govern this situation or its neighbor?* Drills 8.2 and 8.4 keep misfit and wrong-element sharp, but those you'll catch fast once you've predicted the call. Drill 8.5 puts all three in live questions alongside the Ear molds, which is the real exam. When you can name the governing doctrine, then watch a true answer reach for a *different* doctrine, a *neighboring* context, or a *non-contested* element, Issue-Sense is operating. Lesson 9 takes the two survivors that remain after a good Cut and shows you how to resolve them — the Clash.",
      "drill_item_count": 50
    },
    {
      "slug": "lesson-09",
      "number": 9,
      "part": "III",
      "part_title": "Issue-Sense — cut the not-responsive answers",
      "title": "Issue-Sense III — Tension Points and the Clash",
      "objective": "Resolve a two-survivor fork by naming the axis and finding the fact that decides it.",
      "est_minutes": 31,
      "body_md": "### Where this sits\n\nA good Cut (Lessons 4–8) usually leaves you with one survivor — but on harder questions it leaves two. Lesson 9 is what you do with two. The two survivors are never random: they disagree on exactly one axis, and the exam reuses the same axes over and over. Name the axis, find the one fact in the stem that sits on it, and the fact decides. This is the **Clash**, the middle phase of the workflow. The lesson closes with a protective tool the validation work earned: the **fork-detector**, which tells you when a question *cannot* be resolved without the fact — so you don't fool yourself into a clean-looking cut that's really a coin.\n\n### What a tension point is\n\nWhen the Cut leaves two answers, they are almost always the *same rule applied to opposite facts*, or *two true rules competing for the same question*. The disagreement reduces to a single binary — a tension point. Was the state a market participant or a regulator? Was the speech regulation content-based or content-neutral? Did the new claim arise from the same occurrence or a different one? Was the expert testifying or consulting? You don't resolve a tension point by deciding which answer is \"better.\" You resolve it by identifying the axis, then reading the stem for the fact that sits on that axis. The fact, not your preference, breaks the tie.\n\nThis is why prediction (Lesson 7) and the not-responsive molds (Lesson 8) come first: by the time you reach the Clash, you've already named the governing doctrine and cut the answers that don't respond. The two left standing are both responsive and both at least arguably true — which is exactly the situation where the dispositive fact is doing all the work.\n\n### A working catalog of high-frequency tension points\n\nYou will see these axes repeatedly. Learn to recognize the pair, name the axis, and know which fact resolves it:\n\n- **Direct vs vicarious liability** — is the defendant liable for *their own* conduct or for *another's*? (Parent's negligent supervision vs vicarious liability for the child.) *Fact:* whose conduct the claim targets.\n- **Market participant vs regulator** — is the state buying/selling, or regulating? *Fact:* whether the state is a party to a market transaction.\n- **Content-based vs content-neutral** — does the speech rule turn on the message? *Fact:* whether the regulation distinguishes by subject/viewpoint.\n- **Testifying vs consulting expert** — which discovery standard governs? *Fact:* whether the expert will testify.\n- **Same occurrence vs different occurrence** (relation back) — does the new claim share the original's transaction? *Fact:* whether the operative events overlap.\n- **Retractable vs fixed repudiation** — was the repudiation retracted before reliance? *Fact:* the timing of any material reliance.\n- **Legal vs equitable** (jury right) — does the claim sound in law or equity? *Fact:* the remedy sought and the nature of the issue.\n- **Federal vs state ground** (SCOTUS review) — does the state judgment rest on an adequate, independent state ground? *Fact:* whether the decision also rests on state law.\n- **Legal vs factual impossibility** (criminal attempt) — was the intended act a crime, or merely factually impossible? *Fact:* what the defendant believed and intended.\n- **Bilateral vs unilateral conspiracy** — does the jurisdiction require two guilty minds (common law) or one (MPC)? *Fact:* the jurisdiction's rule and the co-party's state.\n- **608(b) character vs bias** (impeachment) — is the cross about a character-for-truthfulness act (no extrinsic) or about bias (extrinsic allowed)? *Fact:* what the impeachment is trying to show.\n- **803(18) substantive vs 703 basis-only** (learned treatise) — is the treatise coming in for its truth or to explain an expert's basis? *Fact:* the purpose of the offer.\n\nThe list isn't exhaustive — the full set runs to a couple dozen — but these carry most two-survivor questions. The skill is not memorizing them as trivia; it's recognizing, when two answers remain, *which axis they're fighting on.*\n\n### The Clash routine\n\n1. **Name the axis.** State the single binary the two survivors disagree on, in your own words.\n2. **Locate the fact.** Find the one fact in the stem that sits on that axis — the timing, the status, the remedy, the purpose.\n3. **Let the fact decide.** Map the fact to the side of the axis it supports, and that's your answer.\n\nIf you can't name the axis, you haven't actually cut to two — you're still comparing on vibes. If you can name the axis but can't find a deciding fact, you may be looking at a fork.\n\n### The fork-detector (missing-fact forks)\n\nSome question types are built so that two true answers survive and *only the dispositive fact decides* — which means you cannot resolve them from the choices alone, and you must not pretend you can. These are the **always-forks**:\n\n- **Relation back** — \"same occurrence\" is a factual finding; the choices alone won't tell you.\n- **12(b)(6) sufficiency** — deficient vs adequate is a judgment about *this* complaint.\n- **Degree of crime / is-it-a-crime** — turns on the facts and the available defenses.\n- **Plaintiff's-status premises liability** — trespasser, licensee, or invitee is a fact about the entrant.\n- **Service / SOL tolling** — timing and good-cause facts decide it.\n- **Substantiality of an embedded federal issue** — whether a federal question is \"substantial\" is a fact-laden judgment.\n\nWhen you spot one of these signatures, do not commit on the choices alone. Go to the stem for the deciding fact; if the stem withholds it, flag the question as a genuine fork. The discipline this enforces: a clean-looking cut on a fork-type question is usually an illusion — you supplied the missing fact by assumption, and assumed facts are how the right answer gets cut. Recognizing the signature is what keeps you from that error.\n\n### Worked example\n\nA state owns a natural gas field and takes bids to exploit it. The highest bid comes from an interstate pipeline company; the next-highest from a local company that promises to pass savings to local customers. The state awards the contract to the local company. The interstate company sues. Should it prevail?\n\nAfter the Cut, two survive: **B — no, the state acted as a market participant**, and **D — yes, the state discriminated against interstate commerce.** (A invokes a protectionist \"compelling interest\" that isn't valid — misfit; C reaches for due process — misfit.) **Name the axis:** market participant vs regulator. **Locate the fact:** the state *owned the field and sold it by taking bids* — it was a party to a market transaction, not a regulator of others' transactions. **Let the fact decide:** market participant → the dormant commerce clause doesn't apply → the state may favor the local bidder → **B.** Two responsive, plausible answers; one fact on one axis resolves them.\n\n---",
      "drills": [
        {
          "id": "9.1",
          "title": "Name the axis.",
          "instructions_md": "Each item gives the two survivors. State the **single axis** they disagree on.",
          "items": [
            "1. \"Market participant\" vs \"discriminated against interstate commerce.\"",
            "2. \"Content-neutral\" vs \"content-based.\"",
            "3. \"Failed to adequately supervise\" vs \"liable for any harm the child causes.\"",
            "4. \"Relates back\" vs \"different occurrence.\"",
            "5. \"Retracted before performance\" vs \"buyer relied before retraction.\"",
            "6. \"Adequate and independent state ground\" vs \"rests on an interpretation of federal law.\"",
            "7. \"Consulting-expert standard\" vs \"testifying-expert disclosure.\"",
            "8. \"No jury — equity\" vs \"jury — legal claim.\"",
            "9. \"Extreme and outrageous (IIED)\" vs \"negligent failure to safeguard (NIED).\"",
            "10. \"State law provides the jury\" vs \"Seventh Amendment not incorporated.\""
          ],
          "item_count": 10,
          "key_md": "1. Market participant vs regulator.\n2. Whether the regulation turns on the message's content.\n3. Direct (own) vs vicarious (another's) liability.\n4. Same occurrence vs different occurrence.\n5. Whether the repudiation was retracted before material reliance.\n6. Independent state ground vs federal-law ground.\n7. Whether the expert will testify.\n8. Legal vs equitable (remedy/issue nature).\n9. Intentional vs negligent emotional-distress tort.\n10. Source of the jury right (state law vs federal constitution) — i.e., which question is being answered."
        },
        {
          "id": "9.2",
          "title": "Find the resolving fact.",
          "instructions_md": "Given the axis and a compact stem, name the **fact** that resolves it.",
          "items": [
            "1. *(Market participant vs regulator.)* The state owned the gas field and sold it by bid.",
            "2. *(Content-based vs neutral.)* The picketing ban exempts picketing about zoning.",
            "3. *(Direct vs vicarious.)* The claim is brought against the mother, not the child.",
            "4. *(Same vs different occurrence.)* Original claim: failure to disclose an alternative; new claim: negligent performance.",
            "5. *(Retracted vs relied.)* Substitute bought June 5; retraction June 10.",
            "6. *(Independent state ground vs federal.)* The court struck the law under both the federal and state constitutions.",
            "7. *(Testifying vs consulting.)* The expert was retained for the defense and then not called.",
            "8. *(Legal vs equitable.)* The plaintiff seeks compensatory damages on a product-defect claim.",
            "9. *(IIED vs NIED.)* The mausoleum *negligently* secured the body; there was no intent.",
            "10. *(Source of jury right.)* State rules provide a jury in contract disputes; the demand is made in state court."
          ],
          "item_count": 10,
          "key_md": "1. State was a party to a market transaction → participant.\n2. The exemption distinguishes by subject → content-based.\n3. The target is the mother's own conduct → direct (supervision).\n4. The events don't overlap → different occurrence.\n5. Reliance preceded the retraction → retraction ineffective.\n6. The judgment rests on an adequate, independent state ground → no review.\n7. The expert won't testify → consulting standard.\n8. Damages on a legal claim → jury right on the merits.\n9. No intent → NIED, not IIED.\n10. State law supplies the right → the source is state law."
        },
        {
          "id": "9.3",
          "title": "Resolve the Clash. (Cut to two given; the fact decides.)",
          "instructions_md": "Pick the survivor.",
          "items": [
            "1. *(State gas field, bids.)* B) market participant; D) discriminated against commerce. → ?",
            "2. *(Picketing ban exempting zoning topics.)* A) content-neutral; D) content-based. → ?",
            "3. *(Suit against the mother.)* B) liable for any harm; D) failed to supervise. → ?",
            "4. *(Disclosure claim, then performance claim.)* B) different occurrence; D) relates back. → ?",
            "5. *(Repudiation; substitute bought before retraction.)* A) retracted before performance; D) relied before retraction. → ?",
            "6. *(State law struck on dual grounds; SCOTUS petition.)* A) independent state ground; C) federal-law interpretation. → ?",
            "7. *(Retained-but-uncalled expert.)* C) substantial need + undue hardship; D) exceptional circumstances. → ?",
            "8. *(Product-defect damages claim; jury demand.)* \"no jury — equity\" vs \"jury — legal claim.\" → ?",
            "9. *(Negligently secured corpse; mother's distress.)* B) extreme and outrageous; C) negligent failure to safeguard. → ?",
            "10. *(Contractor's jury demand in state court; state rules grant juries in contract cases.)* B) Seventh Amendment not incorporated; D) state law provides the jury. → ?"
          ],
          "item_count": 10,
          "key_md": "1. **B.** 2. **D.** 3. **D.** 4. **B.** 5. **D.** 6. **A.** 7. **D.** 8. **jury — legal claim.** 9. **C.** 10. **D.**"
        },
        {
          "id": "9.4",
          "title": "Fork-detector. (Clean, or a missing-fact fork?)",
          "instructions_md": "For each question signature, decide: **[CLEAN — resolvable on the choices/rule]** or **[FORK — needs the dispositive fact; flag if absent]**.",
          "items": [
            "1. Whether a new claim \"relates back\" to the original complaint.",
            "2. Whether a merchant's firm offer is still open after four months.",
            "3. Whether a complaint survives a 12(b)(6) motion.",
            "4. Whether a killing is first-degree murder.",
            "5. Whether the Seventh Amendment is incorporated against the states.",
            "6. Whether an entrant was owed an invitee's duty.",
            "7. Whether service was timely / the SOL was tolled.",
            "8. Whether Rule 23(f) permits an interlocutory appeal of certification.",
            "9. Whether an embedded federal issue is \"substantial\" enough for jurisdiction.",
            "10. Whether a parol-evidence offer concerns a subsequent modification."
          ],
          "item_count": 10,
          "key_md": "1. **FORK** — same-occurrence is factual.\n2. **CLEAN** — the three-month cap is a rule.\n3. **FORK** — sufficiency of *this* complaint is a judgment.\n4. **FORK** — depends on the facts and defenses.\n5. **CLEAN** — categorical (not incorporated).\n6. **FORK** — the entrant's status is a fact.\n7. **FORK** — timing and good-cause facts decide it.\n8. **CLEAN** — the rule answers it (certification only).\n9. **FORK** — substantiality is a fact-laden judgment.\n10. **CLEAN** — the PER's scope (no subsequent modifications) is a rule."
        },
        {
          "id": "9.5",
          "title": "Full Clash in context.",
          "instructions_md": "Full questions. Cut to two, name the axis, find the fact, pick the survivor.",
          "items": [
            "1. *(State gas field sold by bid to a lower local bidder.)* A) compelling interest; B) market participant; C) due process; D) discriminated against commerce.",
            "2. *(Picketing ban with a zoning-topic exception.)* A) content-neutral; B) regulates conduct; C) irrational discrimination; D) content-based.",
            "3. *(Add a negligence claim; original was failure to disclose an alternative.)* A) SOL expired the next day; B) different occurrence; C) knew-or-should-have-known but for a mistake; D) relates back.",
            "4. *(Repudiation retracted after a substitute purchase.)* A) retracted before performance; B) constructive condition; C) not retractable once communicated; D) relied before retraction.",
            "5. *(Quash subpoena of a retained-but-uncalled expert.)* A) full disclosure; B) relevant; C) substantial need + undue hardship; D) exceptional circumstances.",
            "6. *(State law struck on federal and state grounds; SCOTUS petition.)* A) independent state ground; B) only federal-law-constitutionality decisions; C) any federal-law interpretation; D) decisions striking laws under the federal Constitution.",
            "7. *(Suit against the mother of a negligent child.)* A) child negligent; B) liable for any harm; C) assumed risk; D) failed to supervise.",
            "8. *(Contractor's jury demand in state court; state rules grant juries in contract cases.)* A) Sixth Amendment doesn't apply; B) Seventh Amendment not incorporated; C) Sixth Amendment applies; D) state law provides the jury.",
            "9. *(Negligently secured corpse; mother's distress.)* A) no threat to safety; B) not extreme/outrageous; C) negligent failure to safeguard; D) no physical harm.",
            "10. *(Botanist's mixed legal and equitable claims; jury demand.)* A) essentially equitable, no jury; B) none bear exclusively on equity; C) jury on every claim regardless; D) jury because the issues are common to legal and equitable claims."
          ],
          "item_count": 10,
          "key_md": "1. **B** — axis: participant vs regulator; fact: state sold by bid.\n2. **D** — axis: content; fact: zoning-topic exemption.\n3. **B** — axis: same vs different occurrence; fact: disclosure vs performance. (C is the wrong-prong bait, cut earlier.)\n4. **D** — axis: retracted vs relied; fact: substitute bought before retraction.\n5. **D** — axis: testifying vs consulting; fact: retained, not called.\n6. **A** — axis: independent state ground vs federal; fact: dual grounds.\n7. **D** — axis: direct vs vicarious; fact: claim targets the mother.\n8. **D** — axis: source of the jury right; fact: state law grants it.\n9. **C** — axis: IIED vs NIED; fact: negligence, no intent.\n10. **D** — axis: legal vs equitable with common issues; fact: shared issues → jury on the common/legal issues (Beacon Theatres). (C overclaims \"every claim regardless.\")"
        }
      ],
      "how_to_use_md": "Drill 9.1 is the move to make automatic: the instant two answers survive, name the axis. Drill 9.2 trains the second beat — the axis points you to a *specific* fact, not a general feeling about the stem. Drill 9.4 is the discipline that the validation work paid for: recognizing the always-fork signatures so you don't manufacture a clean cut on a question that has none. A flagged fork is a correct outcome on a question the choices can't settle; a confident wrong answer on the same question is the most avoidable miss there is. When you reflexively name the axis, find the fact, and flag the forks, the Clash is yours. Lesson 10 handles the hardest version of two survivors — when the two answers are a matched pair separated by a single fact, and when the choices are ambiguous about the question itself.",
      "drill_item_count": 50
    },
    {
      "slug": "lesson-10",
      "number": 10,
      "part": "III",
      "part_title": "Issue-Sense — cut the not-responsive answers",
      "title": "Issue-Sense IV — Matched-Pair-on-a-Fact",
      "objective": "Read a matched pair as a pointer to one fact — stop grading the prose, go to the stem.",
      "est_minutes": 31,
      "body_md": "### Where this sits\n\nLesson 9 resolved two survivors by naming the axis and finding the fact. Lesson 10 is the hardest version of that: when the two survivors are a **matched pair** — identical in form, differing by a single fact or a single word — so the entire question collapses onto one fact, and the choices themselves give you almost nothing to work with. This is the pattern that, in blind testing, the method failed on without the stem and aced with it: it is the purest demonstration that some questions are decided by a fact and a fact alone. The lesson also covers a deeper trap the validation surfaced — **question-ambiguity**, where the answer set won't even tell you which question is being asked.\n\n### The matched pair\n\nA matched pair is two answers that state the *same rule applied to opposite facts*, or two formally parallel propositions split by one variable. \"No, the seller retracted before the time for performance\" and \"Yes, the buyer relied before the retraction\" are the same retractability rule pointed at opposite versions of one fact — the timing of reliance. \"No, because the new claim arose from a different occurrence\" and \"Yes, because it relates back\" are the same relation-back rule split by whether the occurrences overlap. Sometimes the pair is a quartet: four answers, each reciting the duty owed to a *different* class of entrant — trespasser, licensee, invitee — so the whole question is the entrant's status.\n\nWhat makes the matched pair hard is that the choices are *symmetric*. Neither answer is more \"lawyerly,\" neither overclaims, neither misfits — the Ear has nothing to grab, and even the Clash axis, once named, doesn't resolve on the page. The only thing that breaks the symmetry is the fact in the stem. This is the situation where a test-taker working from the choices alone is reduced to guessing, and where a test-taker who went to the stem for the deciding fact gets it cleanly.\n\n### The one rule for matched pairs\n\n**When you recognize a matched pair, stop working the choices and go to the stem for the single deciding fact.** Do not try to reason about which answer \"sounds right\" — by construction, they sound equally right. Name the variable the pair is split on (the timing, the status, the remedy, the substance), find that exact fact in the stem, and let it pick. If the stem withholds the fact, you are looking at a fork and you flag it — guessing between a matched pair without the fact is a coin, and the honest move is to say so.\n\nThis is the operational core of the whole course's central finding: the Ear is fact-independent, but the matched pair is the place where Issue-Sense is *purely* fact-dependent — there is no technique that resolves it short of the fact. Recognizing the pair is recognizing that the fact is the entire question.\n\n### Question-ambiguity: when the choices won't tell you the question\n\nThere is a subtler trap than a matched pair on a fact: a matched *set* on the *question itself*. Some answer patterns are compatible with more than one question, and you cannot know which question you're answering from the choices alone — only the stem disambiguates. The signature pattern is **\"Yes, but only on X / only on Y / on both / on neither.\"** That exact shape can be the answer to *what is appealable* or *what gets a jury* or *what a court may review* — four very different questions wearing identical clothes. A test-taker who reads the choices and assumes the question (assumes it's an appealability question when it's a jury-right question) will reason flawlessly to the wrong answer.\n\nThe defense is a flag, not a technique: **when you see the \"only-X / only-Y / both / neither\" pattern, do not assume the question — confirm it from the stem.** The stem will tell you whether the motion was to strike a jury demand, to certify an appeal, or to limit review. Until you've confirmed the question, you cannot trust any answer, because you don't yet know what's being asked.\n\nA related, quieter version: two answers that reach the same surface result (\"no jury\") for different reasons, where the right reason depends on a framing fact — *is the demand made under state law or the federal Constitution? in state court or federal?* The state-jury-right pair is the type case: one answer says the state's own rules grant a jury, the other says the Seventh Amendment isn't incorporated; same surface, opposite analyses, and only the stem's framing (which right is asserted, which court) tells you which is responsive. Treat framing as a fact to confirm, exactly like any other.\n\n### Worked example (matched pair)\n\nA contractor sues a man in **state court** for breach of contract, demanding a jury under the state's rules, which provide a jury right in contract disputes. The man argues there's no jury right. Is the contractor entitled to a jury?\n\n- A) No — the Sixth Amendment doesn't apply to state contract actions.\n- B) No — the Seventh Amendment isn't incorporated against the states.\n- C) Yes — the Sixth Amendment applies to state contract actions.\n- D) Yes — state law provides for jury trials in contract disputes.\n\nCut the Sixth-Amendment pair (A and C) — the Sixth Amendment is criminal; misfit on a contract case. That leaves a matched pair on the *source of the right*: **B (no — the federal Seventh Amendment isn't incorporated)** vs **D (yes — state law grants it).** Same surface terrain, opposite answers. The choices won't break the tie. Go to the stem: the demand is made under *the state's own rules*, which *provide* a jury in contract cases. The responsive question is \"is he entitled to a jury at all,\" and state law answers yes — **D.** The trap, B, answers a *different* question (\"is there a *federal* right?\"), and you'd have picked it by assuming the question was about the Constitution. The stem's framing — state rules, state court, state-law demand — is the deciding fact.\n\n---",
      "drills": [
        {
          "id": "10.1",
          "title": "Spot the matched pair.",
          "instructions_md": "For each 4-choice set, identify which choices form a **matched pair** (same rule/form, opposite fact) — or whether the whole set is a matched *quartet* on one variable.",
          "items": [
            "1. *(Repudiation.)* A) retracted before performance; B) constructive condition; C) not retractable once communicated; D) relied before retraction.",
            "2. *(Premises liability; entrant status unstated.)* A) no — trespasser; B) no — not willful/wanton; C) yes — invitee duty; D) yes — clerk knew the entrant was unaware of the danger.",
            "3. *(Relation back.)* A) SOL expired the next day; B) different occurrence; C) change-of-party prong; D) relates back.",
            "4. *(State-court jury demand under state rules.)* A) Sixth Amendment doesn't apply; B) Seventh Amendment not incorporated; C) Sixth Amendment applies; D) state law provides the jury.",
            "5. *(Firm offer; one month inside the year.)* A) PE; B) firm for that month; C) no consideration; D) longer than three months.",
            "6. *(SCOTUS review; grounds unstated.)* A) independent state ground; B) only federal-constitutionality decisions; C) any federal-law interpretation; D) decisions striking laws under the federal Constitution.",
            "7. *(Dormant commerce.)* A) compelling interest; B) market participant; C) due process; D) discriminated against commerce.",
            "8. *(Conspiracy; jurisdiction's rule unstated.)* A) guilty — bilateral met; B) not guilty — the other feigned agreement; C) guilty — unilateral suffices; D) not guilty — withdrawal.",
            "9. *(Expert discovery.)* A) full disclosure; B) relevant; C) substantial need + undue hardship; D) exceptional circumstances.",
            "10. *(Offer/acceptance; revocation timing.)* A) acceptable only by shipment, revoked first; B) never agreed to price; C) irrevocable offer; D) seller accepted before revocation."
          ],
          "item_count": 10,
          "key_md": "1. **A vs D** — retractability split on reliance timing (B/C cut).\n2. **Matched quartet** on entrant status (trespasser/licensee/invitee duties).\n3. **B vs D** — same-occurrence split (A/C cut).\n4. **B vs D** — source of the jury right (A/C cut — Sixth Amendment misfit).\n5. **B vs D** — firm-offer duration split (A/C cut).\n6. **A vs C** — independent-state-ground vs federal-law split (B/D cut as false jurisdiction statements).\n7. **B vs D** — participant vs regulator (A/C cut).\n8. **A/C vs B/D** — guilt split on the bilateral/unilateral rule and on the co-party's state; effectively a matched set on the conspiracy rule and the facts.\n9. **C vs D** — fact-work-product vs consulting-expert standard (A/B cut).\n10. **A vs D** — acceptance-before-revocation split on timing (B/C cut; C also false)."
        },
        {
          "id": "10.2",
          "title": "Name the deciding fact.",
          "instructions_md": "Given the matched pair and a compact stem, name the **single fact** that picks the winner.",
          "items": [
            "1. *(Retracted vs relied.)* Substitute bought June 5; retraction June 10.",
            "2. *(Entrant status quartet.)* The plaintiff went behind a \"No Admittance\" counter to get an item, after a clerk said nothing.",
            "3. *(Same vs different occurrence.)* Original: failure to disclose an alternative; new: negligent performance.",
            "4. *(Source of jury right.)* The demand is under the state's own rules, in state court.",
            "5. *(Firm-offer duration.)* The disputed orders fall a month after a \"for the coming year\" assurance.",
            "6. *(Independent state ground vs federal.)* The court struck the law under both the federal and the state constitutions.",
            "7. *(Participant vs regulator.)* The state owned the field and sold it by bid.",
            "8. *(Bilateral vs unilateral conspiracy.)* The only other \"conspirator\" was an undercover officer who never intended to agree, in a common-law jurisdiction.",
            "9. *(Fact-WP vs consulting expert.)* The expert was retained for the defense and won't testify.",
            "10. *(Acceptance vs revocation timing.)* The seller mailed acceptance on the 7th; the buyer phoned a revocation on the 8th."
          ],
          "item_count": 10,
          "key_md": "1. Reliance preceded the retraction → retraction ineffective.\n2. The entrant went where he wasn't permitted → trespasser (or at most a licensee), with the clerk's knowledge of his ignorance of the hazard pointing to the licensee duty.\n3. The events don't overlap → different occurrence.\n4. State law supplies the right → answer on state-law grounds.\n5. The month is within the three-month cap → still firm.\n6. The judgment rests on an adequate, independent state ground.\n7. The state was a market party → participant.\n8. Common-law jurisdiction + a feigning \"co-conspirator\" → no bilateral agreement.\n9. The expert won't testify → consulting-expert standard.\n10. Acceptance was effective on dispatch (the 7th), before the revocation (the 8th)."
        },
        {
          "id": "10.3",
          "title": "Resolve the matched pair.",
          "instructions_md": "Pick the survivor using the deciding fact.",
          "items": [
            "1. *(Substitute bought before retraction.)* A) retracted before performance; D) relied before retraction. → ?",
            "2. *(Entrant behind a \"No Admittance\" counter; clerk knew he was unaware of an open shaft.)* C) invitee duty; D) clerk knew the entrant was unaware of the danger. → ?",
            "3. *(Disclosure claim, then performance claim.)* B) different occurrence; D) relates back. → ?",
            "4. *(Demand under state rules, state court.)* B) Seventh Amendment not incorporated; D) state law provides the jury. → ?",
            "5. *(Orders a month into a \"coming year\" assurance.)* B) firm for that month; D) longer than three months. → ?",
            "6. *(Law struck on federal and state grounds.)* A) independent state ground; C) federal-law interpretation. → ?",
            "7. *(State sold the field by bid.)* B) market participant; D) discriminated against commerce. → ?",
            "8. *(Feigning co-conspirator, common-law jurisdiction.)* A) bilateral met; B) the other feigned agreement. → ?",
            "9. *(Expert retained, won't testify.)* C) substantial need + undue hardship; D) exceptional circumstances. → ?",
            "10. *(Seller mailed acceptance before the buyer's revocation.)* A) revoked before shipment; D) seller accepted before revocation. → ?"
          ],
          "item_count": 10,
          "key_md": "1. **D.** 2. **D** (licensee duty: warn of known, non-obvious dangers). 3. **B.** 4. **D.** 5. **B.** 6. **A.** 7. **B.** 8. **B.** 9. **D.** 10. **D.**"
        },
        {
          "id": "10.4",
          "title": "Question-ambiguity detector.",
          "instructions_md": "For each answer pattern, decide: **[CLEAN — the question is fixed]** or **[AMBIGUOUS — confirm the question from the stem before committing]** (name the questions it could be answering).",
          "items": [
            "1. \"Yes on both certification and the merits / only the merits / only certification / neither.\"",
            "2. \"The contract is void / voidable / valid / unenforceable.\"",
            "3. \"No — Seventh Amendment not incorporated / No — equity / Yes — at common law / Yes — de minimis value.\" (state vs federal court unstated)",
            "4. \"Admissible as an excited utterance / present sense impression / dying declaration / not admissible.\"",
            "5. \"Yes, but only as to liability / only as to damages / as to both / as to neither.\"",
            "6. \"The covenant runs with the land / does not run / is a license / is an easement.\"",
            "7. \"No review — independent state ground / review — federal-law interpretation.\" (which the decision rests on is unstated)",
            "8. \"Granted / granted in part / denied / denied as moot.\" (which motion is unstated)",
            "9. \"Negligence / strict liability / both / neither apply.\" (theory pleaded unstated)",
            "10. \"Reversed / affirmed / remanded / dismissed.\" (the ground for the lower ruling unstated)"
          ],
          "item_count": 10,
          "key_md": "1. **AMBIGUOUS** — appealability vs jury-scope vs scope-of-review.\n2. **CLEAN** — a fixed contract-status question.\n3. **AMBIGUOUS** — state-court (incorporation) vs federal-court (equity) jury question; confirm the court.\n4. **CLEAN** — a fixed hearsay-exception question (the stem's facts pick the exception, but the *question* is fixed).\n5. **AMBIGUOUS** — could be jury-right scope, appeal scope, or judgment scope; confirm.\n6. **CLEAN** — a fixed servitude-classification question.\n7. **AMBIGUOUS** — depends on which ground the decision rests on; confirm from the stem.\n8. **AMBIGUOUS** — meaningless until you know *which* motion; confirm.\n9. **AMBIGUOUS** — depends on the theory pleaded and the facts; confirm.\n10. **AMBIGUOUS** — disposition depends entirely on the ground; confirm."
        },
        {
          "id": "10.5",
          "title": "Full matched-pair / ambiguity in context.",
          "instructions_md": "Full questions. Confirm the question, name the pair's variable, find the fact, pick the survivor.",
          "items": [
            "1. *(Class representative seeks a jury on a damages claim; defendant moves to strike the jury demand; \"class actions are historically equitable.\")* A) jury on both certification and merits; B) jury only on the merits; C) jury only on certification; D) no jury on either.",
            "2. *(Contractor's jury demand in state court under state rules.)* A) Sixth Amendment doesn't apply; B) Seventh Amendment not incorporated; C) Sixth Amendment applies; D) state law provides the jury.",
            "3. *(Employee's jury demand under the Seventh Amendment, in state court, for an injunction.)* A) Seventh Amendment not incorporated; B) equity, no jury; C) common-law contract suit; D) de minimis value.",
            "4. *(Entrant went behind a \"No Admittance\" counter; clerk knew of an open shaft and that the entrant was unaware.)* A) no — trespasser; B) no — not willful/wanton; C) yes — invitee duty; D) yes — clerk knew the entrant was unaware of the danger.",
            "5. *(Repudiation retracted after a substitute purchase.)* A) retracted before performance; B) constructive condition; C) not retractable once communicated; D) relied before retraction.",
            "6. *(Negligence claim added; original was failure to disclose an alternative.)* A) SOL expired the next day; B) different occurrence; C) change-of-party prong; D) relates back.",
            "7. *(State law struck on federal and state grounds; SCOTUS petition.)* A) independent state ground; B) only federal-constitutionality decisions; C) any federal-law interpretation; D) decisions striking laws under the federal Constitution.",
            "8. *(Buyer's mailed-acceptance scenario; phone revocation the next day.)* A) acceptable only by shipment, revoked first; B) never agreed to price; C) irrevocable offer; D) seller accepted before revocation.",
            "9. *(Firm-offer assurance \"for the coming year\"; orders a month later.)* A) PE; B) firm for that month; C) no consideration; D) longer than three months.",
            "10. *(Comedian adds, by supplemental pleading, an intentional tort the defendant committed after filing.)* A) business-tort SOL expired; B) the tort occurred after filing; C) relates back to the business tort; D) timely supplemental pleading."
          ],
          "item_count": 10,
          "key_md": "1. **B** — confirm the question is *jury scope* (motion to strike a jury demand), not appealability; damages merits are legal (jury), certification is equitable (no jury).\n2. **D** — source of the right: state law grants it (Sixth-Amendment pair cut).\n3. **A** — framing: state court + Seventh-Amendment demand → non-incorporation is the responsive ground (B answers the federal-court version).\n4. **D** — entrant status: trespasser/licensee → the clerk's knowledge of a non-obvious danger triggers the licensee warn-duty.\n5. **D** — reliance preceded the retraction.\n6. **B** — different occurrence (C is the change-of-party bait).\n7. **A** — adequate and independent state ground.\n8. **D** — acceptance effective on dispatch, before the revocation.\n9. **B** — within the three-month cap.\n10. **D** — post-filing event → Rule 15(d) supplemental pleading; \"occurred after filing\" (B) is the trigger, not a bar."
        }
      ],
      "how_to_use_md": "Drill 10.1 trains the recognition that two answers are a matched pair, and Drill 10.3 enforces the one rule that follows: stop working the choices, go to the stem for the deciding fact. Drill 10.4 is the question-ambiguity guard — the \"only-X / only-Y / both / neither\" pattern should trigger an automatic \"confirm the question first,\" because that pattern is where flawless reasoning toward the *wrong* question happens. Together with Lesson 9, you now have the complete Clash toolkit: name the axis, find the fact, recognize the matched pair, flag the forks, confirm the question. That closes Part III. Part IV pulls back to the corpus level — Lesson 11 shows the recurring *architectures* the exam builds traps around, patterns that cut across subjects and molds.",
      "drill_item_count": 50
    },
    {
      "slug": "lesson-11",
      "number": 11,
      "part": "IV",
      "part_title": "Architecture — the meta-skill",
      "title": "Bait Architecture",
      "objective": "Recognize the four bait architectures and eliminate by construction, not just content.",
      "est_minutes": 31,
      "body_md": "### Where this sits\n\nParts II and III worked at the *mold* level — the shape of an individual wrong answer. Lesson 11 pulls back to the *architecture* level: the recurring structural setups the exam builds traps around, which cut across subjects and across molds. A mold tells you why one answer is wrong. An architecture tells you *where the trap will be before you read the choices*, because it's a property of how the question is built. Four architectures carry most of the corpus: **BA-1 wrong-frame**, **BA-2 violation-vs-remedy**, **BA-3 procedural-frame**, and **BA-4 offered-for-what-purpose.** Learn to recognize the architecture from the stem, and you walk into the choices already knowing which one is the bait.\n\n### BA-1 — Wrong frame\n\nThe architecture: the question sits on the boundary between two contexts that share an area of law, and the trap dangles the rule for the *other* context. This is bait-doctrine (Lesson 8) generalized to the corpus level — testifying vs consulting expert, IIED vs NIED, the relation-back prongs, search-incident vs inventory, larceny vs embezzlement, the prongs of any multi-context doctrine. The setup is a fact pattern poised right at the line. The bait is the neighbor's rule, which is true and from the right area.\n\nThe defense is a single question asked of the *facts*, not the choices: **which side of the boundary do these facts put me on?** Once you've located the side, the neighbor's rule is visibly off, however true it is. The architecture is your warning: when a stem feels like it's hovering at a doctrinal seam, expect the seam's other side in the answers.\n\n### BA-2 — Violation vs remedy\n\nThe architecture: whether a wrong *exists* and what *follows from it* are two separate questions, and the trap answers the one you weren't asked. Is the search unconstitutional — versus — is the evidence suppressed? (Standing, good faith, attenuation, inevitable discovery all break the link, so a search can be bad and the evidence still come in.) Is there a breach — versus — what are the damages? Is the contract within the Statute of Frauds — versus — is it enforceable anyway (part performance, estoppel)? Is the conduct tortious — versus — is this plaintiff entitled to recover?\n\nThe bait answers the existence question when the call is about the consequence, or vice versa. The defense: **confirm whether the call asks whether something *is* (a violation, a breach, a defect) or what *follows* (suppression, damages, enforceability).** The two live at different links in the same chain, and the trap is built at the link you weren't asked about.\n\n### BA-3 — Procedural frame\n\nThe architecture: the question is framed by a procedural posture — a motion to dismiss, JMOL, summary judgment, a standard of review, a burden of proof — and the trap answers the *merits* as if the posture weren't there (or, less often, answers a procedural point when the call is on the merits). On a 12(b)(6), the question is whether the complaint is *sufficient* — not whether the plaintiff will *win*. On JMOL, the question is whether a *reasonable jury could* find for the non-movant — not whether the movant is *right*. On abuse-of-review, the question is whether the lower court was *within its discretion* — not whether you'd have ruled the same way.\n\nThe bait is the merits answer: confident, substantive, and beside the point, because the posture changes the question. The defense: **answer through the procedural lens the stem sets.** Name the posture, name the question that posture actually asks, and reject the answer that resolves the underlying merits instead of the procedural question in front of you.\n\n### BA-4 — Offered for what purpose\n\nThe architecture, most common in Evidence: the *same* evidence is admissible for one purpose and inadmissible for another, and the trap analyzes the *wrong* purpose. A prior inconsistent statement — substantive truth vs impeachment. A subsequent remedial measure — barred to prove negligence, allowed to prove ownership, control, or feasibility. Character evidence — barred for propensity, allowed for motive, identity, or the MIMIC purposes. Liability insurance — barred to prove fault, allowed to prove agency or bias. A guilty plea, an offer to pay medical expenses, a settlement negotiation — each barred for one use and open for another.\n\nThe bait analyzes admissibility for a purpose the proponent isn't offering it for, and reaches the wrong result. The defense: **pin the purpose it's offered for, then judge admissibility for that purpose only.** The exam loves this architecture because the rule and the result both flip on the purpose, and a test-taker who assumes the obvious purpose walks straight into the wrong analysis.\n\n### Why architecture beats mold-spotting alone\n\nMold-spotting is reactive — you see an answer and diagnose it. Architecture is predictive — you see the *question* and know what to brace for. A stem that ends \"the court should *grant the motion*\" tells you BA-3 may be live before you've read a single choice. A stem offering a settlement letter \"to prove the defendant's liability\" tells you BA-4 is the whole game. Recognizing the architecture front-loads your defense, which is exactly what you need when you have thirty seconds and the choices are built to pull you off the call.\n\n### Worked example (BA-4)\n\nAfter a customer slips on a freshly waxed floor and sues, the store changes its wax and posts new warning signs. At trial the plaintiff offers evidence of the change. The store objects. Over the objection, for what purpose, if any, is the evidence admissible?\n\nThe architecture flag fires the instant you see a *subsequent remedial measure* offered against the party who made it: this is BA-4. Pin the purposes. Offered **to prove the store was negligent** (that the old wax was unsafe), the measure is **barred** — Rule 407. Offered **to prove ownership/control of the floor, or the feasibility of a safer wax** if those are disputed, it's **admissible**. The bait choice analyzes it as proof of negligence and admits or excludes on *that* footing; the responsive answer turns on what it's *offered for*. Whatever the choices say, you resolve it by fixing the purpose first — negligence (out) versus control/feasibility (in) — not by asking the abstract question \"is a remedial measure admissible,\" which has no single answer.\n\n---",
      "drills": [
        {
          "id": "11.1",
          "title": "Name the architecture.",
          "instructions_md": "Classify each setup: **[BA-1 WRONG-FRAME]**, **[BA-2 VIOLATION-VS-REMEDY]**, **[BA-3 PROCEDURAL-FRAME]**, or **[BA-4 OFFERED-FOR-WHAT-PURPOSE]**.",
          "items": [
            "1. A subsequent repair is offered \"to prove the defendant's negligence.\"",
            "2. On a 12(b)(6), the question is whether the plagiarism complaint may proceed.",
            "3. An expert was retained for the defense and won't be called; the issue is the discovery standard.",
            "4. A search violated the Fourth Amendment; the question is whether the gun is suppressed.",
            "5. A prior inconsistent statement is offered \"as substantive proof of the fact asserted.\"",
            "6. A taking that was a larceny vs an embezzlement, depending on how possession passed.",
            "7. The contract is within the Statute of Frauds; the question is whether it's nonetheless enforceable.",
            "8. On JMOL after the plaintiff's case, the question is whether the motion should be granted.",
            "9. Liability insurance is offered \"to show the witness is biased.\"",
            "10. An attempt that's factually impossible vs legally impossible."
          ],
          "item_count": 10,
          "key_md": "1. **BA-4** — purpose (negligence vs control/feasibility).\n2. **BA-3** — procedural (sufficiency vs winning).\n3. **BA-1** — wrong-frame (testifying vs consulting).\n4. **BA-2** — violation vs remedy (suppression may not follow).\n5. **BA-4** — purpose (substantive vs impeachment).\n6. **BA-1** — wrong-frame (which property crime).\n7. **BA-2** — existence (within SOF) vs consequence (enforceability).\n8. **BA-3** — procedural (reasonable-jury standard).\n9. **BA-4** — purpose (bias, not fault).\n10. **BA-1** — wrong-frame (which impossibility)."
        },
        {
          "id": "11.2",
          "title": "Violation vs remedy: which is the call?",
          "instructions_md": "For each, state whether the call asks **[EXISTENCE]** (is there a wrong/defect/breach?) or **[CONSEQUENCE]** (what follows — suppression, damages, enforceability, recovery?).",
          "items": [
            "1. \"Is the warrantless search constitutional?\"",
            "2. \"Should the seized evidence be suppressed?\"",
            "3. \"Did the seller breach the contract?\"",
            "4. \"What damages may the buyer recover?\"",
            "5. \"Is the oral land-sale contract within the Statute of Frauds?\"",
            "6. \"Is the oral land-sale contract enforceable despite the lack of a writing?\"",
            "7. \"Was the defendant negligent?\"",
            "8. \"May this particular plaintiff recover for her emotional distress?\"",
            "9. \"Was the confession obtained in violation of Miranda?\"",
            "10. \"May the confession be used to impeach the defendant if he testifies?\""
          ],
          "item_count": 10,
          "key_md": "1. **EXISTENCE.** 2. **CONSEQUENCE.** 3. **EXISTENCE.** 4. **CONSEQUENCE.** 5. **EXISTENCE.** 6. **CONSEQUENCE.** 7. **EXISTENCE.** 8. **CONSEQUENCE.** 9. **EXISTENCE.** 10. **CONSEQUENCE** (and the answer flips: a Miranda-defective statement is generally still usable to impeach)."
        },
        {
          "id": "11.3",
          "title": "Procedural frame: answer through the lens.",
          "instructions_md": "Each question is procedurally framed. Pick the answer that respects the posture (and reject the merits-answer bait).",
          "items": [
            "1. *(12(b)(6); plagiarism; defendant says no facts show he received the manuscript.)* A) dismiss — no proof of access; B) deny — the complaint's allegations, taken as true, state a claim and access is a matter for discovery; C) dismiss — the plaintiff hasn't proven copying; D) deny — the plaintiff will probably win.",
            "2. *(JMOL after the plaintiff's evidence in a negligence case.)* A) grant — the defendant's account is more believable; B) deny — a reasonable jury could find for the plaintiff on this evidence; C) grant — the plaintiff didn't prove the case beyond doubt; D) deny — negligence is always a jury question.",
            "3. *(Summary judgment; a genuine dispute over a material fact exists.)* A) grant for the movant — the movant's facts are stronger; B) deny — a genuine dispute of material fact precludes judgment; C) grant — the non-movant is unlikely to prevail; D) deny — summary judgment is disfavored.",
            "4. *(Abuse-of-discretion review of an evidentiary ruling.)* A) reverse — the appellate court would have ruled otherwise; B) affirm — the ruling was within the trial court's discretion; C) reverse — the ruling was not perfectly correct; D) affirm — evidentiary rulings are never reviewable.",
            "5. *(Motion to dismiss for lack of personal jurisdiction; minimum-contacts facts present.)* A) grant — the claim is weak; B) deny — the defendant has sufficient minimum contacts with the forum; C) grant — venue is improper; D) deny — the plaintiff chose this court.",
            "6. *(Renewed JMOL after a defense verdict; movant preserved it.)* A) deny — only a new trial is available; B) grant or deny on whether a reasonable jury could find as it did; C) deny — the verdict is final; D) grant — the judge disagrees with the jury.",
            "7. *(Demurrer-style sufficiency; complaint pleads all elements with plausible facts.)* A) dismiss — proof is thin; B) deny — the elements are pleaded plausibly; C) dismiss — \"facts constituting a cause of action\" not met; D) deny — the defendant can answer.",
            "8. *(Directed verdict standard at the close of all evidence.)* A) grant for whoever has the better case; B) grant only if no reasonable jury could find for the non-movant; C) grant — the evidence is conflicting; D) deny — juries decide everything.",
            "9. *(De novo review of a pure question of law.)* A) affirm unless clearly erroneous; B) decide the legal question independently; C) affirm — defer to the trial judge; D) reverse — the trial judge is usually wrong.",
            "10. *(Class-certification appeal under Rule 23(f).)* A) review certification and the merits; B) review the certification decision only; C) review the merits only; D) review neither."
          ],
          "item_count": 10,
          "key_md": "1. **B.** 2. **B.** 3. **B.** 4. **B.** 5. **B.** 6. **B.** 7. **B.** 8. **B.** 9. **B.** 10. **B.**"
        },
        {
          "id": "11.4",
          "title": "Offered for what purpose: pin it.",
          "instructions_md": "Each item gives evidence and the purpose it's **offered for**. Mark **[ADMISSIBLE — for that purpose]** or **[INADMISSIBLE — for that purpose]**.",
          "items": [
            "1. Subsequent repair, offered to prove the defendant was negligent.",
            "2. Subsequent repair, offered to prove the defendant controlled the premises (disputed).",
            "3. Prior inconsistent statement (not under oath), offered as substantive proof.",
            "4. Prior inconsistent statement (not under oath), offered to impeach.",
            "5. Defendant's liability insurance, offered to prove he was negligent.",
            "6. Defendant's liability insurance, offered to prove he owned the vehicle (agency disputed).",
            "7. Offer to pay the plaintiff's medical bills, offered to prove liability.",
            "8. A settlement offer, offered to prove the validity of the disputed claim.",
            "9. A prior crime (forgery), offered to prove the defendant has a dishonest character and so committed this fraud.",
            "10. A prior crime (a distinctive method), offered to prove identity in a later crime with the same signature."
          ],
          "item_count": 10,
          "key_md": "1. **INADMISSIBLE** — Rule 407.\n2. **ADMISSIBLE** — control, when disputed.\n3. **INADMISSIBLE** — not 801(d)(1)(A) (no oath), so impeachment only.\n4. **ADMISSIBLE** — for impeachment.\n5. **INADMISSIBLE** — Rule 411.\n6. **ADMISSIBLE** — agency/ownership, when disputed.\n7. **INADMISSIBLE** — Rule 409.\n8. **INADMISSIBLE** — Rule 408.\n9. **INADMISSIBLE** — propensity (Rule 404(b)).\n10. **ADMISSIBLE** — identity (MIMIC, Rule 404(b)(2))."
        },
        {
          "id": "11.5",
          "title": "Mixed architecture in context.",
          "instructions_md": "Full questions. Name the architecture, then pick the survivor.",
          "items": [
            "1. *(Plagiarism 12(b)(6); defendant says no facts show access.)* A) dismiss — no proof of access; B) deny — discovery will reveal what the director received; C) dismiss — elements/facts not pleaded; D) deny — plaintiff will likely win.",
            "2. *(Slip-and-fall; subsequent wax change offered against the store.)* A) admissible to prove negligence; B) inadmissible for any purpose; C) admissible only to prove control or feasibility if disputed; D) admissible as a party admission.",
            "3. *(Warrantless search later found unlawful; suppression motion; the officer relied in good faith on a facially valid warrant.)* A) suppress — the search was unconstitutional; B) admit — the good-faith exception applies; C) suppress — all evidence from a bad search is excluded; D) admit — the defendant lacks any rights.",
            "4. *(Retained-but-uncalled expert subpoenaed.)* A) full disclosure; B) relevant; C) substantial need + undue hardship; D) exceptional circumstances, impracticable otherwise.",
            "5. *(Oral one-year-plus service contract; part performance and reliance; is it enforceable?)* A) within the Statute of Frauds, so void; B) within the Statute, but enforceable on these facts; C) outside the Statute entirely; D) unenforceable regardless.",
            "6. *(JMOL after the plaintiff's case in a products suit; some evidence of defect.)* A) grant — the defense witnesses are more credible; B) deny — a reasonable jury could find a defect on this evidence; C) grant — the plaintiff didn't prove it conclusively; D) deny — products cases always go to the jury.",
            "7. *(Prior inconsistent statement, not under oath, offered \"for its truth.\")* A) admissible substantively; B) inadmissible for any use; C) admissible to impeach but not substantively; D) admissible as a present sense impression.",
            "8. *(Defendant's apology and offer to \"make it right,\" offered to prove fault.)* A) admissible as an admission; B) inadmissible if part of settlement/compromise; C) admissible to show state of mind; D) admissible for any purpose.",
            "9. *(Confession taken in violation of Miranda; defendant testifies and contradicts it; offered to impeach.)* A) inadmissible for all purposes; B) admissible to impeach the defendant's testimony; C) admissible substantively; D) inadmissible as fruit of the poisonous tree.",
            "10. *(Embezzlement vs larceny: a teller lawfully takes possession of bank funds, then converts them.)* A) larceny — trespassory taking; B) embezzlement — conversion of property lawfully possessed; C) false pretenses; D) no crime."
          ],
          "item_count": 10,
          "key_md": "1. **BA-3** → **B.** 2. **BA-4** → **C.** 3. **BA-2** → **B.** 4. **BA-1** → **D.** 5. **BA-2** → **B.** 6. **BA-3** → **B.** 7. **BA-4** → **C.** 8. **BA-4/BA-2** → **B.** 9. **BA-2** → **B.** 10. **BA-1** → **B.**"
        }
      ],
      "how_to_use_md": "Drill 11.1 trains the front-loaded recognition — seeing the architecture in the *stem* so your defense is ready before the choices. Drills 11.3 and 11.4 isolate the two architectures that produce the most confident wrong answers: the procedural-frame, where a substantively-correct merits answer is exactly the bait, and offered-for-what-purpose, where the rule and the result both flip on the purpose. Drill 11.5 puts all four in live questions. When the shape of the question tells you where the trap is before you read a single choice, you're operating at the corpus level. Lesson 12 builds the other half of the floor — the anchor rules and the full Call deck for the questions that knowledge and structural tiebreakers, not technique, decide.",
      "drill_item_count": 50
    },
    {
      "slug": "lesson-12",
      "number": 12,
      "part": "IV",
      "part_title": "Architecture — the meta-skill",
      "title": "The Anchor Deck",
      "objective": "Deploy the full Call deck and the anchor rules you must know cold.",
      "est_minutes": 31,
      "body_md": "### Where this sits\n\nLesson 3 split the exam into standards (Ear-dominant, the larger share) and rules (anchor-dominant, a floor of roughly a fifth). Parts II and III maximized the Ear and Issue-Sense, which handle the standards. Lesson 12 builds the rest of the floor: the **full Call deck** — the ordered tiebreakers you reach for when Cut and Clash leave you stuck — and the **anchor rules** you must know cold, because on a bright-line question no technique substitutes for knowing the line. Lesson 2 gave you four Call heuristics as a preview; here is the complete set, plus the highest-yield rules to have memorized.\n\n### The full Call deck\n\nCall is a last resort (Lesson 2), but when you need it, these eight heuristics resolve most ties. Apply them roughly in this order — the earlier ones are more reliable.\n\n1. **Threshold > merits.** An answer disposing of the case on a threshold ground — jurisdiction, standing, timeliness, waiver, immunity — beats one reaching the merits. You never reach the merits if the threshold ends it. *(Standing dismissal over a merits dismissal.)*\n\n2. **Layer-fundamentalness.** The more fundamental layer controls the less fundamental. Subject-matter jurisdiction before the merits; the validity of a contract before its breach; capacity before terms; whether a duty exists before whether it was breached. When two answers sit at different layers, the deeper one governs. *(No-contract-formed beats material-breach.)*\n\n3. **Positive > negative.** An answer that affirmatively supplies the operative ground beats one that merely negates an alternative. \"Liable because she failed to supervise\" beats \"not liable because the child wasn't at fault\" when both survive — the affirmative ground does the work. *(The answer that states *why* over the answer that states *why not*.)*\n\n4. **Default-tier > heightened.** When the question turns on a standard of review or a burden, and no trigger is shown, the default governs: rational basis over strict scrutiny; preponderance over clear-and-convincing; Pike balancing over strict scrutiny for a non-discriminatory commerce burden; negligence over recklessness. *(Rational basis unless a suspect class or fundamental right appears.)*\n\n5. **Standard > uncommon.** The ordinary rule beats the exotic exception unless the facts trigger the exception. Exam answers that reach for a rare doctrine (a seldom-tested exception, an unusual privilege) are usually wrong against the common rule, absent a fact that calls the exception into play. *(The mainstream hearsay exception over the obscure one.)*\n\n6. **Broad-fit > narrow-fit.** Between two responsive answers, the one that accounts for *more* of the facts beats the one that fits only a sliver. An answer that explains the whole pattern is preferred over one that's true of only a corner of it. *(The rationale that covers the case over the one that covers a detail.)*\n\n7. **Hedged > absolute.** Between two responsive answers, the qualified one — *unless, generally, provided that* — usually beats the unqualified absolute, because legal rules carry exceptions and the absolute overstates. *(From Lesson 4: absolutes are built to fail.)*\n\n8. **Fact-engaged > abstract.** An answer that ties the rule to *these* facts beats one that recites the rule in the abstract. The exam rewards application. *(The answer that uses the stem's facts over the answer that could appear on any question.)*\n\nWhen two heuristics point the same way, your confidence rises; when they conflict, trust the earlier (more fundamental) one. And remember the meta-rule: if you're reaching for the Call deck often, you're probably under-cutting or under-clashing — Call is the exception.\n\n### The anchor rules\n\nThese are the bright lines that no technique recovers — you either know them or you flag (Lesson 3). This is a high-yield core, not a complete outline; the point is to have *these* automatic, because they recur and they're silently misstated in distractors.\n\n**Civil Procedure.** Complete diversity (all plaintiffs diverse from all defendants) + amount > $75,000. §1367(b) bars supplemental jurisdiction over a *plaintiff's* claims against non-diverse parties in diversity cases. Service window: 90 days (Rule 4(m)); dismissal absent good cause. Rule 50(b) renewed JMOL may join a Rule 59 new-trial motion. Rule 23(f): interlocutory appeal of *certification only*. Rule 11 excludes discovery (Rule 37 governs). Relation back: same conduct/transaction/occurrence (claims); the knew-or-should-have-known-but-for-a-mistake prong is for *parties*. Erie: federal court sitting in diversity applies state substantive law, federal procedure.\n\n**Contracts/UCC.** Firm offer (2-205): no consideration, capped at 3 months. Acceptance effective on dispatch (mailbox rule); revocation on receipt. UCC modifications need no consideration (good faith). Statute of Frauds categories: marriage, year-plus, land, executor, goods ≥ $500, suretyship (MY-LEGS). Perfect tender (sale of goods). Parol evidence bars prior/contemporaneous, not subsequent.\n\n**Torts.** Trespasser/licensee/invitee duties (no duty but to refrain from willful/wanton; warn of known non-obvious dangers; reasonable care including inspection). Strict liability for abnormally dangerous activities and wild animals (harm from the dangerous propensity). Products: defective when it left the defendant + causation; unforeseeable misuse is a defense. NIED for negligent mishandling of a corpse (no physical-harm requirement). Defamation: public figure → actual malice.\n\n**Con Law.** Tiers: strict (suspect class/fundamental right), intermediate (gender, legitimacy), rational basis (default). Dormant commerce: market-participant exception; Pike balancing for non-discriminatory burdens. Content-based speech → strict scrutiny. Adequate-and-independent-state-ground bars SCOTUS review. No incorporation of the Seventh (civil jury) or the Grand Jury clause. Anti-commandeering; Garcia (generally-applicable federal regulation valid as to states).\n\n**Evidence.** Hearsay exceptions (present sense impression, excited utterance, then-existing state of mind, medical diagnosis, recorded recollection, business/public records, 803(18) treatises). 801(d) exclusions (prior inconsistent under oath = substantive; prior consistent; prior ID; opposing-party statements). 404(b) MIMIC. 407/408/409/411 (remedial measures, compromise, medical payments, insurance — each barred for one purpose, open for others). 608(b): no extrinsic evidence of specific acts for character; bias may be shown extrinsically.\n\n**Criminal.** First-degree murder predicates (premeditation, poison, lying in wait, enumerated felonies). Larceny (trespassory taking) vs embezzlement (conversion of lawful possession) vs false pretenses (title by deceit). Conspiracy: common law bilateral; MPC unilateral. Attempt: legal impossibility a defense, factual impossibility not. Miranda (custodial interrogation); a Miranda-defective statement is still usable to impeach.\n\n### Worked example (Call deck — layer-fundamentalness + threshold)\n\nTwo answers survive a question: **A — for the defendant, because the parties never formed a contract** (no meeting of the minds on an essential term), and **B — for the defendant, because any breach was not material.** The facts are genuinely murky on both. Reach for the deck. **Layer-fundamentalness** decides it: whether a contract *formed* is more fundamental than whether a breach was *material* — you never reach materiality if there was no contract. A is the deeper layer, so A controls. (Threshold > merits points the same way if you frame formation as the gateway question.) Two heuristics agree, so confidence is high. You didn't find a new fact; you ranked the two grounds by depth.\n\n---",
      "drills": [
        {
          "id": "12.1",
          "title": "Name the Call heuristic.",
          "instructions_md": "For each tie, name the heuristic that breaks it.",
          "items": [
            "1. \"Dismissed for lack of standing\" vs \"dismissed on the merits.\"",
            "2. \"No contract formed\" vs \"the breach was immaterial.\"",
            "3. \"Liable because she failed to supervise\" vs \"not liable because the child wasn't negligent.\"",
            "4. \"Rational basis — upheld\" vs \"strict scrutiny — struck,\" no suspect class shown.",
            "5. \"Admissible under the business-records exception\" vs \"admissible under a rarely-used residual exception.\"",
            "6. \"The rationale that explains the entire fact pattern\" vs \"the rationale true of one detail.\"",
            "7. \"Admissible unless unfairly prejudicial\" vs \"always admissible.\"",
            "8. \"No liability — trespassers are owed no duty\" vs \"no liability — the owner had no reason to anticipate this entrant at this spot, and the condition was natural.\"",
            "9. \"Preponderance\" vs \"clear and convincing,\" ordinary civil claim.",
            "10. \"Reversed for want of jurisdiction\" vs \"reversed because the ruling was wrong.\""
          ],
          "item_count": 10,
          "key_md": "1. **Threshold > merits.**\n2. **Layer-fundamentalness.**\n3. **Positive > negative.**\n4. **Default-tier > heightened.**\n5. **Standard > uncommon.**\n6. **Broad-fit > narrow-fit.**\n7. **Hedged > absolute.**\n8. **Fact-engaged > abstract.**\n9. **Default-tier > heightened.**\n10. **Threshold > merits.**"
        },
        {
          "id": "12.2",
          "title": "Apply the Call (full deck).",
          "instructions_md": "Two survivors each; the stem gives nothing further. Pick using the deck.",
          "items": [
            "1. *(No suspect class/fundamental right.)* A) upheld — rational basis; B) struck — strict scrutiny.",
            "2. A) for the defendant — no contract formed; B) for the defendant — performance was excused by a later condition.",
            "3. A) dismissed — the court lacks subject-matter jurisdiction; B) dismissed — the complaint fails to state a claim.",
            "4. A) admissible as an excited utterance; B) admissible under the catch-all residual exception.",
            "5. A) liable — the manufacturer's warning was inadequate; B) not liable — the plaintiff might have been careless.",
            "6. A) valid unless the burden clearly exceeds the local benefits; B) struck unless it survives strict scrutiny. *(non-discriminatory commerce burden)*",
            "7. A) the rule, tied to the stem's timing and parties; B) the rule, stated as a general proposition.",
            "8. A) enforceable; B) enforceable if supported by consideration or made in good faith under the UCC.",
            "9. A) for the plaintiff — the defendant owed and breached a duty here; B) for the plaintiff — defendants generally owe duties of care.",
            "10. A) no jurisdiction — the parties aren't completely diverse; B) judgment for the defendant on the merits."
          ],
          "item_count": 10,
          "key_md": "1. **A** (default tier). 2. **A** (layer-fundamentalness — formation before excuse). 3. **A** (threshold). 4. **A** (standard over uncommon). 5. **A** (positive over negative; also fact-engaged). 6. **A** (default tier — Pike). 7. **A** (fact-engaged). 8. **B** (hedged). 9. **A** (fact-engaged/broad-fit). 10. **A** (threshold)."
        },
        {
          "id": "12.3",
          "title": "Anchor recall (the bright lines).",
          "instructions_md": "Pick the correct statement of the rule.",
          "items": [
            "1. Diversity jurisdiction requires: A) minimal diversity; B) complete diversity + amount > $75,000; C) a federal question; D) consent.",
            "2. A merchant's firm offer is irrevocable for: A) a reasonable time, no cap; B) the time stated, capped at three months, no consideration needed; C) only with consideration; D) indefinitely.",
            "3. Rule 23(f) permits interlocutory appeal of: A) certification only; B) certification and merits; C) the merits only; D) nothing.",
            "4. Acceptance by mail is effective: A) on receipt; B) on dispatch; C) when the offeror reads it; D) never.",
            "5. The dormant-commerce market-participant exception means: A) the state may favor locals when buying or selling; B) the state may discriminate whenever it regulates; C) Congress must consent; D) no exception exists.",
            "6. NIED for negligent mishandling of a corpse requires: A) physical impact; B) no physical-harm showing; C) intent; D) a contemporaneous bystander.",
            "7. First-degree murder predicates include: A) any killing; B) premeditation, poison, lying in wait, enumerated felonies; C) recklessness; D) negligence.",
            "8. A prior inconsistent statement is substantive evidence: A) always; B) only if made under oath at a prior proceeding; C) never; D) only if written.",
            "9. Common-law conspiracy requires: A) one guilty mind; B) two genuinely agreeing minds; C) an overt act only; D) no agreement.",
            "10. The Seventh Amendment (civil jury) is: A) incorporated against the states; B) not incorporated; C) incorporated only for contracts; D) applicable in criminal cases."
          ],
          "item_count": 10,
          "key_md": "1. **B.** 2. **B.** 3. **A.** 4. **B.** 5. **A.** 6. **B.** 7. **B.** 8. **B.** 9. **B.** 10. **B.**"
        },
        {
          "id": "12.4",
          "title": "Layer-fundamentalness / ordering.",
          "instructions_md": "Given two competing grounds, pick the **more fundamental** (the one a court reaches first).",
          "items": [
            "1. A) subject-matter jurisdiction; B) the merits of the claim.",
            "2. A) whether a contract formed; B) whether a term was breached.",
            "3. A) the defendant's capacity to contract; B) whether the price term was met.",
            "4. A) standing to sue; B) the strength of the plaintiff's evidence.",
            "5. A) whether a duty existed; B) whether the duty was breached.",
            "6. A) whether the search was lawful (existence); B) whether the evidence is suppressed (consequence) — which does the court decide first?",
            "7. A) personal jurisdiction; B) whether the plaintiff will win.",
            "8. A) whether the statute applies at all; B) how to apply it.",
            "9. A) ripeness/mootness; B) the constitutional merits.",
            "10. A) whether the writing satisfies the Statute of Frauds; B) what the contract's damages are."
          ],
          "item_count": 10,
          "key_md": "1. **A.** 2. **A.** 3. **A.** 4. **A.** 5. **A.** 6. **A** (lawfulness precedes the suppression question). 7. **A.** 8. **A.** 9. **A.** 10. **A.**"
        },
        {
          "id": "12.5",
          "title": "Mixed Call + anchor in context.",
          "instructions_md": "Full questions. Use anchor knowledge to cut, the Call deck to break any tie, and pick the survivor.",
          "items": [
            "1. *(Patient State A sues a State-B dentist and a State-A nurse, diversity.)* A) supplemental jurisdiction; B) judicial economy; C) no complete diversity, dismiss; D) not the same case/controversy.",
            "2. *(Firm-offer assurance for the year; orders a month later.)* A) PE; B) firm for that month; C) no consideration; D) longer than three months.",
            "3. *(Two survivors: no contract formed vs immaterial breach; facts murky.)* A) no contract formed; B) the breach wasn't material.",
            "4. *(Renewed JMOL after a defense verdict, preserved; plus a new-trial motion.)* A) new-trial only; B) only one; C) both; D) combine with relief from judgment.",
            "5. *(Non-discriminatory state law incidentally burdens commerce.)* A) upheld unless the burden clearly exceeds the benefits; B) struck under strict scrutiny; C) per se invalid; D) valid only with congressional consent.",
            "6. *(Negligently mishandled corpse; mother's distress, no physical harm.)* A) no recovery without physical harm; B) recovery — the corpse-mishandling NIED rule needs no physical harm; C) recovery only if she witnessed it; D) recovery only on intent.",
            "7. *(Acceptance mailed; revocation phoned the next day.)* A) revoked first; B) no agreement on price; C) irrevocable offer; D) acceptance effective on dispatch, before the revocation.",
            "8. *(Prior inconsistent statement, not under oath, offered for its truth.)* A) substantive; B) inadmissible entirely; C) impeachment only; D) present sense impression.",
            "9. *(Standing-vs-merits dismissal both available.)* A) dismiss for lack of standing; B) dismiss on the merits; C) proceed to trial; D) certify the question.",
            "10. *(Teller lawfully holds bank funds, then converts them.)* A) larceny; B) embezzlement; C) false pretenses; D) no crime."
          ],
          "item_count": 10,
          "key_md": "1. **C** (anchor: §1367(b)). 2. **B** (anchor: 3-month cap). 3. **A** (Call: layer-fundamentalness). 4. **C** (anchor: Rule 50(b)). 5. **A** (anchor: Pike / Call: default tier). 6. **B** (anchor: corpse NIED). 7. **D** (anchor: mailbox rule). 8. **C** (anchor: 801(d)(1)(A) needs an oath). 9. **A** (Call: threshold). 10. **B** (anchor: embezzlement)."
        }
      ],
      "how_to_use_md": "Drill 12.3 is rote and unglamorous and the highest-leverage thing in Part IV: the anchor rules are silently misstated in distractors across every subject, and you cannot reason your way to a bright line you never learned. Drill these to automaticity and a fifth of the exam stops being a guess. Drills 12.1, 12.2, and 12.4 build the Call deck as ordered tiebreakers — note that the early heuristics (threshold, layer-fundamentalness) are the reliable ones, and that needing the deck often is a symptom, not a strategy. With the Ear, Issue-Sense, the architectures, and now the anchors and the deck, you have the whole method. Lesson 13 makes it honest: how to read your own confidence off the mechanism that produced each answer, when a question is a true coin, and when to flag rather than force.",
      "drill_item_count": 50
    },
    {
      "slug": "lesson-13",
      "number": 13,
      "part": "V",
      "part_title": "Calibration & integration",
      "title": "Calibration",
      "objective": "Read confidence off the mechanism that produced the answer; never coin-flip.",
      "est_minutes": 31,
      "body_md": "### Where this sits\n\nYou now have the machinery to get answers. Lesson 13 makes the machinery honest: it teaches you to read your *confidence* off the mechanism that produced each answer, to recognize a genuine coin, and to decide when to flag rather than force. This matters for two practical reasons. First, scored time is finite — knowing which questions deserve thirty more seconds and which deserve a flag-and-move is most of time management. Second, the blind-testing behind this course revealed a specific, correctable error: **underconfidence.** On questions resolved by a clean Cut, the hit rate was effectively perfect while the *stated* confidence hovered around seventy percent. That gap is points left on the table — second-guessing answers that were already locked. Calibration closes it.\n\n### Confidence tracks mechanism, not feeling\n\nYour confidence in an answer should be a reading of *how you got it*, not a vibe. The mechanism that produced the answer tells you, with surprising precision, how likely it is to be right. The map:\n\n- **Clean Cut, all three breaks named** — you cut three answers on identified grounds (Ear molds are fact-independent; the not-responsive cuts you can articulate), and one survived both filters. This is your **highest band: ~92–97%.** If you can *name why each of the other three dies*, you are not at seventy percent. Trust it and move on.\n- **Clash resolved by an unambiguous fact** — two survived, you named the axis, and a clear fact in the stem decided it. **High: ~82–90%.**\n- **Clash on a fork, fact supplied by the stem** — a fork-type question (relation back, sufficiency, status, degree) where the stem *did* give you the deciding fact. **Moderate-high: ~75–85%** — slightly lower because fork questions punish a missed wrinkle.\n- **Single Call heuristic** — no deciding fact; you broke the tie with one structural tiebreaker. **Moderate: ~62–72%.**\n- **Two Call heuristics agreeing** — **~70–78%.**\n- **Anchor rule, known cold** — a bright-line question and you know the line. **Very high: ~95%+.**\n- **Anchor rule you don't know** — a bright-line question and the line isn't in your memory. This is not a 50/50; it's a **flag with a low-confidence lean, ~25–40%**, because you can't reason to an edge you never learned.\n- **Matched pair, deciding fact withheld** — a genuine coin. **~50%. Flag, lean, move.**\n\nCalibration is matching your stated confidence to the band the mechanism puts you in — no higher (overconfidence loses you the chance to revisit a real weak spot) and, the more common error, *no lower* (underconfidence wastes time re-litigating locked answers and tempts you to talk yourself out of a clean cut).\n\n### The underconfidence correction\n\nThe specific fix the data demands: **when you have cut three answers on grounds you can articulate, and the fourth survives both filters, that is a high-confidence answer — treat it as ~95%, not ~70%.** The feeling of \"but what if I'm missing something\" is, on a clean cut, usually noise. The check is mechanical, not emotional: *can I name why each of the other three is wrong?* If yes — overclaim here, backwards there, not-responsive on the third — then there is nothing to second-guess, and the residual unease is the very thing that leads good test-takers to switch a right answer to a wrong one. Lock it. Reserve your doubt for the questions that earned it.\n\n### Recognizing a coin\n\nA coin is not \"a hard question.\" A coin is a question where, *after correct technique*, the deciding information isn't available — a matched pair (Lesson 10) whose splitting fact the stem withholds, or a question-ambiguous set the stem never disambiguates, or a bright-line rule you simply don't know. The signature is that you've done everything right and the symmetry won't break. When you recognize a coin, the correct move is fast: pick the slightly-favored side (a weak prior is still better than random), flag it for review if time permits, and move on. The error is spending ninety seconds manufacturing a distinction that the question was built not to give you.\n\n### Flag or commit\n\n**Commit** when the mechanism is clean — a Cut to one with named breaks, a Clash resolved by a clear fact, an anchor you know. There is nothing review will improve. **Flag** when (a) a fork-type question withholds the deciding fact, (b) the call is ambiguous and the stem doesn't settle it, or (c) the governing rule is a bright line you don't know. A flag is not a failure; it's an accurate label that routes your limited review time to the questions where review can actually change the answer. The worst outcome isn't a flagged coin — it's a *confidently wrong* answer on a question you should have flagged, because you'll never revisit it.\n\n### Worked example (calibration in action)\n\nTwo questions, same surface difficulty, opposite calibration.\n\n**Question one:** the negligent-child case. You cut \"liable for any harm the child causes\" (overclaim — named), \"the child was negligent\" (wrong-element — named), \"assumed the risk\" (misfit — named). \"Failed to adequately supervise\" survives. Three breaks, all articulable. **Confidence: ~95%.** Commit; do not re-read; do not let \"but what about vicarious liability\" pull you back — you already cut that, and you can say why. This is the underconfidence trap in miniature: the answer is locked, and the only risk is talking yourself out of it.\n\n**Question two:** a relation-back question where the stem describes the new claim but is genuinely silent on whether it shares the original's occurrence. You name the axis (same vs different occurrence), reach for the deciding fact — and it isn't there. This is a fork with the fact withheld: a coin. **Confidence: ~50%.** Lean toward the side the surrounding facts faintly favor, flag it, move on. Spending ninety seconds here is how you run out of time for the clean cuts later.\n\nThe skill is telling these two apart *in the moment* — committing hard on the first, flagging fast on the second — and never confusing the unease of the second for a reason to re-open the first.\n\n---",
      "drills": [
        {
          "id": "13.1",
          "title": "Assign the confidence band.",
          "instructions_md": "For each described mechanism, give the band: **[~95%]**, **[~85%]**, **[~80%]**, **[~67%]**, **[~50%]**, or **[FLAG / low lean]**.",
          "items": [
            "1. Cut three answers on named molds (overclaim, backwards, misfit); the fourth survives both filters.",
            "2. Down to a matched pair on reliance timing; the stem states the reliance came first.",
            "3. Down to a matched pair on entrant status; the stem never says whether he was permitted on the land.",
            "4. Broke a two-survivor tie with a single Call heuristic (threshold > merits); no deciding fact.",
            "5. A bright-line diversity question; you know the complete-diversity rule cold.",
            "6. A fork-type sufficiency question; the stem gives the facts that show the complaint is adequate.",
            "7. A bright-line firm-offer question; you can't remember whether the cap is three or six months.",
            "8. Two Call heuristics (layer-fundamentalness and threshold) both point to the same answer.",
            "9. A clean Cut, but you can only name *two* of the three breaks and are guessing on the third.",
            "10. A question-ambiguous \"only-X/only-Y/both/neither\" set the stem never disambiguates."
          ],
          "item_count": 10,
          "key_md": "1. **~95%.** 2. **~85%.** 3. **~50% / FLAG.** 4. **~67%.** 5. **~95%.** 6. **~80%.** 7. **FLAG / low lean.** 8. **~75–80%** (call it ~80%). 9. **~67%** — an un-named break means it isn't a clean cut; treat it like a single-heuristic call. 10. **~50% / FLAG.**"
        },
        {
          "id": "13.2",
          "title": "Coin or resolvable?",
          "instructions_md": "Decide: **[RESOLVABLE — commit]** or **[COIN — flag, lean, move]**.",
          "items": [
            "1. A matched pair on reliance timing; the stem gives the dates.",
            "2. A matched pair on reliance timing; the stem omits the dates.",
            "3. A clean Cut to one with all three breaks named.",
            "4. A bright-line rule you don't know.",
            "5. A Clash with the axis named and a clear deciding fact.",
            "6. A question-ambiguous set the stem disambiguates (\"the court granted a motion to strike the jury demand\").",
            "7. A question-ambiguous set the stem leaves ambiguous.",
            "8. A degree-of-crime question where the stem gives the facts negating premeditation.",
            "9. A degree-of-crime question where the stem is silent on the key mental-state facts.",
            "10. An anchor question you know cold."
          ],
          "item_count": 10,
          "key_md": "1. **RESOLVABLE.** 2. **COIN.** 3. **RESOLVABLE.** 4. **COIN.** 5. **RESOLVABLE.** 6. **RESOLVABLE.** 7. **COIN.** 8. **RESOLVABLE.** 9. **COIN.** 10. **RESOLVABLE.**"
        },
        {
          "id": "13.3",
          "title": "Underconfidence correction.",
          "instructions_md": "Each test-taker reached an answer by a clean mechanism but stated low confidence. Mark **[CORRECT — raise to high]** or **[JUSTIFIED — the doubt is real]**.",
          "items": [
            "1. Cut three on named molds, one survives; stated 65%.",
            "2. Couldn't name why the third answer was wrong; stated 65%.",
            "3. Anchor rule known cold; stated 70%.",
            "4. Clash resolved by a clear, unambiguous fact; stated 60%.",
            "5. Single Call heuristic, no deciding fact; stated 65%.",
            "6. Clean Cut with all breaks named, but \"felt unsure\"; stated 70%.",
            "7. Matched pair with the fact withheld; stated 50%.",
            "8. Anchor known cold, but the answer \"seemed too easy\"; stated 60%.",
            "9. Two unrelated guesses averaged; stated 65%.",
            "10. Cut to one with named breaks, then nearly switched to a true-but-off-question distractor; stated 55%."
          ],
          "item_count": 10,
          "key_md": "1. **CORRECT — raise to ~95%.**\n2. **JUSTIFIED** — an un-named break is a real gap; it isn't a clean cut.\n3. **CORRECT — raise to ~95%.**\n4. **CORRECT — raise to ~85%.**\n5. **JUSTIFIED** — ~65% is right for a single heuristic.\n6. **CORRECT — raise; the feeling is noise on a named-break cut.**\n7. **JUSTIFIED** — 50% is the honest band for a coin.\n8. **CORRECT — \"too easy\" is not evidence; raise to ~95%.**\n9. **JUSTIFIED** — averaged guesses deserve low confidence (and a flag).\n10. **CORRECT — the off-question distractor is exactly what a named-break cut already rejected; raise and commit.**"
        },
        {
          "id": "13.4",
          "title": "Flag or commit.",
          "instructions_md": "For each, decide **[COMMIT]** or **[FLAG]**.",
          "items": [
            "1. Clean Cut to one, all breaks named.",
            "2. Fork-type relation-back question; deciding fact withheld.",
            "3. Anchor rule you know cold.",
            "4. Bright-line rule you don't know.",
            "5. Clash resolved by a clear fact.",
            "6. Question-ambiguous set; stem doesn't disambiguate.",
            "7. Two Call heuristics agreeing.",
            "8. Premises-status question; the stem doesn't say whether the entrant was permitted.",
            "9. Single mainstream hearsay exception, clearly satisfied on the facts.",
            "10. Matched pair; the splitting fact is present in the stem."
          ],
          "item_count": 10,
          "key_md": "1. **COMMIT.** 2. **FLAG.** 3. **COMMIT.** 4. **FLAG.** 5. **COMMIT.** 6. **FLAG.** 7. **COMMIT** (moderate confidence, but nothing review would improve). 8. **FLAG.** 9. **COMMIT.** 10. **COMMIT.**"
        },
        {
          "id": "13.5",
          "title": "Mixed calibration in context.",
          "instructions_md": "Full questions. Pick the answer, name the deciding mechanism, and state the confidence band — then decide commit or flag.",
          "items": [
            "1. *(Suit against the mother of a negligent child.)* A) child negligent; B) liable for any harm; C) assumed risk; D) failed to supervise.",
            "2. *(Firm-offer assurance for the year; orders a month later.)* A) PE; B) firm for that month; C) no consideration; D) longer than three months.",
            "3. *(Relation back; stem silent on whether the claims share an occurrence.)* A) different occurrence; B) relates back; C) change-of-party prong; D) SOL expired.",
            "4. *(Two survivors: no contract formed vs immaterial breach; facts murky.)* A) no contract formed; B) breach immaterial.",
            "5. *(Diversity; non-diverse co-defendant added by the plaintiff.)* A) supplemental jurisdiction; B) judicial economy; C) dismiss — no complete diversity; D) not the same case/controversy.",
            "6. *(Premises liability; stem doesn't state whether the entrant was permitted.)* A) trespasser — no duty; B) licensee — warn of known dangers; C) invitee — reasonable care; D) the duty depends on his status.",
            "7. *(Repudiation; substitute bought before the retraction.)* A) retracted before performance; B) constructive condition; C) not retractable once communicated; D) relied before retraction.",
            "8. *(Negligently mishandled corpse; mother's distress, no physical harm.)* A) no recovery without physical harm; B) recovery — corpse NIED; C) only if she witnessed it; D) only on intent.",
            "9. *(\"Only-X/only-Y/both/neither\" jury set; the stem doesn't say which motion or court.)* A) both; B) only the merits; C) only certification; D) neither.",
            "10. *(Prior inconsistent statement, not under oath, offered for its truth.)* A) substantive; B) inadmissible entirely; C) impeachment only; D) present sense impression."
          ],
          "item_count": 10,
          "key_md": "1. **D** — clean Cut, named breaks — **~95% — commit.**\n2. **B** — anchor (3-month cap) — **~95% — commit.**\n3. **FLAG** — fork with the fact withheld — **~50% — lean and flag.**\n4. **A** — Call (layer-fundamentalness) — **~80% — commit (moderate).**\n5. **C** — anchor (§1367(b)) — **~95% — commit.**\n6. **FLAG** — status withheld; **~50%** unless the stem hides a status fact — flag.\n7. **D** — Clash resolved by a clear fact — **~88% — commit.**\n8. **B** — anchor (corpse NIED) — **~95% — commit.**\n9. **FLAG** — question-ambiguous, unresolved — **~50% — flag.**\n10. **C** — anchor (801(d)(1)(A) needs an oath) — **~95% — commit.**"
        }
      ],
      "how_to_use_md": "The single highest-value habit in this lesson is the underconfidence correction in Drills 13.1 and 13.3: when you can name why each of the other three answers dies, the answer is locked at roughly ninety-five percent, and the unease you feel is the exact signal that gets right answers changed to wrong ones — lock it and move. Drills 13.2 and 13.4 train the opposite discipline, recognizing a true coin fast and flagging it instead of mining it for a distinction the question withheld. Calibrated this way, your time flows to the questions where it changes outcomes, and away from the ones where it doesn't. Lesson 14 puts everything on the clock: the full workflow, sequenced to run in thirty seconds a question.",
      "drill_item_count": 50
    },
    {
      "slug": "lesson-14",
      "number": 14,
      "part": "V",
      "part_title": "Calibration & integration",
      "title": "Integration: The Full Workflow at 30 Seconds",
      "objective": "Run the whole workflow as one motion, on the clock, at the thirty-second target.",
      "est_minutes": 30,
      "body_md": "### Where this sits\n\nThis is the capstone. Lessons 1–13 built the parts; Lesson 14 runs them as one motion, on the clock. The MBE gives you roughly **1.8 minutes per question**, and the C3 target is to *resolve most questions in about thirty seconds* — not because speed is the goal, but because banking time on the questions the method cracks cleanly is what buys you the minutes you need for the genuine forks and the questions you must reason through. A method that works untimed and collapses under the clock isn't a method. This lesson sequences everything so the workflow fits the time you actually have, and then drills it until the sequence runs without your narrating it.\n\n### The thirty-second sequence\n\nEvery question, the same order, with a rough time budget:\n\n**0–5 seconds — Frame.** Read the call and classify the governing law. *What exactly is being asked?* (Lesson 7.) *Rule or standard?* (Lesson 3.) *Any architecture flag* — procedural posture, violation-vs-remedy, offered-for-what-purpose, a doctrinal seam? (Lesson 11.) This is also where you note the dispositive fact if the stem hands it to you early. Five seconds of framing aims your whole read.\n\n**5–15 seconds — Cut.** Run both filters across the choices. The Ear first, because it's fast and fact-independent — kill the overclaims, the backwards rules, the distortions (Lessons 4–6). Then Issue-Sense — cut the misfits, the bait-doctrine, the wrong-element answers (Lesson 8), measured against the call you framed. **Most questions end here:** three break a filter, one survives, and you commit at high confidence (Lesson 13). If you're down to one with all breaks named, you're done — do not keep reading.\n\n**15–25 seconds — Clash (only if two survive).** Name the axis the two disagree on; find the fact in the stem that sits on it; let the fact decide (Lesson 9). Recognize a matched pair and go straight to the splitting fact (Lesson 10). Recognize a fork or a question-ambiguous set and, if the fact is withheld, prepare to flag.\n\n**25–30 seconds — Call, calibrate, commit (only if still stuck).** Break a residual tie with the deck — threshold, layer-fundamentalness, the rest (Lesson 12). Read your confidence off the mechanism (Lesson 13). Commit if clean; flag and lean if it's a coin. Then move — a flagged coin reviewed later is fine; a clean cut re-litigated is wasted time and a switched right answer.\n\n### The decision tree, compressed\n\n- **Torn among 3–4?** → you haven't finished the **Cut**. Re-run the filters; you skipped one.\n- **Down to 1, breaks named?** → **commit, ~95%.** Move.\n- **Down to 2?** → **Clash.** Name the axis, find the fact.\n- **Axis won't resolve on the facts?** → **fork?** If the fact's withheld, **flag.** Otherwise **Call.**\n- **Call is a coin?** → **lean, flag, move.**\n\nInternalized, this tree *is* the thirty seconds. The frame aims you, the Cut ends most questions, the Clash handles the rest, the Call and the calibration close the few that survive.\n\n### What changes under time pressure\n\nThree disciplines matter more on the clock than off it. **First, stop when you're done** — the clean Cut to one is the most common outcome, and the time-killer is continuing to deliberate after the answer is locked. **Second, predict before you peek even when rushed** — it feels like it costs time, but it's what keeps the off-question distractor from pulling you into a re-read, which costs far more. **Third, flag fast** — the instant you recognize a coin, lean and leave; the question is built to consume the time you give it, and review later is cheaper than mining now. Speed on the MBE is not faster reading; it's *not doing unnecessary work* — not re-reading locked answers, not manufacturing distinctions on coins, not reasoning through what a named cut already settled.\n\n### Worked example (the full motion, narrated at speed)\n\n*Stem:* a buyer's lawyer files on time but forgets to serve for four months; the seller moves to dismiss for failure to serve.\n\n**Frame (0–5s):** Call — should the *service* motion be granted? (Not \"was filing timely.\") Rule-driven (Rule 4(m), 90-day window, good-cause standard). No architecture trap beyond the violation-vs-remedy flavor. Dispositive fact: four months, only forgetfulness.\n\n**Cut (5–15s):** \"Filing commenced the action and it was timely\" — true, not responsive (wrong call) — cut. \"The lawyer agreed to accept service\" — true, doesn't excuse the four-month failure — cut. \"The limitations period expired\" — a different consequence, not the service question — cut. \"No good cause for the failure to serve\" — survives.\n\n**Done at the Cut.** One survivor, three breaks named. Confidence ~95%. Commit. Total elapsed: well under thirty seconds, and you didn't touch the Clash or the Call. That's the common case, and banking that time is what lets you spend ninety seconds on the relation-back fork three questions later without falling behind.\n\n---",
      "drills": [
        {
          "id": "14.1",
          "title": "Sequence check. (Name the next move.)",
          "instructions_md": "For each mid-question state, state the **next action** in the workflow.",
          "items": [
            "1. You've read the stem but haven't classified rule vs standard.",
            "2. You're torn among three answers.",
            "3. You're down to exactly two responsive answers.",
            "4. You've named the Clash axis but can't find a deciding fact, and the stem is silent on it.",
            "5. You've cut to one answer and named all three breaks.",
            "6. Two answers survive and they're a matched pair on a single fact the stem provides.",
            "7. You've broken a tie with one Call heuristic.",
            "8. You see an \"only-X/only-Y/both/neither\" answer set.",
            "9. A subsequent remedial measure is offered against the party who made it.",
            "10. You've committed to a clean-cut answer but feel a vague unease."
          ],
          "item_count": 10,
          "key_md": "1. Classify rule/standard and read the call (Frame).\n2. Re-run the Cut — you skipped a filter.\n3. Clash — name the axis.\n4. Recognize the fork; lean and flag.\n5. Commit (~95%); move.\n6. Go to the stem for the splitting fact; resolve.\n7. Read the confidence band (~67%); commit or flag.\n8. Confirm the question from the stem before committing (question-ambiguity).\n9. Pin the purpose (negligence out; control/feasibility in) — BA-4.\n10. Ignore the unease — the breaks are named; move (underconfidence correction)."
        },
        {
          "id": "14.2",
          "title": "Time triage. (Fast path or flag?)",
          "instructions_md": "For each, decide: **[FAST — commit quickly]**, **[SPEND — worth the extra seconds]**, or **[FLAG — lean and leave]**.",
          "items": [
            "1. Clean Cut to one, breaks named.",
            "2. Anchor rule you know cold.",
            "3. A Clash with the axis named and a clear deciding fact.",
            "4. A relation-back fork with the deciding fact withheld.",
            "5. A matched pair whose splitting fact is in the stem.",
            "6. A bright-line rule you don't know.",
            "7. A two-survivor question resolvable by a single Call heuristic.",
            "8. A question-ambiguous set the stem doesn't disambiguate.",
            "9. An overclaim and a misfit flanking one clearly responsive answer.",
            "10. A degree-of-crime question where the stem gives the mental-state facts."
          ],
          "item_count": 10,
          "key_md": "1. **FAST.** 2. **FAST.** 3. **SPEND** (briefly — find the fact). 4. **FLAG.** 5. **SPEND** (find the fact, then commit). 6. **FLAG.** 7. **SPEND** (apply the heuristic, ~67%). 8. **FLAG.** 9. **FAST.** 10. **SPEND** (apply the facts, then commit)."
        },
        {
          "id": "14.3",
          "title": "Full workflow, mixed. (On the clock.)",
          "instructions_md": "Pick the answer; name the deciding phase and confidence band.",
          "items": [
            "1. *(Suit against the mother of a negligent child.)* A) child negligent; B) liable for any harm; C) assumed risk; D) failed to supervise.",
            "2. *(Firm-offer assurance for the year; orders a month later.)* A) PE; B) firm for that month; C) no consideration; D) longer than three months.",
            "3. *(Diversity; non-diverse co-defendant added by the plaintiff.)* A) supplemental jurisdiction; B) judicial economy; C) dismiss — no complete diversity; D) not the same case/controversy.",
            "4. *(Informed consent; surgery succeeded, no harm.)* A) best judgment; B) no harm; C) would have refused; D) must always be told the risks.",
            "5. *(Repudiation; substitute bought before the retraction.)* A) retracted before performance; B) constructive condition; C) not retractable once communicated; D) relied before retraction.",
            "6. *(Federal fleet rule applied to a city; injunction sought.)* A) valid; no Tenth Amendment violation; B) sovereign immunity; C) reserved state rights; D) exceeds the commerce power.",
            "7. *(Prior statement by a forgetful assault victim.)* A) no showing of personal knowledge; B) memory loss bars cross; C) subject to cross, knowledge shown; D) his own statement.",
            "8. *(Marketable title; recorded covenant; zoning bars use.)* A) covenant unmarketable; B) zoning clouds title; C) warranty deed cures it; D) silent on title.",
            "9. *(Renewed JMOL after a defense verdict, preserved; plus a new-trial motion.)* A) new-trial only; B) only one; C) both; D) combine with relief from judgment.",
            "10. *(Slip-and-fall; subsequent wax change offered against the store.)* A) admissible to prove negligence; B) inadmissible for any purpose; C) admissible only for control/feasibility if disputed; D) admissible as an admission."
          ],
          "item_count": 10,
          "key_md": "1. **D** — Cut — ~95%.\n2. **B** — anchor — ~95%.\n3. **C** — anchor (§1367(b)) — ~95%.\n4. **B** — Cut (distortion/overclaim) — ~90%.\n5. **D** — Clash (reliance fact) — ~88%.\n6. **A** — anchor (Garcia) / Cut (misfit B) — ~90%.\n7. **C** — Cut (backwards B, flat D, half-truth A) — ~88%.\n8. **A** — anchor / Cut (backwards B) — ~92%.\n9. **C** — anchor (Rule 50(b)) — ~95%.\n10. **C** — BA-4 (purpose) — ~88%."
        },
        {
          "id": "14.4",
          "title": "Full workflow, mixed, harder. (On the clock.)",
          "instructions_md": "",
          "items": [
            "1. *(State gas field sold by bid to a lower local bidder.)* A) compelling interest; B) market participant; C) due process; D) discriminated against commerce.",
            "2. *(Add a negligence claim; original was failure to disclose an alternative method.)* A) SOL expired next day; B) different occurrence; C) change-of-party prong; D) relates back.",
            "3. *(Plagiarism 12(b)(6); defendant says no facts show access.)* A) dismiss — no proof of access; B) deny — discovery will reveal what he received; C) dismiss — elements/facts not pleaded; D) deny — plaintiff will likely win.",
            "4. *(Quash subpoena of a retained-but-uncalled expert.)* A) full disclosure; B) relevant; C) substantial need + undue hardship; D) exceptional circumstances.",
            "5. *(Picketing ban with a zoning-topic exception.)* A) content-neutral; B) regulates conduct; C) irrational discrimination; D) content-based.",
            "6. *(SCOTUS petition; state law struck on federal and state grounds.)* A) independent state ground; B) only federal-constitutionality decisions; C) any federal-law interpretation; D) decisions striking laws under the federal Constitution.",
            "7. *(Warrantless search later found unlawful; officer relied in good faith on a facially valid warrant; suppression motion.)* A) suppress — unconstitutional; B) admit — good-faith exception; C) suppress — all bad-search evidence excluded; D) admit — no rights.",
            "8. *(Contractor's jury demand in state court under state rules.)* A) Sixth Amendment doesn't apply; B) Seventh Amendment not incorporated; C) Sixth Amendment applies; D) state law provides the jury.",
            "9. *(Negligently mishandled corpse; mother's distress, no physical harm.)* A) no recovery without physical harm; B) recovery — corpse NIED; C) only if she witnessed it; D) only on intent.",
            "10. *(First-degree murder = poison or premeditation; laxatives given for discomfort; idiosyncratic death.)* A) only poison; B) only premeditation; C) both; D) No."
          ],
          "item_count": 10,
          "key_md": "1. **B** — Clash (participant fact) — ~88%.\n2. **B** — Clash (different occurrence); C is bait — ~85%.\n3. **B** — BA-3 (procedural) — ~88%.\n4. **D** — Cut/Clash (consulting expert); A/C are bait — ~85%.\n5. **D** — Clash (content-based exemption) — ~88%.\n6. **A** — Clash (independent state ground) — ~88%.\n7. **B** — BA-2 (good-faith exception) — ~85%.\n8. **D** — Clash (source of the right); Sixth-Amendment pair cut — ~85%.\n9. **B** — anchor (corpse NIED) — ~92%.\n10. **D** — Clash (facts negate both predicates) — ~88%."
        },
        {
          "id": "14.5",
          "title": "Full workflow, mixed, hardest. (Forks, matched pairs, ambiguity — on the clock.)",
          "instructions_md": "For each, resolve if you can; if it's a coin, mark **[FLAG]** and your lean.",
          "items": [
            "1. *(Class rep's jury demand; defendant moves to strike it; \"class actions are historically equitable.\")* A) jury on certification and merits; B) jury only on the merits; C) jury only on certification; D) no jury on either.",
            "2. *(Relation back; the stem is silent on whether the claims share an occurrence.)* A) different occurrence; B) relates back; C) change-of-party prong; D) SOL expired.",
            "3. *(Two survivors: no contract formed vs immaterial breach; facts murky.)* A) no contract formed; B) breach immaterial.",
            "4. *(Premises liability; the stem doesn't state whether the entrant was permitted.)* A) trespasser — no duty; B) licensee — warn of known dangers; C) invitee — reasonable care; D) depends on status.",
            "5. *(Conspiracy; the only other \"conspirator\" feigned agreement; the jurisdiction's rule is unstated.)* A) guilty — bilateral met; B) not guilty — feigned agreement; C) guilty — unilateral suffices; D) not guilty — withdrawal.",
            "6. *(Embezzlement vs larceny; a teller lawfully holds bank funds, then converts them.)* A) larceny; B) embezzlement; C) false pretenses; D) no crime.",
            "7. *(Employee's jury demand under the Seventh Amendment, in state court, for an injunction.)* A) Seventh Amendment not incorporated; B) equity, no jury; C) common-law contract suit; D) de minimis value.",
            "8. *(Botanist's mixed legal and equitable claims with common issues; jury demand.)* A) essentially equitable, no jury; B) none bear exclusively on equity; C) jury on every claim regardless; D) jury on the common issues.",
            "9. *(Attempt; the defendant tried to receive \"stolen\" goods that were in fact not stolen.)* A) guilty — factual impossibility no defense; B) not guilty — legal impossibility; C) guilty — strict liability; D) not guilty — withdrawal.",
            "10. *(Comedian's supplemental pleading of an intentional tort committed after filing.)* A) business-tort SOL expired; B) the tort occurred after filing; C) relates back to the business tort; D) timely supplemental pleading."
          ],
          "item_count": 10,
          "key_md": "1. **B** — confirm the question (jury scope); damages legal (jury), certification equitable (no jury) — ~85%.\n2. **FLAG** — fork, fact withheld — ~50%; lean per surrounding facts.\n3. **A** — Call (layer-fundamentalness) — ~80%.\n4. **FLAG** unless the stem hides a status fact — ~50%; if a status fact is present, resolve to that duty.\n5. **FLAG / lean B** — turns on the jurisdiction's rule (bilateral → B; unilateral → C); unstated → flag, lean common-law/B.\n6. **B** — anchor (embezzlement) — ~92%.\n7. **A** — framing (state court, Seventh-Amendment demand → non-incorporation) — ~85%.\n8. **D** — Clash (common issues → jury on them, Beacon Theatres); C overclaims — ~82%.\n9. **A** — anchor (factual impossibility is no defense; the goods being non-stolen is factual) — ~85%.\n10. **D** — BA-2 (post-filing event → Rule 15(d) supplemental pleading; B is the trigger, not a bar) — ~85%."
        }
      ],
      "how_to_use_md": "Drills 14.1 and 14.2 train the meta-skill the clock demands: knowing, at every moment, what the next move is and whether a question is worth your seconds. Drills 14.3 through 14.5 are full-length rehearsal at increasing difficulty — run them timed, and after each set, look only at your *misses* and name the phase that failed: a missed Cut (an un-heard mold), a missed Clash (a misread axis or an overlooked fact), a coin you tried to crack, or a clean answer you talked yourself out of. That diagnosis, repeated, is how the method becomes reflex.\n\nStepping back: you began this course with one idea — the credited answer is the one that is **true and responsive**, and every distractor breaks one of those filters. You built the **Ear** to catch the untrue (overclaim, falsity, distortion), and **Issue-Sense** to catch the unresponsive (misfit, bait-doctrine, wrong-element), with **prediction** as the habit that arms Issue-Sense. You learned to resolve two survivors at the **Clash** (axis, fact, matched pairs, forks), to break residual ties at the **Call** (the deck and the anchors), to read the **architectures** the exam builds traps around, and to **calibrate** honestly — committing hard on clean cuts, flagging coins fast. And now you run all of it in thirty seconds.\n\nThe method's whole claim is that most MBE questions are crackable by structure, that the structure is learnable, and that the small remainder which turn on a fact you weren't given or a rule you don't know are *identifiable as such* — so you spend your effort where it pays and flag where it doesn't. That's the C3 Method. The rest is repetition: drill the molds until you hear them, drill the anchors until you know them, and run the workflow until the thirty seconds is something you do, not something you think about.",
      "drill_item_count": 50
    }
  ]
} as const;
