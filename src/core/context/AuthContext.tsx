/**
 * Auth Context
 *
 * Manages authentication state for the app.
 * Integrates with InsForge backend for auth operations.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API base URL - configurable via env
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:7131';

// Storage keys
const TOKEN_KEY = '@kas_auth_token';
const REFRESH_TOKEN_KEY = '@kas_refresh_token';
const USER_KEY = '@kas_user';

export interface User {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
}

const defaultState: AuthContextValue = {
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  signIn: async () => ({ success: false, error: 'Not initialized' }),
  signUp: async () => ({ success: false, error: 'Not initialized' }),
  signOut: async () => {},
  refreshAuth: async () => false,
};

export const AuthContext = createContext<AuthContextValue>(defaultState);

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Load stored auth on mount
  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const [token, userJson] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY),
      ]);

      if (token && userJson) {
        const user = JSON.parse(userJson) as User;
        setState({
          user,
          token,
          isLoading: false,
          isAuthenticated: true,
        });
      } else {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('[AuthContext] Failed to load stored auth:', error);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const saveAuth = async (token: string, refreshToken: string, user: User) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(TOKEN_KEY, token),
        AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken),
        AsyncStorage.setItem(USER_KEY, JSON.stringify(user)),
      ]);
    } catch (error) {
      console.error('[AuthContext] Failed to save auth:', error);
    }
  };

  const clearAuth = async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(TOKEN_KEY),
        AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
        AsyncStorage.removeItem(USER_KEY),
      ]);
    } catch (error) {
      console.error('[AuthContext] Failed to clear auth:', error);
    }
  };

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Invalid credentials' };
      }

      const { token, refresh_token, user } = data;
      await saveAuth(token, refresh_token, user);

      setState({
        user,
        token,
        isLoading: false,
        isAuthenticated: true,
      });

      return { success: true };
    } catch (error: any) {
      console.error('[AuthContext] Sign in error:', error);
      return { success: false, error: error.message || 'Network error' };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Registration failed' };
      }

      const { token, refresh_token, user } = data;
      await saveAuth(token, refresh_token, user);

      setState({
        user,
        token,
        isLoading: false,
        isAuthenticated: true,
      });

      return { success: true };
    } catch (error: any) {
      console.error('[AuthContext] Sign up error:', error);
      return { success: false, error: error.message || 'Network error' };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      // Call logout endpoint (optional, for server-side cleanup)
      if (state.token) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${state.token}` },
        }).catch(() => {}); // Ignore errors
      }
    } finally {
      await clearAuth();
      setState({
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }, [state.token]);

  const refreshAuth = useCallback(async () => {
    try {
      const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) return false;

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        await clearAuth();
        setState({
          user: null,
          token: null,
          isLoading: false,
          isAuthenticated: false,
        });
        return false;
      }

      const data = await response.json();
      await saveAuth(data.token, data.refresh_token, data.user);

      setState({
        user: data.user,
        token: data.token,
        isLoading: false,
        isAuthenticated: true,
      });

      return true;
    } catch (error) {
      console.error('[AuthContext] Refresh error:', error);
      return false;
    }
  }, []);

  const value: AuthContextValue = {
    ...state,
    signIn,
    signUp,
    signOut,
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
