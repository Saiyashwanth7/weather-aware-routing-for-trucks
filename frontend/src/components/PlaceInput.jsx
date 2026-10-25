import { useEffect, useRef, useState } from 'react';
import { searchPlaces } from '../api.js';

/** Text box with place suggestions. value = { text, place }; place is set once a suggestion is picked. */
export default function PlaceInput({ id, label, value, onChange, placeholder }) {
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const timer = useRef(null);
  const latest = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  function handleInput(e) {
    const text = e.target.value;
    onChange({ text, place: null });
    clearTimeout(timer.current);
    const mine = ++latest.current;
    if (text.trim().length < 2) {
      setOptions([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const results = await searchPlaces(text.trim());
        if (mine !== latest.current) return; // a newer keystroke superseded this lookup
        setOptions(results);
        setActive(-1);
        setOpen(results.length > 0);
      } catch {
        if (mine === latest.current) setOptions([]);
      }
    }, 300);
  }

  function pick(option) {
    latest.current++;
    clearTimeout(timer.current);
    onChange({ text: option.label, place: option });
    setOpen(false);
  }

  function handleKey(e) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      pick(options[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="field place">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        value={value.text}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        onChange={handleInput}
        onKeyDown={handleKey}
        onFocus={() => options.length > 0 && setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      {open && (
        <ul className="suggestions" id={`${id}-list`} role="listbox">
          {options.map((o, i) => (
            <li
              key={`${o.lat},${o.lng}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : undefined}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus so blur doesn't close the list before the click lands
                pick(o);
              }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
