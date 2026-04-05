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
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// ─── HELPER: HANDLE GENERATOR ───
const generateHandle = (name) => {
  const cleanName = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const suffix = Math.floor(100 + Math.random() * 900); // 3-digit random for uniqueness
  return `@${cleanName}_${suffix}`;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // ─── MAGIC LINK LOGIC ───
  const actionCodeSettings = {
    url: window.location.origin,
    handleCodeInApp: true,
  };

  async function sendMagicLink(email) {
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
    window.localStorage.setItem('emailForSignIn', email);
  }

  async function completeMagicLinkSignIn() {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let email = window.localStorage.getItem('emailForSignIn');
      if (!email) {
        email = window.prompt('Please provide your email for verification');
      }
      const result = await signInWithEmailLink(auth, email, window.location.href);
      window.localStorage.removeItem('emailForSignIn');
      return result.user;
    }
    return null;
  }

  useEffect(() => {
    completeMagicLinkSignIn().catch((err) => {
      console.error('Magic link sign-in error:', err);
    });

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const profileRef = doc(db, 'users', firebaseUser.uid);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          setUserProfile(profileSnap.data());
        } else {
          // AUTO-GEN PROFILE (FOR GOOGLE / MAGIC LINK FIRST TIME)
          const name = firebaseUser.displayName || 'Player';
          const profileData = {
            uid: firebaseUser.uid,
            displayName: name,
            handle: generateHandle(name),
            role: 'player', // Default Role
            email: firebaseUser.email || '',
            avatarUrl: firebaseUser.photoURL || '',
            district: '',
            xp: 0,
            gamesPlayed: 0,
            createdAt: serverTimestamp(),
          };
          await setDoc(profileRef, profileData);
          setUserProfile(profileData);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function signup(email, password, displayName) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    
    // Create Profile with Auto-Gen Handle
    const profileData = {
      uid: cred.user.uid,
      displayName,
      handle: generateHandle(displayName),
      role: 'player', // Default Role
      email,
      avatarUrl: '',
      district: '',
      xp: 0,
      gamesPlayed: 0,
      createdAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'users', cred.user.uid), profileData);
    setUserProfile(profileData);
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
      const name = cred.user.displayName || 'Player';
      const profileData = {
        uid: cred.user.uid,
        displayName: name,
        handle: generateHandle(name),
        role: 'player',
        email: cred.user.email || '',
        avatarUrl: cred.user.photoURL || '',
        district: '',
        xp: 0,
        gamesPlayed: 0,
        createdAt: serverTimestamp(),
      };
      await setDoc(profileRef, profileData);
      setUserProfile(profileData);
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
