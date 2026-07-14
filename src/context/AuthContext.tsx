'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Profile, getProfiles, signIn, signUp, isSupabaseConfigured } from '@/lib/db';

interface AuthContextType {
  currentUser: Profile | null;
  loading: boolean;
  isDemoMode: boolean;
  handleSignIn: (email: string, password: string) => Promise<Profile>;
  handleSignUp: (email: string, name: string, password: string) => Promise<Profile>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(true);

  useEffect(() => {
    setIsDemoMode(!isSupabaseConfigured);
  }, []);

  const loadData = async () => {
    try {
      const storedId = localStorage.getItem('current_doc_user_id');
      if (storedId) {
        const profiles = await getProfiles();
        const activeUser = profiles.find(p => p.id === storedId) || null;
        if (activeUser) {
          setCurrentUser(activeUser);
        } else {
          localStorage.removeItem('current_doc_user_id');
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
    } catch (err) {
      console.error('Failed to load profile data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSignIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const profile = await signIn(email, password);
      setCurrentUser(profile);
      localStorage.setItem('current_doc_user_id', profile.id);
      return profile;
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (email: string, name: string, password: string) => {
    setLoading(true);
    try {
      const profile = await signUp(email, name, password);
      setCurrentUser(profile);
      localStorage.setItem('current_doc_user_id', profile.id);
      return profile;
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    setCurrentUser(null);
    localStorage.removeItem('current_doc_user_id');
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        isDemoMode,
        handleSignIn,
        handleSignUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
