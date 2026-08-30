import { useEffect, useId, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { searchDestinations } from '../api/endpoints.js';
import { qk } from '../api/queryKeys.js';
import { destinationLines, matchRange } from '../lib/shipping.js';

// Where the parcel is going.
//
// This replaces the free-text "Kota" field, and it is not a cosmetic upgrade:
// the rate provider quotes from an opaque location id, so something has to
// turn what the buyer typed into one before a price exists at all.

const field = {
  border: '1px solid #F0E4CF',
  borderRadius: 12,
  padding: '12px 14px',
  fontSize: 14.5,
  background: '#FFFDF7',
  width: '100%',
};

const MIN_QUERY = 3;

export default function DestinationPicker({ value, onChange, disabled }) {
  const listId = useId();
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef(null);

  // Debounced into the query key. Every keystroke reaching the provider would
  // spend one of the merchant's hundred requests a day, and a buyer typing an
  // address produces a lot of keystrokes.
  useEffect(() => {
    const id = setTimeout(() => setTerm(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);

  const results = useQuery({
    queryKey: qk.destinations(term),
    queryFn: ({ signal }) => searchDestinations(term, signal),
    enabled: term.length >= MIN_QUERY,
    // Keeps the previous list on screen while the next one loads, so the
    // dropdown does not blink to empty between keystrokes.
    placeholderData: (prev) => prev,
    staleTime: Infinity,
  });
  const rows = results.data ?? [];

  useEffect(() => {
    function onAway(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onAway);
    return () => document.removeEventListener('mousedown', onAway);
  }, []);

  function pick(row) {
    onChange(row);
    setQ('');
    setOpen(false);
    setActive(0);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') return setOpen(false);
    if (!open || rows.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % rows.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + rows.length) % rows.length);
    } else if (e.key === 'Enter') {
      // Enter picks the highlighted row rather than submitting the form
      // around it, which would send a checkout with no destination.
      e.preventDefault();
      pick(rows[active]);
    }
  }

  if (value) {
    const { primary, secondary } = destinationLines(value);
    return (
      <div
        style={{
          marginTop: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          border: '1px solid #F0E4CF',
          borderRadius: 12,
          padding: '10px 14px',
          background: '#FFFDF7',
        }}
      >
        <span>
          <span style={{ display: 'block', fontSize: 14.5, color: '#43382E' }}>{primary}</span>
          <span style={{ display: 'block', fontSize: 12.5, color: '#B49E6A', letterSpacing: 0.2 }}>
            {secondary}
          </span>
        </span>
        <button
          type="button"
          className="hv-pink"
          onClick={() => onChange(null)}
          style={{
            border: '1px solid #F3B8C8',
            background: 'transparent',
            color: '#B4557A',
            borderRadius: 999,
            padding: '6px 14px',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Ubah
        </button>
      </div>
    );
  }

  return (
    <div ref={boxRef} style={{ position: 'relative', marginTop: 12 }}>
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && rows.length ? `${listId}-${active}` : undefined}
        aria-label="Kecamatan atau kota tujuan"
        autoComplete="off"
        disabled={disabled}
        value={q}
        placeholder="Kecamatan, kota, atau kode pos"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        style={field}
      />

      {open && term.length >= MIN_QUERY ? (
        <ul
          id={listId}
          role="listbox"
          style={{
            position: 'absolute',
            zIndex: 30,
            insetInline: 0,
            marginTop: 6,
            maxHeight: 288,
            overflowY: 'auto',
            listStyle: 'none',
            padding: 6,
            border: '1px solid #F0E4CF',
            borderRadius: 16,
            background: '#fff',
            boxShadow: '0 10px 30px rgba(67,56,46,0.10)',
          }}
        >
          {results.isError ? (
            <li style={{ padding: '12px 10px', fontSize: 13.5, color: '#B4557A' }}>
              Pencarian gagal. Coba lagi sebentar lagi.
            </li>
          ) : rows.length === 0 ? (
            <li style={{ padding: '12px 10px', fontSize: 13.5, color: '#8A7D70' }}>
              {results.isFetching ? 'Mencari…' : 'Tidak ada yang cocok. Coba nama kecamatan.'}
            </li>
          ) : (
            rows.map((row, i) => {
              const { primary, secondary } = destinationLines(row);
              return (
                <li
                  key={row.ref}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    // mousedown, not click: the input blurs first and the
                    // list would unmount before a click ever landed.
                    e.preventDefault();
                    pick(row);
                  }}
                  style={{
                    padding: '9px 10px',
                    borderRadius: 11,
                    cursor: 'pointer',
                    background: i === active ? '#FDF6E3' : 'transparent',
                  }}
                >
                  <div style={{ fontSize: 14, color: '#43382E' }}>
                    <Highlight text={primary} query={term} />
                  </div>
                  <div style={{ fontSize: 12, color: '#B49E6A', letterSpacing: 0.2 }}>
                    {secondary}
                  </div>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}

/** Emphasises the part of a result the buyer actually typed. */
function Highlight({ text, query }) {
  const at = matchRange(text, query);
  if (!at) return text;
  return (
    <>
      {text.slice(0, at.start)}
      <mark style={{ background: 'transparent', color: '#D26E8E', fontWeight: 700 }}>
        {text.slice(at.start, at.end)}
      </mark>
      {text.slice(at.end)}
    </>
  );
}
