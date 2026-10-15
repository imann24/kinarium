# Supply pressure, recovery and outcome consistency

## Diagnosis

Baseline: main at `c3c1c33` (PR #32), including speech expansion, repair/avoidance and resident attribution. Nine six-person worlds (three templates × seeds 1, 42, 101) ran for 60 simulated days without player events. Each step retained the latest 80 journal entries, as live snapshots do. This sample diagnoses the formulas; it is not a reconstruction of the deployed world's history.

Six residents consume `6 × .008 × 720 = 34.56` supply points per day. Previously only practical residents on floor 2 produced supplies (`.12` per step); one practical resident produced approximately 18–19 points/day in these runs. Worlds with no practical residents had no ordinary production. Evening tea supplied eight points only when cohesion exceeded 45, so it stopped helping a distressed world.

Below 20 supplies, mood lost `.2` per step (144/day), while scarcity added `.06` tension per step (43.2/day). Tension had no ongoing easing. Conversely, available supplies gave mood an unconditional `.035` per step (25.2/day), even near 100. Those flows compounded encounter effects into low and high extremes.

Seven of nine baseline worlds ended at rounded mean mood 0, supplies 0–3 and tension 100. The other two ended at mean mood 100, supplies 80–81 and tension 0. In the last ten days, the distressed worlds spent 98–100% of resident-steps at mood 0. These results support a supply/recovery fix; they do not show that every disagreement or low mood is a defect.

## Changes and tradeoffs

- Supply upkeep replaces passive trait-only production. Any at-home resident with at least 40 energy may travel to the supply floor during daytime when stock is below the reserve threshold. One works at a time, paying 10 energy up front and occupying 16 simulated minutes. Completion adds eight supplies (ten for practical residents), bounded by remaining capacity. The resident then returns to the gathering floor or heads to rest below 40 energy. Each resident has a 180-minute cooldown. Unfinished work interrupted by time away adds nothing; the spent energy is not refunded.
- The reserve threshold is `min(95, max(35, ceil(20 + activePopulation × .008 × 240)))`: the shortage boundary plus roughly eight hours of nighttime use, with a minimum of 35. Larger populations need a larger reserve. Consumption, event costs, existing evening tea and actual scarcity remain in force.
- Mood now settles toward 50 by `(50 - mood) / 250` per step, in addition to actual factors. Available supplies provide `.015` rather than `.035`; scarcity still costs `.2`. Existing belonging and tension terms remain unchanged. This reduces permanent high-mood saturation while keeping severe ongoing distress capable of holding mood at 0. The new factor is explicitly shown in resident explanations.
- With residents at home, tension eases by `tension × .00015` per step. At maximum tension this is only `.015`, less than the `.06` scarcity pressure. Replenishment does not reset tension, mood, trust, affinity or unresolved disagreements.
- Work has visible start/completion/interruption journal records. The start event records the actual −10 energy through `recordResidentChange`; gaining communal supplies does not invent a direct mood gain. Optional saved task/cooldown fields preserve in-progress work across saves. Old saves have no invented tasks.

In the same nine-world sample after these changes, rounded final mean mood was 76–85, supplies 34–42 and tension 0–1. No world spent a rounded 1% of its last ten days at mood 0, mood 100, empty supplies or maximum tension. Three separately distressed, low-trust saves with no practical residents also recovered supply levels and some mood over ten days, starting at energy 15. One- and 40-resident tests cover resource availability and energy bounds. These finite samples do not establish universal balance: a quiet well-supplied household can still reach high cohesion/belonging, and repeated disruptive events or ongoing shortage can still cause distress. Those scores were not reset or hidden.

## Labels and dialogue

Relationship groups and labels share one function across Bonds, resident profiles and Insights. No encounters means “Yet to meet,” regardless of shared-event bonuses. Ten or more encounters supports “Familiar,” not a claim of closeness. Close requires affinity above 35 and trust at least 50. Unresolved disagreement, pending repair, trust below 25 or affinity below −20 is grouped as strained; labels name the recorded condition.

Negative encounter scenes now make the disagreement explicit, including belonging, memory and fatigue variants. Owned memories remain owned; a listener can disagree about their meaning without inventing a different event. Event callbacks require both participants to have been present and describe a discussion of an earlier event, not the event happening again. Legacy tense fallback dialogue also preserves disagreement. A journal's “has a disagreement” does not imply that it was repaired. Repair status is displayed without revealing an unreached outcome.

AI instructions preserve the authoritative encounter outcome and cannot grant repair rewards. They do not prove semantic obedience from a live model; deterministic procedural scenes and authoritative simulation effects have regression coverage. The existing 360-encounter variety sample has 231 distinct transcripts summed within sequences and 66 adjacent repeated topics, versus 246 and 66 before this change. That modest reduction reflects clearer outcome constraints; memory ownership, speaker influence and six event-specific voices remain tested.

## Verification

`pnpm test` includes `supplies.test.ts`, `simulation-consistency.test.ts` and the nine-world `saturation-diagnostic.test.ts`, which logs reproducible measurements and asserts bounds on repeated saturation. Also run `pnpm check`, `pnpm build` and `pnpm test:residents` for local SQLite restart coverage.

With Vite running, `tests/supplies.browser.mjs` uses real engine fixtures and mocked local transport. It checks work progress, energy attribution, partial resupply that remains a shortage, the recovery threshold, relationship labels, journal outcomes, Insights, keyboard use and light/dark layouts at 1440/390/320px. `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` may select existing installations. Existing resident-state, repair, dialogue, away-confirmation and text-expansion browser regressions remain applicable. No live-world command or deployment is part of this validation.

The integration alarm check reads `worldMinute` from the history response without advancing simulation. Checking for a new journal record was unreliable: quiet ticks may advance the persisted clock without an encounter. Local SQLite inspection confirmed that distinction; history reads retain their existing read-only behavior.
