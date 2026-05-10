import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import { themes } from './index';

const ThemeContext = createContext({
    scheme: 'light',
    colors: themes.light,
    setScheme: () => {},
    toggle: () => {},
    isDark: false,
});

export const ThemeProvider = ({ children }) => {
    const [scheme, setScheme] = useState(() => Appearance.getColorScheme() || 'light');
    const [userOverride, setUserOverride] = useState(false);

    useEffect(() => {
        if (userOverride) return;
        const sub = Appearance.addChangeListener(({ colorScheme }) => {
            setScheme(colorScheme || 'light');
        });
        return () => sub.remove();
    }, [userOverride]);

    const value = useMemo(() => ({
        scheme,
        colors: themes[scheme] || themes.light,
        isDark: scheme === 'dark',
        setScheme: (next) => { setUserOverride(true); setScheme(next); },
        toggle: () => { setUserOverride(true); setScheme(s => (s === 'dark' ? 'light' : 'dark')); },
    }), [scheme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
