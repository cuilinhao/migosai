'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { X, SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import type { VideoSettings } from '@/lib/contracts';
import { aspectRatios, videoDurations, videoModels } from '@/lib/video-options';
import { getVideoModelUnavailableReason } from '@/lib/video-availability';
import { useGenerationTranslations } from './use-generation';
export function SettingsDialog({ title, summary, disabled, children }: { title: string; summary: string; disabled: boolean; children: ReactNode }) {
  const t = useGenerationTranslations();
  return <Dialog.Root><Dialog.Trigger className="mi-settings-summary" disabled={disabled}><SlidersHorizontal size={17}/><span><strong>{t(title)}</strong><small>{summary}</small></span><span>{t('Change')}</span></Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="mi-settings-overlay"/><Dialog.Content className="mi-settings-dialog"><div className="mi-settings-heading"><Dialog.Title>{t(title)}</Dialog.Title><Dialog.Close aria-label={t('Close settings')}><X size={20}/></Dialog.Close></div><Dialog.Description className="mi-settings-description">{t('Choose your settings before generating.')}</Dialog.Description><div className="mi-settings-body">{children}</div><Dialog.Close className="mi-primary-button">{t('Done')}</Dialog.Close></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
export function VideoSettingsPicker({ value, onChange, disabled, ownMotion }: { value: VideoSettings; onChange: (patch: Partial<VideoSettings>) => void; disabled: boolean; ownMotion: boolean }) {
  const t = useGenerationTranslations();
  const model = videoModels.find(m => m.id === value.model)!;
  const seedanceUnavailableReason = getVideoModelUnavailableReason('seedance-2');
  return <SettingsDialog title="Video settings" summary={`${model.label} · ${value.resolution} · ${value.duration}s · ${value.aspect}`} disabled={disabled}>
    {seedanceUnavailableReason && <p id="mi-model-unavailable" className="mi-settings-note">{t(seedanceUnavailableReason)}</p>}
    <fieldset disabled={disabled}><legend>{t('Model')}</legend><div className="mi-choice-grid">{videoModels.map(m => {
      const unavailableReason = getVideoModelUnavailableReason(m.id);
      return <button type="button" key={m.id} className={value.model === m.id ? 'mi-choice selected' : 'mi-choice'} role="radio" aria-checked={value.model === m.id} disabled={Boolean(unavailableReason)} aria-describedby={unavailableReason ? 'mi-model-unavailable' : undefined} title={unavailableReason ? t(unavailableReason) : undefined} onClick={() => onChange({ model: m.id })}><strong>{m.label}</strong><small>{t(unavailableReason ? 'Temporarily unavailable' : m.description)}</small></button>;
    })}</div></fieldset>
    <div className="mi-options-grid"><label>{t('Aspect Ratio')}<select value={value.aspect} disabled={disabled} onChange={e => onChange({ aspect: e.target.value as VideoSettings['aspect'] })}>{aspectRatios.map(a => <option key={a}>{a}</option>)}</select></label><label>{t('Duration')}<select value={value.duration} disabled={disabled || ownMotion} onChange={e => onChange({ duration: Number(e.target.value) })}>{ownMotion ? <option value={value.duration}>{t('{seconds} seconds', { seconds: value.duration })}</option> : videoDurations.map(d => <option key={d} value={d}>{t('{seconds} seconds', { seconds: d })}</option>)}</select></label><label>{t('Resolution')}<select value={value.resolution} disabled={disabled} onChange={e => onChange({ resolution: e.target.value as VideoSettings['resolution'] })}>{model.resolutions.map(r => <option key={r}>{r}</option>)}</select></label></div>
    {ownMotion && <p className="mi-settings-note">{t('Your selected motion clip determines the video duration.')}</p>}
  </SettingsDialog>;
}
