import { ChevronDown } from 'lucide-react';
import './field-guide.css';

const SECTIONS = [
  {
    title: 'Meet the residents',
    open: true,
    body: (
      <p>
        Click anyone in the house—or open <b>Residents</b>—to see their backstory, what they’re up to, and how their <b>mood</b>, <b>energy</b>, and <b>belonging</b> are shifting.
      </p>
    ),
  },
  {
    title: 'Conversations & relationships',
    body: (
      <p>
        Click a speech bubble to read the exchange or jump to it in the <b>Journal</b>. Friendly company builds <b>affinity</b> and <b>trust</b> over time, while tense moments take a one-on-one chat to mend. Respecting requests for space builds <b>goodwill</b>.
      </p>
    ),
  },
  {
    title: 'Journal, bonds & insights',
    body: (
      <p>
        The <b>Journal</b> records conversations and milestones as they happen. Check <b>Bonds</b> to see how housemates get along, or open <b>Community insights</b> for a wider view of the house.
      </p>
    ),
  },
  {
    title: 'Give the house a nudge',
    body: (
      <p>
        Welcome someone new, let a resident take time away (their memories and relationships stay safe), or trigger up to <b>3 house events every 5 minutes</b>.
      </p>
    ),
  },
  {
    title: 'Shared worlds, time & AI',
    body: (
      <p>
        Everyone in a world sees the same live house and shares its controls. Choose <b>Always on</b> or <b>Catch-up</b> time in <b>World settings</b>, or pick a resident’s <b>Dialogue model</b> for optional AI-extended chats.
      </p>
    ),
  },
];

export default function FieldGuide() {
  return (
    <div className="guide-copy">
      <p className="guide-lead">
        Watch a little community live at its own pace, and give it a gentle nudge when you like. There’s no score and nothing to win.
      </p>
      <div className="guide-list">
        {SECTIONS.map(section => (
          <details key={section.title} className="guide-item" open={section.open}>
            <summary>
              <span>{section.title}</span>
              <ChevronDown size={17} aria-hidden="true" className="guide-chevron" />
            </summary>
            <div className="guide-item-body">
              {section.body}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
