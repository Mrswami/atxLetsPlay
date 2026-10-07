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
  signInAnonymously,
  updatePassword,
  deleteUser,
  linkWithCredential,
  linkWithPopup,
  EmailAuthProvider,
} from 'firebase/auth';
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp, onSnapshot, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { sendVerification, refreshVerification } from '../services/safety';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [isGuest, setIsGuest] = useState(() => localStorage.getItem('atx_is_guest') === 'true');
  const [loading, setLoading] = useState(true);
  const [emailVerified, setEmailVerified] = useState(false);

  async function resendVerification() {
    await sendVerification();
  }

  // Reload the Firebase user + ID token so Firestore rules pick up email_verified.
  async function checkEmailVerified() {
    const ok = await refreshVerification();
    setEmailVerified(ok);
    return ok;
  }

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
  // ────────────────────────

  function createLocalGuest() {
    let savedProfile = null;
    try {
      const raw = localStorage.getItem('atx_guest_profile');
      if (raw) savedProfile = JSON.parse(raw);
    } catch (_) {}

    const localGuest = {
      uid: savedProfile?.uid || 'guest-' + (localStorage.getItem('atx_guest_id') || Math.random().toString(36).substring(2, 9)),
      displayName: savedProfile?.displayName || 'Austin Guest',
      isAnonymous: true,
      email: null,
      photoURL: savedProfile?.avatarUrl || null,
    };
    localStorage.setItem('atx_guest_id', localGuest.uid);
    localStorage.setItem('atx_is_guest', 'true');
    setUser(localGuest);
    setUserProfile({
      uid: localGuest.uid,
      displayName: 'Austin Guest',
      email: '',
      avatarUrl: '',
      district: 'downtown',
      xp: 150,
      gamesPlayed: 0,
      hasCompletedOnboarding: true,
      isGuest: true,
      ...savedProfile,
    });
    setIsGuest(true);
    setLoading(false);
    return localGuest;
  }

  async function continueAsGuest() {
    try {
      const cred = await signInAnonymously(auth);
      localStorage.setItem('atx_is_guest', 'true');
      setIsGuest(true);
      let savedProfile = null;
      try {
        const raw = localStorage.getItem('atx_guest_profile');
        if (raw) savedProfile = JSON.parse(raw);
      } catch (_) {}
      const guestProfile = {
        uid: cred.user.uid,
        displayName: 'Austin Guest',
        email: '',
        avatarUrl: '',
        district: 'downtown',
        xp: 150,
        gamesPlayed: 0,
        hasCompletedOnboarding: true,
        isGuest: true,
        ...savedProfile,
      };
      setUserProfile(guestProfile);
      return cred.user;
    } catch (err) {
      console.warn('Firebase anonymous auth unavailable or offline, using local guest session:', err);
      return createLocalGuest();
    }
  }

  useEffect(() => {
    completeMagicLinkSignIn().catch((err) => {
      console.error('Magic link sign-in error:', err);
    });

    let unsubProfile = null;

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setIsGuest(firebaseUser.isAnonymous);
        setEmailVerified(!firebaseUser.isAnonymous && !!firebaseUser.emailVerified);
        const profileRef = doc(db, 'users', firebaseUser.uid);
        
        unsubProfile = onSnapshot(profileRef, async (snap) => {
          if (snap.exists()) {
            setUserProfile(snap.data());
            setLoading(false);
          } else {
            const profileData = {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || (firebaseUser.isAnonymous ? 'Austin Guest' : 'Player'),
              email: firebaseUser.email || '',
              avatarUrl: firebaseUser.photoURL || '',
              district: '',
              xp: firebaseUser.isAnonymous ? 100 : 0,
              gamesPlayed: 0,
              hasCompletedOnboarding: false,
              createdAt: serverTimestamp(),
            };
            try {
              await setDoc(profileRef, profileData);
            } catch (_) {
              setUserProfile(profileData);
            }
            setLoading(false);
          }
        }, () => {
          // In case snapshot fails (offline / permission rules)
          setUserProfile({
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || 'Player',
            email: firebaseUser.email || '',
            avatarUrl: firebaseUser.photoURL || '',
            district: '',
            xp: 100,
            gamesPlayed: 0,
            hasCompletedOnboarding: true,
          });
          setLoading(false);
        });
      } else {
        if (localStorage.getItem('atx_is_guest') === 'true') {
          createLocalGuest();
        } else {
          setUser(null);
          setUserProfile(null);
          setIsGuest(false);
          setLoading(false);
        }
        if (unsubProfile) {
          unsubProfile();
          unsubProfile = null;
        }
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
    localStorage.removeItem('atx_is_guest');
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    await setDoc(doc(db, 'users', cred.user.uid), {
      displayName,
      email,
      avatarUrl: '',
      district: '',
      xp: 0,
      gamesPlayed: 0,
      hasCompletedOnboarding: false,
      createdAt: serverTimestamp(),
    });
    sendVerification().catch((e) => console.warn('Verification email not sent:', e));
    setIsGuest(false);
    return cred.user;
  }

  async function login(email, password) {
    localStorage.removeItem('atx_is_guest');
    setIsGuest(false);
    return signInWithEmailAndPassword(auth, email, password);
  }

  async function loginWithGoogle() {
    const isUpgradingGuest = user && isGuest;
    const oldProfile = userProfile ? { ...userProfile } : null;

    const provider = new GoogleAuthProvider();
    let cred;

    try {
      if (isUpgradingGuest && auth.currentUser) {
        try {
          cred = await linkWithPopup(auth.currentUser, provider);
        } catch (linkErr) {
          if (linkErr.code === 'auth/credential-already-in-use') {
            // Google account exists, just sign in
            cred = await signInWithPopup(auth, provider);
          } else {
            throw linkErr;
          }
        }
      } else {
        cred = await signInWithPopup(auth, provider);
      }
    } catch (err) {
      throw err;
    }

    localStorage.removeItem('atx_is_guest');
    setIsGuest(false);

    const profileRef = doc(db, 'users', cred.user.uid);
    const profileSnap = await getDoc(profileRef);
    if (!profileSnap.exists()) {
      // Retain guest info if available
      await setDoc(profileRef, {
        displayName: cred.user.displayName || oldProfile?.displayName || '',
        email: cred.user.email || '',
        avatarUrl: cred.user.photoURL || oldProfile?.avatarUrl || '',
        district: oldProfile?.district || '',
        xp: oldProfile?.xp || 0,
        gamesPlayed: oldProfile?.gamesPlayed || 0,
        hasCompletedOnboarding: false,
        createdAt: serverTimestamp(),
      });
    } else if (isUpgradingGuest && oldProfile && profileSnap.exists()) {
      // If logging into an existing account, we could merge XP, but safely just ensure we aren't overwriting
      await setDoc(profileRef, {
        xp: Math.max(oldProfile.xp || 0, profileSnap.data().xp || 0),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
    
    return cred.user;
  }

  async function updateUsername(newUsername) {
    if (!user || isGuest || !auth.currentUser) {
      throw new Error("Must be logged in to set a username.");
    }
    const currentUsername = userProfile?.username;
    if (newUsername === currentUsername) return; // No change

    try {
      const batch = writeBatch(db);
      
      // 1. Create new username document
      const newUsernameRef = doc(db, 'usernames', newUsername);
      // We must check if it exists first because our rules might not prevent overwriting if we somehow bypassed it, 
      // but actually create rules prevent overwriting an existing doc if it belongs to someone else.
      batch.set(newUsernameRef, { uid: user.uid });

      // 2. Delete old username document if exists
      if (currentUsername) {
        const oldUsernameRef = doc(db, 'usernames', currentUsername);
        batch.delete(oldUsernameRef);
      }

      // 3. Update user profile
      const profileRef = doc(db, 'users', user.uid);
      batch.update(profileRef, {
        username: newUsername,
        lastUsernameChange: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await batch.commit();

      // Update local state
      setUserProfile((prev) => ({ 
        ...(prev || {}), 
        username: newUsername,
        // We'll approximate the timestamp locally to avoid needing to re-fetch immediately
        lastUsernameChange: { toMillis: () => Date.now() } 
      }));
    } catch (err) {
      console.error("Failed to update username:", err);
      if (err.code === 'permission-denied') {
        throw new Error("Username is taken, or you changed it too recently (14-day limit).");
      }
      throw err;
    }
  }

  async function updateUserProfile(updates) {
    // Optimistic local state update
    setUserProfile((prev) => ({ ...(prev || {}), ...updates }));

    if (user && !isGuest && auth.currentUser) {
      try {
        if (updates.displayName !== undefined || updates.avatarUrl !== undefined) {
          const authUpdates = {};
          if (updates.displayName !== undefined) authUpdates.displayName = updates.displayName;
          if (updates.avatarUrl !== undefined) authUpdates.photoURL = updates.avatarUrl;
          await updateProfile(auth.currentUser, authUpdates).catch((e) => console.warn('Auth updateProfile notice:', e));
        }

        const profileRef = doc(db, 'users', user.uid);
        await setDoc(profileRef, {
          ...updates,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (err) {
        console.warn('Firestore profile update failed, using local session state:', err);
      }
    } else {
      // For guest users, persist to localStorage so settings are preserved across reloads
      try {
        const stored = localStorage.getItem('atx_guest_profile');
        const parsed = stored ? JSON.parse(stored) : {};
        localStorage.setItem('atx_guest_profile', JSON.stringify({ ...parsed, ...updates }));
      } catch (e) {
        console.warn('Local storage write notice:', e);
      }
    }
  }

  async function changePassword(newPassword) {
    if (!auth.currentUser) throw new Error('No authenticated user session found.');
    return updatePassword(auth.currentUser, newPassword);
  }

  async function deleteUserAccount() {
    const currentUid = user?.uid;
    localStorage.removeItem('atx_is_guest');
    localStorage.removeItem('atx_guest_id');
    localStorage.removeItem('atx_guest_profile');

    if (currentUid && db) {
      try {
        await deleteDoc(doc(db, 'users', currentUid));
      } catch (e) {
        console.warn('Could not delete firestore user document:', e);
      }
    }

    if (auth.currentUser) {
      try {
        await deleteUser(auth.currentUser);
      } catch (e) {
        console.warn('Could not delete auth user account directly, signing out instead:', e);
        await signOut(auth);
      }
    }

    setUser(null);
    setUserProfile(null);
    setIsGuest(false);
  }

  async function linkGuestAccount(email, password, displayName) {
    if (!auth.currentUser || !auth.currentUser.isAnonymous) {
      return signup(email, password, displayName);
    }
    const credential = EmailAuthProvider.credential(email, password);
    const res = await linkWithCredential(auth.currentUser, credential);
    if (displayName) {
      await updateProfile(res.user, { displayName });
    }
    localStorage.removeItem('atx_is_guest');
    setIsGuest(false);
    await setDoc(doc(db, 'users', res.user.uid), {
      email,
      displayName: displayName || userProfile?.displayName || 'Player',
      isGuest: false,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return res.user;
  }

  async function logout() {
    localStorage.removeItem('atx_is_guest');
    localStorage.removeItem('atx_guest_id');
    localStorage.removeItem('atx_guest_profile');
    setIsGuest(false);
    setUser(null);
    setUserProfile(null);
    return signOut(auth);
  }

  const value = {
    user,
    userProfile,
    isGuest,
    loading,
    emailVerified,
    resendVerification,
    checkEmailVerified,
    signup,
    login,
    loginWithGoogle,
    sendMagicLink,
    continueAsGuest,
    updateUserProfile,
    updateUsername,
    changePassword,
    deleteUserAccount,
    linkGuestAccount,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
