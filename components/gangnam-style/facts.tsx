import { GANGNAM_STYLE_ASPECTS, GANGNAM_STYLE_CONFIG, GANGNAM_STYLE_RESOLUTIONS, getGangnamStyleCost } from '@/lib/gangnam-style';
import { gangnamFactsCopy } from '@/lib/i18n/messages/gangnam-facts';
import type { Locale } from '@/lib/i18n/routing';
import { createTranslator } from '@/lib/i18n/translator';

export function GangnamFacts({ locale }: { locale: Locale }) {
  const copy = gangnamFactsCopy[locale];
  const format = createTranslator();
  const rows = [
    [copy.labels.aspect, GANGNAM_STYLE_ASPECTS.join(' / ')],
    [copy.labels.resolution, GANGNAM_STYLE_RESOLUTIONS.join(' / ')],
    [copy.labels.duration, format(copy.duration, { duration: GANGNAM_STYLE_CONFIG.duration })],
    [copy.labels.audio, copy.audio],
  ];
  return <div className="gns-facts">
    <table className="gns-facts-table">
      <caption>{copy.title}</caption>
      <tbody>
        {rows.map(([label, value]) => <tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>)}
        <tr><th scope="row">{copy.labels.cost}</th><td><ul>{GANGNAM_STYLE_RESOLUTIONS.map(resolution =>
          <li key={resolution}>{format(copy.cost, { resolution, credits: getGangnamStyleCost(resolution) })}</li>
        )}</ul></td></tr>
      </tbody>
    </table>
    <p className="gns-facts-note">{copy.note}</p>
    <p className="gns-facts-disclosure">{copy.independence}</p>
  </div>;
}
