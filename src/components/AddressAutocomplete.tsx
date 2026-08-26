import { useEffect, useRef, useState } from "react";
import { searchAddresses, type AddressSuggestion, type LatLng } from "../lib/geo";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (value: string, coords: LatLng) => void;
  placeholder?: string;
  onFocus?: () => void;
  /** If true, this field is the current map-click target (highlighted). */
  active?: boolean;
}

/**
 * Address input with a dropdown of Nominatim autocomplete suggestions that match
 * the current query. Keyboard-navigable (↑/↓/Enter/Escape); click-outside closes.
 */
export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  onFocus,
  active,
}: Props) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const seqRef = useRef(0);

  // Debounced search on the current query.
  useEffect(() => {
    const q = value.trim();
    if (!q) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const seq = ++seqRef.current;
    const timer = setTimeout(async () => {
      try {
        const res = await searchAddresses(q);
        if (seq !== seqRef.current) return;
        setSuggestions(res);
        setHighlighted(0);
        setOpen(res.length > 0);
      } catch {
        if (seq === seqRef.current) setSuggestions([]);
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [value]);

  // Close when clicking outside the component.
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const pick = (s: AddressSuggestion) => {
    onChange(s.value);
    onSelect(s.value, s.coords);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) {
      if (e.key === "Escape") setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((a) => (a + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((a) => (a - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(suggestions[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className={`ac${active ? " ac--active" : ""}`} ref={rootRef}>
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => onFocus?.()}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        aria-expanded={open}
      />
      {open && (
        <ul className="ac__list" role="listbox">
          {loading && suggestions.length === 0 && <li className="ac__empty">Searching…</li>}
          {!loading && suggestions.length === 0 && <li className="ac__empty">No matches</li>}
          {suggestions.map((s, i) => (
            <li
              key={`${s.value}-${i}`}
              role="option"
              aria-selected={i === highlighted}
              className={`ac__item${i === highlighted ? " ac__item--active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
              onMouseEnter={() => setHighlighted(i)}
            >
              <span className="ac__pin">📍</span>
              <span className="ac__label">{s.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}