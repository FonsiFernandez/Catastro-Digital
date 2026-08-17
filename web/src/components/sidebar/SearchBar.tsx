"use client";

import type { FormEvent } from "react";
import { SearchIcon } from "@/components/ui/Icons";

export function SearchBar({
  value,
  onChange,
  onSubmit,
  isSearching,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isSearching: boolean;
}) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className="search-box" onSubmit={submit}>
      <SearchIcon className="search-icon" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Referencia catastral"
        aria-label="Referencia catastral"
        autoComplete="off"
        spellCheck={false}
      />
      <button className="primary-button" type="submit" disabled={!value.trim() || isSearching}>
        {isSearching ? "Buscando…" : "Añadir"}
      </button>
    </form>
  );
}
