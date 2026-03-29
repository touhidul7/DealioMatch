'use client';

import { useEffect, useState } from 'react';

const themes = {
  dark: {
    icon: '🌙',
    label: 'Dark Mode'
  },
  light: {
    icon: '☀️',
    label: 'Light Mode'
  }
};

export default function Header() {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const stored = window.localStorage.getItem('dealio-theme');
    const initial = stored === 'light' || stored === 'dark' ? stored : 'dark';
    applyTheme(initial);
  }, []);

  function applyTheme(value) {
    setTheme(value);
    document.documentElement.dataset.theme = value;
    document.documentElement.classList.remove('theme-dark', 'theme-light');
    document.documentElement.classList.add(`theme-${value}`);
    window.localStorage.setItem('dealio-theme', value);
  }

  function toggleTheme() {
    applyTheme(theme === 'dark' ? 'light' : 'dark');
  }

  return (
    <header className="page-header">
      <div className="page-header-left">
        <div className="logo">Dealio</div>
        <p className="tagline">Smart buyer-listing matching</p>
      </div>

      <div className="header-actions">
        <button className="button secondary" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  );
}
