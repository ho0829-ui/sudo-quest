import type { Tomb } from "./creditRoll";

/** 작은 비석들. 이름·떠난 날·묘비명. 비석 위 작은 꽃은 장식이다. */
export function Graveyard({ tombs }: { tombs: Tomb[] }) {
  return <ul className="graveyard">
    {tombs.map(t => <li key={t.name} className="tomb">
      <span className="tomb-flower" aria-hidden="true">✿</span>
      <span className="tomb-rip" aria-hidden="true">R.I.P</span>
      <strong>{t.name}</strong>
      <time dateTime={t.died}>~ {t.died.replace(/-/g, ".")}</time>
      <p>{t.epitaph}</p>
    </li>)}
  </ul>;
}
