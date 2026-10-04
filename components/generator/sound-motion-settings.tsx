'use client';
import type { VideoSettings } from '@/lib/contracts';
import { getVideoModelUnavailableReason } from '@/lib/video-availability';
import { SettingsDialog } from './video-settings';
import { ReferenceMediaPicker } from './reference-media-picker';
import type { PreparedReference } from './reference-media';
import { useGenerationTranslations } from './use-generation';
export function SoundMotionSettings({ value, onChange, video, song, onVideoChange, onSongChange, onVideoBusy, onSongBusy, disabled }: { value: VideoSettings; onChange: (patch: Partial<VideoSettings>) => void; video: PreparedReference | null; song: PreparedReference | null; onVideoChange: (value: PreparedReference | null) => void; onSongChange: (value: PreparedReference | null) => void; onVideoBusy: (busy: boolean) => void; onSongBusy: (busy: boolean) => void; disabled: boolean }) {
  const t = useGenerationTranslations();
  const soundLabels = { template: 'Template soundtrack', song: 'Your song', clip: 'Clip audio', ai: 'AI rap' };
  const wan = value.model === 'wan-3.0';
  const seedanceUnavailableReason = getVideoModelUnavailableReason('seedance-2');
  return <SettingsDialog title="Sound and motion" summary={`${t(value.motion === 'video' ? 'Your motion clip' : 'Template motion')} · ${t(soundLabels[value.soundtrack])}`} disabled={disabled}>
    <fieldset disabled={disabled}><legend>{t('Motion')}</legend><div className="mi-choice-grid">{(['template', 'video'] as const).map(m => <button type="button" className={`mi-choice ${value.motion === m ? 'selected' : ''}`} key={m} role="radio" aria-checked={value.motion === m} onClick={() => onChange({ motion: m })}><strong>{t(m === 'video' ? 'Your motion clip' : 'Template motion')}</strong><small>{t(m === 'video' ? 'Upload a video and choose its movement reference.' : 'Use the built-in performance reference.')}</small></button>)}</div></fieldset>
    {value.motion === 'video' && <ReferenceMediaPicker kind="video" value={video} onChange={onVideoChange} disabled={disabled} onBusyChange={onVideoBusy}/>}
    {seedanceUnavailableReason && <p id="mi-sound-unavailable" className="mi-settings-note">{t(seedanceUnavailableReason)}</p>}
    <fieldset disabled={disabled}><legend>{t('Soundtrack')}</legend><div className="mi-choice-grid">{(['template', 'song', 'clip', 'ai'] as const).map(sound => { const unavailableReason = sound === 'ai' ? seedanceUnavailableReason : undefined; const unavailable = Boolean(unavailableReason) || sound === 'clip' && (value.motion !== 'video' || !video?.audioFile); return <button type="button" key={sound} className={`mi-choice ${value.soundtrack === sound ? 'selected' : ''}`} disabled={unavailable} aria-describedby={unavailableReason ? 'mi-sound-unavailable' : undefined} title={unavailableReason ? t(unavailableReason) : undefined} role="radio" aria-checked={value.soundtrack === sound} onClick={() => onChange({ soundtrack: sound })}><strong>{t(soundLabels[sound])}</strong><small>{t(unavailableReason ? 'Temporarily unavailable' : sound === 'ai' ? 'Uses Seedance to create original lyrics and music.' : sound === 'clip' ? 'Use the sound extracted from your motion clip.' : sound === 'song' ? 'Upload your own audio. Uses Wan in Hotel Lobby.' : 'Use the built-in template audio. Uses Wan in Hotel Lobby.')}</small></button>; })}</div></fieldset>
    {value.soundtrack === 'song' && <ReferenceMediaPicker kind="audio" value={song} onChange={onSongChange} disabled={disabled} onBusyChange={onSongBusy}/>}
    {value.soundtrack === 'ai' && <label className="mi-field-label">{t('Rap topic')}<textarea className="mi-text-area" value={value.topic} maxLength={1000} disabled={disabled} onChange={e => onChange({ topic: e.target.value })} placeholder={t('A birthday, your friendship, or a story about your duo')}/><small>{t('Leave blank for a rap about your duo.')}</small></label>}
    {value.motion === 'video' && !video?.audioFile && <p className="mi-settings-note">{t('Clip audio is available after preparing a video with an audio track.')}</p>}
    <p className="mi-settings-note">{t(wan ? 'Wan follows your audio reference. Review the result before sharing.' : 'Seedance creates original audio. Your retained song will be available when you switch back.')}</p>
  </SettingsDialog>;
}
