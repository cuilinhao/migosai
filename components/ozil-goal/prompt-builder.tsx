'use client';
import { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { buildOzilPrompt, defaultPromptSelection, promptOptions, type PromptSelection } from './prompt';
const legends = { length: 'Clip length', split: 'Prompt style', outfit: 'What they wear', setting: 'Setting', camera: 'Camera', ending: 'Ending' };
export function PromptBuilder() {
  const [selection, setSelection] = useState<PromptSelection>(defaultPromptSelection);
  const [message, setMessage] = useState('');
  const prompt = useMemo(() => buildOzilPrompt(selection), [selection]);
  const choices = (key: keyof typeof promptOptions) => <fieldset className="min-w-0" key={key}><legend className="mb-2 text-[13.5px] font-semibold text-[var(--og-muted)]">{legends[key]}</legend><div className="flex flex-wrap gap-2">{promptOptions[key].map(option => <button key={option.value} type="button" aria-pressed={selection[key] === option.value} onClick={() => { setSelection(current => ({ ...current, [key]: option.value })); setMessage(''); }} className={`min-h-11 rounded-xl border px-3.5 text-[14px] font-semibold transition-colors ${selection[key] === option.value ? 'border-[var(--og-flash)] bg-[var(--og-flash-soft)] text-[var(--og-text)]' : 'border-[var(--og-line-strong)] bg-[var(--og-panel-2)] text-[var(--og-muted)] hover:text-[var(--og-text)]'}`}>{option.label}</button>)}</div></fieldset>;
  async function copy() {
    try { await navigator.clipboard.writeText(prompt); setMessage('Copied'); }
    catch { setMessage('Copy blocked: select the text and copy it by hand'); }
    window.setTimeout(() => setMessage(''), 2500);
  }
  return <div id="builder" className="scroll-mt-24 rounded-[24px] border border-[var(--og-line-strong)] bg-[var(--og-panel)] p-4 sm:p-6">
    <div className="grid gap-5 sm:grid-cols-2">{choices('length')}{choices('split')}{choices('outfit')}
      <div className="min-w-0"><label htmlFor="outfit-detail" className="mb-2 block text-[13.5px] font-semibold text-[var(--og-muted)]">Outfit detail (optional)</label><input id="outfit-detail" type="text" maxLength={90} value={selection.detail} onChange={event => setSelection(current => ({ ...current, detail: event.target.value }))} placeholder="e.g. red knitted scarf, round glasses" className="h-11 w-full rounded-xl border border-[var(--og-line-strong)] bg-[var(--og-panel-2)] px-3.5 text-[14.5px] text-[var(--og-text)] placeholder:text-[var(--og-faint)] focus:border-[var(--og-flash)] focus:outline-none" /></div>
      {choices('setting')}{choices('camera')}{choices('ending')}
    </div>
    <pre className="og-mono mt-6 max-h-[440px] overflow-auto rounded-2xl border border-[var(--og-line)] bg-[var(--og-bg-deep)] p-4 text-[13px] leading-relaxed whitespace-pre-wrap break-words text-[var(--og-text)]" data-testid="ozil-public-prompt">{prompt}</pre>
    <div className="mt-4 flex flex-wrap items-center gap-4"><button type="button" onClick={copy} className="og-cta og-display inline-flex h-[52px] items-center gap-2 rounded-2xl px-6 text-[19px]">{message === 'Copied' ? <Check className="size-5" /> : <Copy className="size-5" />}Copy the prompt</button><output aria-live="polite" className="text-[13.5px] text-[var(--og-faint)]">{message || `${prompt.split(/\s+/).filter(Boolean).length} words · plain text, no real names`}</output></div>
  </div>;
}
