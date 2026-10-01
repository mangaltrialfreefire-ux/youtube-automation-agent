// Firebase Client SDK initialization & Google Sign-In with Firestore Data Persistence
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyCZcatMPwn4S9Z15eYNum5bO-iZ_tIN3mA",
  authDomain: "subtitle-studio-vvmq7.firebaseapp.com",
  projectId: "subtitle-studio-vvmq7",
  storageBucket: "subtitle-studio-vvmq7.firebasestorage.app",
  messagingSenderId: "978232272261",
  appId: "1:978232272261:web:3aaeefe218688b9a3650ec"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

let currentUser = null;
let creationsUnsubscribe = null;

// Google Sign-In with Popup
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    await syncUserProfile(user);
    if (window.showToast) window.showToast(`Signed in as ${user.displayName || user.email}`);
    return user;
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    if (window.showToast) window.showToast(`Sign-in error: ${error.message}`);
    throw error;
  }
}

// Sign Out
export async function logOut() {
  try {
    await signOut(auth);
    if (window.showToast) window.showToast('Signed out successfully.');
  } catch (error) {
    console.error('Sign-Out Error:', error);
    throw error;
  }
}

// Sync user profile to Firestore
async function syncUserProfile(user) {
  if (!user) return;
  try {
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      uid: user.uid,
      displayName: user.displayName || 'Anonymous Creator',
      email: user.email,
      photoURL: user.photoURL || null,
      lastLogin: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.warn('Firestore user profile sync error:', err);
  }
}

// Save a creative asset generation (Veo 3, Grounding, Image, Music) to Firestore
export async function saveCreationToFirestore({ type, prompt, metadata = {}, resultUrl = null }) {
  if (!currentUser) return null;
  try {
    const creationsRef = collection(db, 'users', currentUser.uid, 'creations');
    const docRef = await addDoc(creationsRef, {
      type,
      prompt,
      metadata,
      resultUrl,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (err) {
    console.warn('Error saving creation to Firestore:', err);
    return null;
  }
}

// Listen to recent creations
function listenToCreations(user) {
  if (creationsUnsubscribe) creationsUnsubscribe();
  if (!user) return;

  const creationsRef = collection(db, 'users', user.uid, 'creations');
  const q = query(creationsRef, orderBy('createdAt', 'desc'), limit(10));

  creationsUnsubscribe = onSnapshot(q, (snapshot) => {
    const creations = [];
    snapshot.forEach(docSnap => {
      creations.push({ id: docSnap.id, ...docSnap.data() });
    });
    window.dispatchEvent(new CustomEvent('firebase:creations-updated', { detail: creations }));
  }, (err) => {
    console.warn('Creations snapshot error:', err);
  });
}

// Auth State Changed Observer
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  updateAuthUI(user);
  if (user) {
    await syncUserProfile(user);
    listenToCreations(user);
  } else if (creationsUnsubscribe) {
    creationsUnsubscribe();
    creationsUnsubscribe = null;
  }
  window.dispatchEvent(new CustomEvent('firebase:auth-changed', { detail: { user } }));
});

// Update Auth UI element in topbar
function updateAuthUI(user) {
  const container = document.getElementById('firebase-auth-bar');
  if (!container) return;

  if (user) {
    container.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; background: var(--surface-2); padding: 4px 8px; border-radius: 999px; border: 1px solid var(--line);">
        ${user.photoURL ? `<img src="${user.photoURL}" alt="" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">` : `<span style="width: 24px; height: 24px; border-radius: 50%; background: var(--blue); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700;">${(user.displayName || user.email || 'U')[0].toUpperCase()}</span>`}
        <span style="font-size: 12px; font-weight: 500; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${user.displayName || user.email}</span>
        <button id="firebase-signout-btn" class="button ghost" style="padding: 2px 6px; font-size: 11px; height: auto;" title="Sign out">Logout</button>
      </div>
    `;
    const signoutBtn = document.getElementById('firebase-signout-btn');
    if (signoutBtn) signoutBtn.addEventListener('click', logOut);
  } else {
    container.innerHTML = `
      <button id="firebase-signin-btn" class="button secondary" style="display: flex; align-items: center; gap: 6px; font-size: 12px; padding: 6px 12px;">
        <svg viewBox="0 0 24 24" width="14" height="14"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
        Sign in with Google
      </button>
    `;
    const signinBtn = document.getElementById('firebase-signin-btn');
    if (signinBtn) signinBtn.addEventListener('click', signInWithGoogle);
  }
}

// Attach to window for global access
window.FirebaseApp = {
  app,
  auth,
  db,
  getCurrentUser: () => currentUser,
  signInWithGoogle,
  logOut,
  saveCreationToFirestore
};
