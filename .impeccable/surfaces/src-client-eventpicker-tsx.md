---
version: 1
slug: "src-client-eventpicker-tsx"
primary_target: "src/client/EventPicker.tsx"
related_targets: ["src/client/event-picker.css","src/client/EventAllowance.tsx","src/client/event-effects.ts","src/client/main.tsx"]
---

# House events

Mode: Operate. Scope: the house-events section, event allowance, and catalog interaction. Preserve Kinarium’s Ensemble playhouse system and all authored events. The user explicitly chose immediate dispatch from each event on November 7, 2026. No preview or confirmation step.

## Direction contract

THESIS: A compact event menu makes a household intervention readable before one direct tap. Replace the equal-weight card wall and deck toggle with a category rail and ruled event list.

OWN-WORLD: Existing navy, white program surfaces, Manrope controls, Anton section title, saffron dispatch affordances. Tone color is semantic and restrained. Honor light and dark preferences for people watching at home in varied ambient light.

STORY: See remaining allowance, choose a tone or search an effect, read the authored event and its base effects, send it immediately, and see the server-confirmed result.

FIRST VIEWPORT: A title and short explanation at left, compact allowance at right. Below, a narrow tone index anchors two columns of event rows, each with a name, description, effects, and Send action. Phone layout stacks the allowance, horizontal tone choices, search, and one-column rows. Status remains adjacent to the menu.

FORM: Existing-world component replacement, shaped directly around the user’s pinned one-tap interaction; no new-world seed. Code-led per project config. Signature interaction: the chosen row becomes Sending, then Sent after server acknowledgement, with shared cooldown in the status bar. Motion is limited to short background/color transitions and respects reduced motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Implemented component

The section uses the existing semantic surface and panel radius, a 1560px maximum width, 32px insets, and the 40px Anton program heading. The allowance sits beside the heading as a 290px group with a segmented semantic meter, available/limit count, and refill countdown. There are no new palette or font primitives; the global system remains Ensemble playhouse.

A 190px tone rail is sticky at 24px and sits 32px from the menu. All, Gentle, Mixed and Disruptive expose category counts and pressed states; counts describe the available catalog before search. The selected tone uses selected blue and selected ink. Two columns of native button rows have a 28px gap, 24px vertical padding, square corners, and bottom rules. Every row contains an SVG icon, authored name and description, signed nonzero effects, and a saffron Send affordance. Effects are sorted by absolute magnitude; increasing tension is unfavorable, while other positive changes use the good role. The starting-changes note avoids promising a particular resident response.

Search matches every entered word against the visible name, description, tone and effect labels. Clear search restores focus to the input; Show all events clears both the query and tone. The no-match state and the empty server-catalog state have distinct explanations. Filtering and search remain available during waits.

At 1200px, insets and the rail gap become 24px, the rail becomes 160px, and event rows form one column with 20px vertical padding. At 760px, the heading and allowance stack, the title becomes 32px, the rail becomes a horizontal group with 44px minimum targets, and search spans the menu at 16px input type. Tone descriptions and decorative dots are hidden on phones. The row's description and effects span its full width below the icon/name/Send line. At 360px, section insets narrow to 16px vertically and 12px horizontally.

## Dispatch and feedback

The entire row sends once on activation; there is no preview, intermediate selection, or confirmation step. A synchronous in-flight guard prevents duplicate taps. The row reads Sending while the request is pending. Success is announced only for a successful server result; the row shows Sent while the resulting wait is active, and separate polite feedback directs attention to the journal. A failed result or thrown request exposes the event's failure and a Retry affordance. A callback without a boolean result does not manufacture a success message.

Connection loss, another pending change, shared house cooldown and spent allowance disable event rows. The status prioritizes reconnection, sending, the controlling wait, then another pending change. The wait helper chooses whichever restriction ends later. Disabled copy stays readable at full opacity while the Send affordance becomes muted. Allowance counts and catalog compatibility come from the server-backed world state, and the meter exposes its current value and limit accessibly.

Rows and tone choices use 160ms ease-out background transitions, removed for reduced motion. Fine-pointer hover changes row background and Send color; active rows use selected blue. The menu's local keyboard outline is 2px with a 3px offset. The Send treatment is part of the full-row button, not a separate nested control.

## Documentation boundary

DESIGN.md and `.impeccable/design.json` record the event-row component and these local exceptions while retaining existing shared tokens. The earlier event-card and event-heading tokens remain for incumbent styles; they do not specify this replacement. The separate quick-event tray, house scene, dialogs, and prior full-interface fidelity limitations are outside this component's scope. This implementation introduces no raster assets. Documentation does not establish a finish-review verdict; that result belongs to the independent review.
