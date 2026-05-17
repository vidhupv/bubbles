/**
 * Custom popover instrument picker — pill trigger with caret, downward menu.
 */
import { useEffect, useRef, useState } from "react";
import { INSTRUMENTS, type InstrumentId } from "../audio/instruments";
import { Icon } from "./Icon";

interface Props {
  value: InstrumentId;
  loading: boolean;
  disabled: boolean;
  onChange(id: InstrumentId): void;
}

export function InstrumentPicker({ value, loading, disabled, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const label = INSTRUMENTS.find((i) => i.id === value)?.label ?? value;

  return (
    <span className="picker" ref={ref}>
      <button
        type="button"
        className="picker__trigger"
        disabled={disabled || loading}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{label}</span>
        <Icon name="caret" size={12} />
      </button>
      {open && (
        <div className="picker__menu" role="listbox">
          {INSTRUMENTS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="option"
              aria-selected={opt.id === value}
              className={`picker__opt ${opt.id === value ? "picker__opt--active" : ""}`}
              onClick={() => {
                onChange(opt.id);
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
