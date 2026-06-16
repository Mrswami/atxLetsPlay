import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // ─── MAGIC LINK LOGIC ───
  const actionCodeSettings = {
    // The link user is redirected to when they click the email.
    url: window.location.origin,
    handleCodeInApp: true,
  };

  async function sendMagicLink(email) {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    // Save email locally to avoid asking the user again on the same device
    window.localStorage.setItem('emailForSignIn', email);
  }

  async function completeMagicLinkSignIn() {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let email = window.localStorage.getItem('emailForSignIn');
      if (!email) {
        // Different device/browser? Ask for email
        email = window.prompt('Please provide your email for verification');
      }
      const result = await signInWithEmailLink(auth, email, window.location.href);
      window.localStorage.removeItem('emailForSignIn');
      return result.user;
    }
    return null;
  }
  // ────────────────────────

  useEffect(() => {
    // Check for magic link return on app load
    completeMagicLinkSignIn().catch((err) => {
      console.error('Magic link sign-in error:', err);
    });

    let unsubProfile = null;

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const profileRef = doc(db, 'users', firebaseUser.uid);
        
        unsubProfile = onSnapshot(profileRef, async (snap) => {
          if (snap.exists()) {
            setUserProfile(snap.data());
            setLoading(false);
          } else {
            const profileData = {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || 'Player',
              email: firebaseUser.email || '',
              avatarUrl: firebaseUser.photoURL || '',
              district: '',
              xp: 0,
              gamesPlayed: 0,
              createdAt: serverTimestamp(),
            };
            await setDoc(profileRef, profileData);
          }
        });
      } else {
        setUserProfile(null);
        if (unsubProfile) {
          unsubProfile();
          unsubProfile = null;
        }
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubProfile) {
        unsubProfile();
      }
    };
  }, []);

  async function signup(email, password, displayName) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    await setDoc(doc(db, 'users', cred.user.uid), {
      displayName,
      email,
      avatarUrl: '',
      district: '',
      xp: 0,
      gamesPlayed: 0,
      createdAt: serverTimestamp(),
    });
    return cred.user;
  }

  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const profileRef = doc(db, 'users', cred.user.uid);
    const profileSnap = await getDoc(profileRef);
    if (!profileSnap.exists()) {
      await setDoc(profileRef, {
        displayName: cred.user.displayName || '',
        email: cred.user.email || '',
        avatarUrl: cred.user.photoURL || '',
        district: '',
        xp: 0,
        gamesPlayed: 0,
        createdAt: serverTimestamp(),
      });
    }
    return cred.user;
  }

  async function logout() {
    return signOut(auth);
  }

  const value = {
    user,
    userProfile,
    loading,
    signup,
    login,
    loginWithGoogle,
    sendMagicLink,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
