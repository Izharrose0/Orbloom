import { useEffect, useState } from 'react';
import { fetchAllPlanets, CensusRow } from '../lib/persistence';
import { deriveQuadrant } from '../lib/genome';
import { formatBig, formatDecimal } from '../lib/format';
import { useGameStore } from '../store/useGameStore';

export default function OrbCensus() {
  const [rows, setRows] = useState<CensusRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const myId = useGameStore((s) => s.userId);

  const refresh = async () => {
    setLoading(true);
    const r = await fetchAllPlanets(200);
    setRows(r);
    setLoading(false);
  };

  useEffect(() => {
    if (open && rows === null) refresh();
  }, [open]);

  return (
    <div className={`census ${open ? 'open' : ''}`}>
      <button className="census-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? '×' : '☰ Census'}
      </button>

      {open && (
        <div className="census-body">
          <div className="census-header">
            <div className="census-title">Orbloom Census</div>
            <button className="census-refresh" onClick={refresh} disabled={loading}>
              {loading ? '...' : '↻'}
            </button>
          </div>

          {!rows && <div className="census-empty">Loading…</div>}
          {rows && rows.length === 0 && <div className="census-empty">No orbs yet.</div>}

          {rows && rows.length > 0 && (
            <div className="census-table-wrap">
              <table className="census-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Sector</th>
                    <th style={{ textAlign: 'right' }}>Mass</th>
                    <th style={{ textAlign: 'right' }}>Evo</th>
                    <th style={{ textAlign: 'right' }}>★</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const sector = deriveQuadrant(r.id);
                    const isMe = r.id === myId;
                    const displayName = r.custom_name ?? r.name ?? '—';
                    return (
                      <tr key={r.id} className={isMe ? 'me' : ''}>
                        <td title={r.id}>{isMe ? '★ ' : ''}{displayName}</td>
                        <td>{sector}</td>
                        <td style={{ textAlign: 'right' }}>{formatBig(r.mass)}</td>
                        <td style={{ textAlign: 'right' }}>{formatDecimal(r.evolution)}</td>
                        <td style={{ textAlign: 'right' }}>{formatBig(r.drifter_collected ?? 0, 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {rows && (
            <div className="census-footer">
              {rows.length} orb{rows.length !== 1 ? 's' : ''} ranked by mass
            </div>
          )}
        </div>
      )}
    </div>
  );
}
