'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { InputText } from './InputText';

export type SearchSelectOption = {
  value: string;
  label: string;
  subLabel?: string;
};

type Props = {
  value: string;
  onChange: (text: string) => void;
  options: SearchSelectOption[];
  onSelect: (option: SearchSelectOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: CSSProperties;
  /** Keep free-typed text even if it does not match an option */
  allowFreeText?: boolean;
  emptyHint?: string;
};

export function SearchSelect({
  value,
  onChange,
  options,
  onSelect,
  placeholder,
  disabled,
  style,
  allowFreeText = true,
  emptyHint = 'No matches',
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return options.slice(0, 40);
    return options
      .filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          (o.subLabel && o.subLabel.toLowerCase().includes(q)),
      )
      .slice(0, 40);
  }, [options, value]);

  useEffect(() => {
    setActiveIndex(0);
  }, [filtered.length, value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (opt: SearchSelectOption) => {
    onChange(opt.label);
    onSelect(opt);
    setOpen(false);
  };

  const pickFirstOrClose = () => {
    if (filtered.length > 0) {
      pick(filtered[Math.min(activeIndex, filtered.length - 1)]);
      return true;
    }
    if (!allowFreeText) {
      onChange('');
      onSelect(null);
    } else {
      onSelect(null);
    }
    setOpen(false);
    return false;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (open && filtered.length > 0) {
        if (e.key === 'Enter') e.preventDefault();
        pickFirstOrClose();
      }
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="search-select" ref={rootRef} style={style}>
      <InputText
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e.target.value);
          onSelect(null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        style={{ width: '100%' }}
      />
      {open ? (
        <ul id={listId} className="search-select-list" role="listbox">
          {filtered.length === 0 ? (
            <li className="search-select-empty muted">{emptyHint}</li>
          ) : (
            filtered.map((opt, i) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={i === activeIndex}
                className={
                  i === activeIndex
                    ? 'search-select-option active'
                    : 'search-select-option'
                }
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(opt);
                }}
              >
                <span>{opt.label}</span>
                {opt.subLabel ? (
                  <span className="muted search-select-sub">{opt.subLabel}</span>
                ) : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
