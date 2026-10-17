/** Workers AI text-generation models vetted for short, in-character dialogue. Pure data, shared by server and UI. */
export interface DialogueModelInfo {
  id: string;
  label: string;
  /** USD per million tokens from the Workers AI pricing page (checked 2026-10-17); undefined when not verified. */
  price?: { input: number; output: number };
  /** Extra Workers AI input fields this model needs (for example, to turn off built-in reasoning). */
  extraInputs?: Record<string, unknown>;
  note?: string;
}

export const DIALOGUE_MODELS: readonly DialogueModelInfo[] = [
  { id: '@cf/meta/llama-3.1-8b-instruct-fp8', label: 'Llama 3.1 8B', price: { input: .152, output: .287 }, note: 'Default: inexpensive, non-reasoning.' },
  { id: '@cf/meta/llama-3.1-8b-instruct-fp8-fast', label: 'Llama 3.1 8B (fast)', note: 'Legacy ID kept for existing configuration.' },
  { id: '@cf/meta/llama-3.2-3b-instruct', label: 'Llama 3.2 3B', price: { input: .0509, output: .335 }, note: 'Lowest input cost; terser.' },
  { id: '@cf/google/gemma-4-26b-a4b-it', label: 'Gemma 4 26B A4B', price: { input: .1, output: .3 }, extraInputs: { chat_template_kwargs: { enable_thinking: false } }, note: 'Mixture-of-experts; reasoning is switched off for short replies.' },
  { id: '@cf/mistralai/mistral-small-3.1-24b-instruct', label: 'Mistral Small 3.1 24B', price: { input: .351, output: .555 } },
  { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', label: 'Llama 3.3 70B (fast)', price: { input: .293, output: 2.253 }, note: 'Highest quality here and the costliest output; 24k context.' },
  { id: '@cf/meta/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17B', note: 'Multimodal MoE; price not verified.' },
];

export const dialogueModel = (id: string | null | undefined) => DIALOGUE_MODELS.find(m => m.id === id);

/** Display name only; operator-supplied models outside the registry show their raw ID. */
export const dialogueModelLabel = (id: string) => dialogueModel(id)?.label ?? id;
