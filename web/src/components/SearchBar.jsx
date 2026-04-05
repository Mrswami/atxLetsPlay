import { useState } from 'react';
import './SearchBar.css';

export default function SearchBar({ onSearch }) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (onSearch && query.trim()) onSearch(query.trim());
  }

  return (
    <form className={`search-bar ${focused ? 'focused' : ''}`} onSubmit={handleSubmit}>
      <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        id="search-input"
        type="text"
        placeholder="Search Friend or Court"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete="off"
      />
      {query && (
        <button
          type="button"
          className="search-clear"
          onClick={() => setQuery('')}
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </form>
  );
}
