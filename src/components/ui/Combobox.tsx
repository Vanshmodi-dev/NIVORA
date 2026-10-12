import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import styles from "./Combobox.module.css";

export interface ComboboxOption {
  value: string;
  label: string;
}

export interface ComboboxProps {
  label: string;
  options: readonly ComboboxOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  helper?: string;
  error?: string | null;
  /** Hide the visible label (still the accessible name). */
  hideLabel?: boolean;
}

/**
 * Accessible single-select combobox (type-ahead): ↑/↓ move, Enter selects, Esc closes,
 * `aria-activedescendant` tracks the highlighted option (§14.9). Always clearable.
 */
export function Combobox({ label, options, value, onChange, placeholder = "Any", helper, error, hideLabel = false }: ComboboxProps) {
  const uid = useId();
  const listId = `${uid}-list`;
  const inputId = `${uid}-input`;
  const selected = options.find((o) => o.value === value) ?? null;
  const [text, setText] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setText(selected?.label ?? "");
    setTyped(false);
  }, [selected?.label]);

  const visible = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!typed || q === "") return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, text, typed]);

  const commit = (opt: ComboboxOption | null) => {
    onChange(opt ? opt.value : null);
    setText(opt?.label ?? "");
    setTyped(false);
    setOpen(false);
  };

  const close = () => {
    setOpen(false);
    setText(selected?.label ?? "");
    setTyped(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActive((a) => Math.min(visible.length - 1, open ? a + 1 : a));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      const opt = visible[active];
      if (opt) commit(opt);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };

  // The listbox below has tabIndex -1: Chrome makes scrollable containers Tab-focusable, which
  // closed the list on blur and dropped focus to <body>.
  const activeId = open && visible[active] ? `${uid}-opt-${active}` : undefined;
  const describedBy = [error ? `${uid}-err` : null, helper ? `${uid}-help` : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={styles.field} ref={wrapRef}>
      <label htmlFor={inputId} className={hideLabel ? "visually-hidden" : styles.label}>
        {label}
      </label>
      <div className={`${styles.control} ${error ? styles.invalid : ""}`}>
        <input
          id={inputId}
          className={styles.input}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setTyped(true);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => close()}
          onKeyDown={onKeyDown}
        />
        {selected ? (
          <button
            type="button"
            className={styles.iconBtn}
            aria-label={`Clear ${label}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => commit(null)}
          >
            <X size={16} aria-hidden="true" />
          </button>
        ) : (
          <ChevronDown size={16} aria-hidden="true" className={styles.chevron} />
        )}
      </div>
      {open && (
        <ul id={listId} role="listbox" aria-label={label} className={styles.list} tabIndex={-1}>
          {visible.length === 0 && <li className={styles.none} role="presentation">No matches</li>}
          {visible.map((o, i) => (
            // Options are driven from the input (aria-activedescendant); mouse selection is a convenience.
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
            <li
              key={o.value}
              id={`${uid}-opt-${i}`}
              role="option"
              aria-selected={o.value === value}
              className={`${styles.option} ${i === active ? styles.active : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => commit(o)}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
      {helper && !error && <p id={`${uid}-help`} className={styles.helper}>{helper}</p>}
      {error && <p id={`${uid}-err`} className={styles.error} role="alert">{error}</p>}
    </div>
  );
}
