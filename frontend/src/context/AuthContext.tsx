import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface User {
    username: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, username: string) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        const storedToken = localStorage.getItem('auth_token');
        const storedUsername = localStorage.getItem('auth_username');
        if (storedToken && storedUsername) {
            setToken(storedToken);
            setUser({ username: storedUsername });
        }
    }, []);

    const login = (newToken: string, username: string) => {
        localStorage.setItem('auth_token', newToken);
        localStorage.setItem('auth_username', username);
        setToken(newToken);
        setUser({ username });
    };

    const logout = () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_username');
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
