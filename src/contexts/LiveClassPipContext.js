import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const EMPTY_PIP_STATE = {
    active: false,
    visible: false,
    streamURL: null,
    label: '',
    placeholderText: '',
    sourceKind: '',
    fit: 'cover',
    mirror: false,
    routeParams: null,
};

const LiveClassPipContext = createContext({
    pipState: EMPTY_PIP_STATE,
    updateLiveClassPip: () => {},
    clearLiveClassPip: () => {},
});

const shallowEqual = (a, b) => {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every(key => a[key] === b[key]);
};

export const LiveClassPipProvider = ({ children }) => {
    const [pipState, setPipState] = useState(EMPTY_PIP_STATE);

    const updateLiveClassPip = useCallback((patch) => {
        setPipState(prev => {
            const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
            return shallowEqual(prev, next) ? prev : next;
        });
    }, []);

    const clearLiveClassPip = useCallback(() => {
        setPipState(EMPTY_PIP_STATE);
    }, []);

    const value = useMemo(() => ({
        pipState,
        updateLiveClassPip,
        clearLiveClassPip,
    }), [clearLiveClassPip, pipState, updateLiveClassPip]);

    return (
        <LiveClassPipContext.Provider value={value}>
            {children}
        </LiveClassPipContext.Provider>
    );
};

export const useLiveClassPip = () => useContext(LiveClassPipContext);
