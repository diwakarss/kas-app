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

// API base URL - configurable via env (InsForge backend)
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:7130';

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
      const response = await fetch(`${API_BASE_URL}/api/auth/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.message || data.error || 'Invalid credentials' };
      }

      // InsForge returns accessToken (not token) and no refresh_token
      const { accessToken, user } = data;
      await saveAuth(accessToken, '', user);

      setState({
        user,
        token: accessToken,
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
      const response = await fetch(`${API_BASE_URL}/api/auth/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.message || data.error || 'Registration failed' };
      }

      // InsForge returns accessToken (not token) and no refresh_token
      const { accessToken, user } = data;
      await saveAuth(accessToken, '', user);

      setState({
        user,
        token: accessToken,
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
    // InsForge doesn't require server-side logout - just clear local state
    await clearAuth();
    setState({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
    });
  }, []);

  const refreshAuth = useCallback(async () => {
    // InsForge doesn't have refresh tokens - validate current token instead
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (!token) return false;

      // Check if token is still valid by calling current session endpoint
      const response = await fetch(`${API_BASE_URL}/api/auth/sessions/current`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        // Token expired or invalid - clear auth
        await clearAuth();
        setState({
          user: null,
          token: null,
          isLoading: false,
          isAuthenticated: false,
        });
        return false;
      }

      // Token is still valid
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
