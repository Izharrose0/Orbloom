import { useEffect, useState, useMemo } from 'react';
import { fetchAllPlanets, CensusRow } from '../lib/persistence';
import { deriveQuadrant } from '../lib/genome';
import { formatBig, formatDecimal } from '../lib/format';
import { useGameStore } from '../store/useGameStore';

export default function OrbCensus() {
  const [rows, setRows] = useState<CensusRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const myId = useGameStore((s) => s.userId);
  const myName = useGameStore((s) => s.name);
  const myCustomName = useGameStore((s) => s.customName);
  const myMass = useGameStore((s) => s.mass);
  const myEvo = useGameStore((s) => s.evolution);
  const myDrifters = useGameStore((s) => s.drifterCollected);

  const refresh = async () => {
    setLoading(true);
    const r = await fetchAllPlanets(200);
    setRows(r);
    setLoading(false);
  };

  useEffect(() => {
    if (open && rows === null) refresh();
  }, [open]);

  // Always include the user — even if the server hasn't received their first save yet
  const mergedRows = useMemo<CensusRow[]>(() => {
    if (!rows) return [];
    const hasMe = rows.some((r) => r.id === myId);
    if (hasMe) {
      // Use the freshest local values for the user's row
      return rows.map((r) =>
        r.id === myId
          ? { ...r, custom_name: myCustomName, name: myName, mass: myMass, evolution: myEvo, drifter_collected: myDrifters }
          : r
      );
    }
    const me: CensusRow = {
      id: myId,
      name: myName,
      custom_name: myCustomName,
      mass: myMass,
      evolution: myEvo,
      drifter_collected: myDrifters,
      updated_at: null,
    };
    // Insert me sorted by mass
    return [me, ...rows].sort((a, b) => b.mass - a.mass);
  }, [rows, myId, myName, myCustomName, myMass, myEvo, myDrifters]);

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

          {rows && mergedRows.length > 0 && (
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
                  {mergedRows.map((r) => {
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
              {mergedRows.length} orb{mergedRows.length !== 1 ? 's' : ''} · sorted by mass
              {rows.length === 0 && mergedRows.length === 1 && ' · server has no rows yet'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
