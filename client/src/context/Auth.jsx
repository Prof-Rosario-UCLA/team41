import React, { createContext, useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  // TODO: Use these for anon login?
  signInAnonymously,
  signInWithCustomToken
} from 'firebase/auth';

export const AuthContext = createContext();

const firebaseConfig = {
  apiKey: "AIzaSyCPG8NSqxQZEg_68ox8VvoKYqurauGOVSg",
  authDomain: "cs144-25s-rpschoen34.firebaseapp.com",
  projectId: "cs144-25s-rpschoen34",
  storageBucket: "cs144-25s-rpschoen34.firebasestorage.app",
  messagingSenderId: "88620223097",
  appId: "1:88620223097:web:a1684e28117c9d1e7b22a8",
  measurementId: "G-D33WLSSKYB"
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [auth, setAuth] = useState(null);

  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      const authInstance = getAuth(app);
      setAuth(authInstance);

      const unsubscribe = onAuthStateChanged(authInstance, (user) => {
        setCurrentUser(user);
        setLoading(false);
      });

      return unsubscribe; // Cleanup subscription on unmount
    } catch (e) {
      console.error("Firebase initialization failed:", e);
      setError("Failed to initialize authentication service.");
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setLoading(false);
      return true;
    } catch (e) {
      console.error("Login error:", e);
      setError(e.message);
      setLoading(false);
      return false;
    }
  };

  const signup = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      setLoading(false);
      return true;
    } catch (e) {
      console.error("Signup error:", e);
      setError(e.message);
      setLoading(false);
      return false;
    }
  };

  const logout = async () => {
    setLoading(true);
    setError(null);
    try {
      await signOut(auth);
      setLoading(false);
      return true;
    } catch (e) {
      console.error("Logout error:", e);
      setError(e.message);
      setLoading(false);
      return false;
    }
  };

  const value = useMemo(() => ({
    currentUser,
    isAuthenticated: !!currentUser,
    loading,
    error,
    login,
    signup,
    logout,
  }), [currentUser, loading, error, auth]);

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
