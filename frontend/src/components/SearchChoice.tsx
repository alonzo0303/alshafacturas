import { useEffect, useId, useRef, useState } from "react";
import { searchText } from "../lib/search";
type Props = {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  allowCustom?: boolean;
  emptyLabel?: string;
  required?: boolean;
};
export default function SearchChoice({
  id,
  name,
  value,
  onChange,
  options,
  allowCustom = false,
  emptyLabel = "Todos los rubros",
  required = false,
}: Props) {
  const generated = useId(),
    listId = generated + "-list",
    input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState<string | null>(null),
    [active, setActive] = useState(-1);
  const choices = [...new Set(options.filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((v) => ({ value: v, label: v }));
  if (!allowCustom) choices.unshift({ value: "", label: emptyLabel });
  const matches = choices.filter((c) =>
    searchText(c.label).includes(searchText(draft || "")),
  );
  useEffect(() => {
    if (open && active >= 0)
      document
        .getElementById(`${listId}-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);
  function choose(next: string) {
    onChange(next);
    setDraft(null);
    setOpen(false);
    setActive(-1);
  }
  function finish() {
    if (allowCustom) {
      const text = (draft ?? value).trim();
      choose(
        choices.find((c) => c.value === text)?.value ??
          choices.find((c) => searchText(c.value) === searchText(text))
            ?.value ??
          text,
      );
    } else {
      setDraft(null);
      setOpen(false);
      setActive(-1);
    }
  }
  return (
    <div className="search-choice">
      <div className="choice-control">
        <input
          ref={input}
          id={id || generated}
          name={name}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={
            open && active >= 0 && matches[active]
              ? `${listId}-${active}`
              : undefined
          }
          autoComplete="off"
          placeholder="Escribe para buscar un rubro"
          maxLength={allowCustom ? 100 : undefined}
          required={required}
          value={draft ?? (value || (allowCustom ? "" : emptyLabel))}
          onFocus={() => {
            if (!allowCustom) setDraft("");
            setOpen(true);
            setActive(-1);
          }}
          onClick={() => {
            if (!open) {
              setDraft(allowCustom ? null : "");
              setOpen(true);
              setActive(-1);
            }
          }}
          onBlur={finish}
          onChange={(e) => {
            setDraft(e.target.value);
            setOpen(true);
            setActive(-1);
            if (allowCustom) onChange(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
              setActive((i) =>
                matches.length
                  ? e.key === "ArrowDown"
                    ? Math.min(i + 1, matches.length - 1)
                    : i < 0
                      ? matches.length - 1
                      : Math.max(i - 1, 0)
                  : -1,
              );
            } else if (e.key === "Enter" && open) {
              e.preventDefault();
              if (active >= 0 && matches[active]) choose(matches[active].value);
              else if (allowCustom) finish();
              else if (matches.length === 1) choose(matches[0].value);
            } else if (e.key === "Escape" && open) {
              e.preventDefault();
              e.stopPropagation();
              setDraft(null);
              setOpen(false);
              setActive(-1);
            }
          }}
        />
        <button
          className="choice-toggle"
          type="button"
          tabIndex={-1}
          aria-label="Mostrar opciones de rubro"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (open) {
              finish();
            } else {
              input.current?.focus();
              setDraft(null);
              setOpen(true);
            }
          }}
        >
          ⌄
        </button>
      </div>
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label="Rubros disponibles"
          className="choice-options"
        >
          {matches.length ? (
            matches.map((c, i) => (
              <button
                id={`${listId}-${i}`}
                key={c.value}
                type="button"
                role="option"
                aria-selected={c.value === value}
                tabIndex={-1}
                className={active === i ? "choice-active" : ""}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(c.value)}
              >
                {c.label}
              </button>
            ))
          ) : (
            <p role="status">
              {allowCustom
                ? "Sin coincidencias. Puedes guardar este rubro nuevo."
                : "No se encontraron rubros."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
