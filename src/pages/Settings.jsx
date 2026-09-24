import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { SPORT_META, DISTRICT_META, AUSTIN_COURTS_DATA } from '../data/courtsMeta';
import './Settings.css';

// Curated Austin Sports Avatar Presets using SVG Data URIs
const PRESET_AVATARS = [
  { id: 'hoops', label: 'Baller', emoji: '🏀', color: '#f97316' },
  { id: 'tennis', label: 'Ace', emoji: '🎾', color: '#eab308' },
  { id: 'pickle', label: 'Dink Pro', emoji: '🏓', color: '#06b6d4' },
  { id: 'soccer', label: 'Striker', emoji: '⚽', color: '#22d366' },
  { id: 'spiker', label: 'Spiker', emoji: '🏐', color: '#8b5cf6' },
  { id: 'disc', label: 'Disc Ace', emoji: '🥏', color: '#10b981' },
  { id: 'batcity', label: 'Bat City', emoji: '🦇', color: '#6366f1' },
  { id: 'tacotruck', label: 'Taco & Run', emoji: '🌮', color: '#f59e0b' },
  { id: 'dynamo', label: 'Dynamo', emoji: '⚡', color: '#38bdf8' },
  { id: 'cowboy', label: 'Lone Star', emoji: '🤠', color: '#ec4899' },
  { id: 'champ', label: 'Champion', emoji: '🏆', color: '#eab308' },
  { id: 'fire', label: 'On Fire', emoji: '🔥', color: '#ef4444' },
];

function generateEmojiAvatarUri(emoji, bgColor = '#1a2236') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgColor}"/>
        <stop offset="100%" stop-color="#0a0e17"/>
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="48" fill="url(#grad)" stroke="rgba(255,255,255,0.15)" stroke-width="3"/>
    <text x="50" y="64" font-size="46" text-anchor="middle" font-family="sans-serif">${emoji}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const PLAY_STYLES = [
  { id: 'chill', label: 'Chill', emoji: '😌', desc: 'Casual pickups, relaxed social play' },
  { id: 'athletic', label: 'Athletic', emoji: '🏃‍♂️', desc: 'Cardio, conditioning, full-court hustle' },
  { id: 'competitive', label: 'Competitive', emoji: '🏆', desc: 'Playing to win, stats, serious matchups' },
  { id: 'curious', label: 'Curious', emoji: '🤔', desc: 'Trying new sports, learning rules & skills' },
];

const SKILL_LEVELS = [
  { id: 'casual', label: 'Casual / Rec', levelText: '1.0 - 2.5', icon: '🌱' },
  { id: 'intermediate', label: 'Intermediate', levelText: '3.0 - 3.5', icon: '⚡' },
  { id: 'advanced', label: 'Advanced', levelText: '4.0 - 4.5', icon: '🔥' },
  { id: 'competitor', label: 'Competitor / Semi-Pro', levelText: '5.0+', icon: '👑' },
];

export default function Settings() {
  const {
    user,
    userProfile,
    isGuest,
    updateUserProfile,
    changePassword,
    deleteUserAccount,
    linkGuestAccount,
    logout,
  } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'preferences' | 'notifications' | 'account'

  // Profile Form State
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [district, setDistrict] = useState('downtown');
  const [homeCourtId, setHomeCourtId] = useState('');
  const [playStyle, setPlayStyle] = useState('chill');
  const [skillLevel, setSkillLevel] = useState('intermediate');
  const [selectedSports, setSelectedSports] = useState(['basketball']);

  // Preferences State
  const [graphicsQuality, setGraphicsQuality] = useState(() => localStorage.getItem('atx_graphics_quality') || 'balanced');
  const [defaultView, setDefaultView] = useState(() => localStorage.getItem('atx_default_view') || 'world');
  const [sfxEnabled, setSfxEnabled] = useState(() => localStorage.getItem('atx_sfx_enabled') !== 'false');
  const [hapticsEnabled, setHapticsEnabled] = useState(() => localStorage.getItem('atx_haptics_enabled') !== 'false');
  const [unitSystem, setUnitSystem] = useState(() => localStorage.getItem('atx_unit_system') || 'mi');

  // Notifications & Privacy State
  const [pickupAlerts, setPickupAlerts] = useState(true);
  const [gameInvites, setGameInvites] = useState(true);
  const [onCourtStatus, setOnCourtStatus] = useState(true);
  const [publicProfile, setPublicProfile] = useState(true);

  // Avatar Studio UI State
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFlash, setCameraFlash] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Guest linking state
  const [linkEmail, setLinkEmail] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const [linkingAccount, setLinkingAccount] = useState(false);
  const [linkSuccess, setLinkSuccess] = useState(false);
  const [linkError, setLinkError] = useState('');

  // Password update state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordUpdating, setPasswordUpdating] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState({ text: '', type: '' });

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Saving / Toast state
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Baseline tracking for dirty detection
  const [initialState, setInitialState] = useState(null);

  // Sync initial state from user / userProfile
  useEffect(() => {
    const profile = userProfile || {};
    const dName = profile.displayName || user?.displayName || (isGuest ? 'Austin Guest' : 'Player');
    const uBio = profile.bio || '';
    const uAvatar = profile.avatarUrl || user?.photoURL || '';
    const uDistrict = profile.district || 'downtown';
    const uHomeCourt = profile.homeCourtId || '';
    const uPlayStyle = profile.playStyle || 'chill';
    const uSkill = profile.skillLevel || 'intermediate';
    const uSports = profile.sport_preferences || ['basketball'];

    const uPickup = profile.pickupAlerts !== undefined ? profile.pickupAlerts : true;
    const uInvites = profile.gameInvites !== undefined ? profile.gameInvites : true;
    const uOnCourt = profile.onCourtStatus !== undefined ? profile.onCourtStatus : true;
    const uPublic = profile.publicProfile !== undefined ? profile.publicProfile : true;

    setDisplayName(dName);
    setBio(uBio);
    setAvatarUrl(uAvatar);
    setDistrict(uDistrict);
    setHomeCourtId(uHomeCourt);
    setPlayStyle(uPlayStyle);
    setSkillLevel(uSkill);
    setSelectedSports(uSports);

    setPickupAlerts(uPickup);
    setGameInvites(uInvites);
    setOnCourtStatus(uOnCourt);
    setPublicProfile(uPublic);

    setInitialState({
      displayName: dName,
      bio: uBio,
      avatarUrl: uAvatar,
      district: uDistrict,
      homeCourtId: uHomeCourt,
      playStyle: uPlayStyle,
      skillLevel: uSkill,
      selectedSports: [...uSports],
      graphicsQuality,
      defaultView,
      sfxEnabled,
      hapticsEnabled,
      unitSystem,
      pickupAlerts: uPickup,
      gameInvites: uInvites,
      onCourtStatus: uOnCourt,
      publicProfile: uPublic,
    });
  }, [userProfile, user, isGuest]);

  // Determine if form has unsaved modifications
  const isDirty = useMemo(() => {
    if (!initialState) return false;
    const sportsMatch =
      selectedSports.length === initialState.selectedSports.length &&
      selectedSports.every((s) => initialState.selectedSports.includes(s));

    return (
      displayName !== initialState.displayName ||
      bio !== initialState.bio ||
      avatarUrl !== initialState.avatarUrl ||
      district !== initialState.district ||
      homeCourtId !== initialState.homeCourtId ||
      playStyle !== initialState.playStyle ||
      skillLevel !== initialState.skillLevel ||
      !sportsMatch ||
      graphicsQuality !== initialState.graphicsQuality ||
      defaultView !== initialState.defaultView ||
      sfxEnabled !== initialState.sfxEnabled ||
      hapticsEnabled !== initialState.hapticsEnabled ||
      unitSystem !== initialState.unitSystem ||
      pickupAlerts !== initialState.pickupAlerts ||
      gameInvites !== initialState.gameInvites ||
      onCourtStatus !== initialState.onCourtStatus ||
      publicProfile !== initialState.publicProfile
    );
  }, [
    initialState,
    displayName,
    bio,
    avatarUrl,
    district,
    homeCourtId,
    playStyle,
    skillLevel,
    selectedSports,
    graphicsQuality,
    defaultView,
    sfxEnabled,
    hapticsEnabled,
    unitSystem,
    pickupAlerts,
    gameInvites,
    onCourtStatus,
    publicProfile,
  ]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }

  async function startCamera() {
    setCameraError('');
    setShowPresetPicker(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 320, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 50);
    } catch (err) {
      console.warn('Camera access error:', err);
      setCameraError('Webcam not accessible. Try uploading a photo instead.');
      setCameraActive(false);
    }
  }

  function handleCameraSnap() {
    if (!videoRef.current) return;
    setCameraFlash(true);
    setTimeout(() => setCameraFlash(false), 250);

    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    // Mirror for natural selfie capture
    ctx.translate(300, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoRef.current, 0, 0, 300, 300);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setAvatarUrl(dataUrl);
    stopCamera();
    triggerToast('Profile photo captured!');
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      triggerToast('Please select a valid image file.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Compress & crop to square on canvas
        const canvas = document.createElement('canvas');
        const size = Math.min(img.width, img.height, 400);
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const startX = (img.width - size) / 2;
        const startY = (img.height - size) / 2;
        ctx.drawImage(img, startX, startY, size, size, 0, 0, size, size);
        const compressedUrl = canvas.toDataURL('image/jpeg', 0.85);
        setAvatarUrl(compressedUrl);
        triggerToast('Photo uploaded!');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  function handleSportToggle(sportKey) {
    if (selectedSports.includes(sportKey)) {
      if (selectedSports.length <= 1) {
        triggerToast('Please keep at least one favorite sport.', 'error');
        return;
      }
      setSelectedSports(selectedSports.filter((s) => s !== sportKey));
    } else {
      if (selectedSports.length >= 3) {
        triggerToast('You can select up to 3 priority sports.', 'info');
        return;
      }
      setSelectedSports([...selectedSports, sportKey]);
    }
  }

  function triggerToast(message, type = 'success') {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3200);
  }

  function handleResetChanges() {
    if (!initialState) return;
    setDisplayName(initialState.displayName);
    setBio(initialState.bio);
    setAvatarUrl(initialState.avatarUrl);
    setDistrict(initialState.district);
    setHomeCourtId(initialState.homeCourtId);
    setPlayStyle(initialState.playStyle);
    setSkillLevel(initialState.skillLevel);
    setSelectedSports([...initialState.selectedSports]);

    setGraphicsQuality(initialState.graphicsQuality);
    setDefaultView(initialState.defaultView);
    setSfxEnabled(initialState.sfxEnabled);
    setHapticsEnabled(initialState.hapticsEnabled);
    setUnitSystem(initialState.unitSystem);

    setPickupAlerts(initialState.pickupAlerts);
    setGameInvites(initialState.gameInvites);
    setOnCourtStatus(initialState.onCourtStatus);
    setPublicProfile(initialState.publicProfile);
    triggerToast('Changes discarded.', 'info');
  }

  async function handleSaveChanges() {
    if (!displayName.trim()) {
      triggerToast('Player Name cannot be blank.', 'error');
      return;
    }

    setSaving(true);
    try {
      // Save local preferences to localStorage
      localStorage.setItem('atx_graphics_quality', graphicsQuality);
      localStorage.setItem('atx_default_view', defaultView);
      localStorage.setItem('atx_sfx_enabled', sfxEnabled ? 'true' : 'false');
      localStorage.setItem('atx_haptics_enabled', hapticsEnabled ? 'true' : 'false');
      localStorage.setItem('atx_unit_system', unitSystem);

      // Save user profile to Auth/Firestore
      const updates = {
        displayName: displayName.trim(),
        bio: bio.trim(),
        avatarUrl,
        district,
        homeCourtId,
        playStyle,
        skillLevel,
        sport_preferences: selectedSports,
        pickupAlerts,
        gameInvites,
        onCourtStatus,
        publicProfile,
        graphicsQuality,
        defaultView,
      };

      await updateUserProfile(updates);

      // Update initial baseline
      setInitialState({
        ...updates,
        selectedSports: [...selectedSports],
        sfxEnabled,
        hapticsEnabled,
        unitSystem,
      });

      triggerToast('Settings updated successfully!');
    } catch (err) {
      console.error('Save settings error:', err);
      triggerToast('Failed to save settings: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleLinkAccount(e) {
    e.preventDefault();
    if (!linkEmail || !linkPassword) {
      setLinkError('Please provide both email and password.');
      return;
    }
    if (linkPassword.length < 6) {
      setLinkError('Password must be at least 6 characters.');
      return;
    }

    setLinkingAccount(true);
    setLinkError('');
    try {
      await linkGuestAccount(linkEmail, linkPassword, displayName);
      setLinkSuccess(true);
      triggerToast('Account successfully linked! Your XP is permanently saved.');
    } catch (err) {
      setLinkError(err.message || 'Failed to link account.');
    } finally {
      setLinkingAccount(false);
    }
  }

  async function handlePasswordUpdate(e) {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setPasswordMsg({ text: 'Password must be at least 6 characters.', type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: 'Passwords do not match.', type: 'error' });
      return;
    }

    setPasswordUpdating(true);
    setPasswordMsg({ text: '', type: '' });
    try {
      await changePassword(newPassword);
      setPasswordMsg({ text: 'Password updated successfully!', type: 'success' });
      setNewPassword('');
      setConfirmPassword('');
      triggerToast('Security credentials updated.');
    } catch (err) {
      setPasswordMsg({ text: err.message || 'Failed to update password.', type: 'error' });
    } finally {
      setPasswordUpdating(false);
    }
  }

  function handleExportData() {
    const exportData = {
      exportDate: new Date().toISOString(),
      appName: "ATX Let's Play",
      user: {
        uid: user?.uid,
        email: user?.email,
        isGuest,
      },
      profile: {
        displayName,
        bio,
        district,
        homeCourtId,
        playStyle,
        skillLevel,
        sport_preferences: selectedSports,
        xp: userProfile?.xp || 0,
        gamesPlayed: userProfile?.gamesPlayed || 0,
        gamesHosted: userProfile?.gamesHosted || 0,
        rep: userProfile?.rep || 5.0,
        badges: userProfile?.badges || ['pioneer'],
      },
      preferences: {
        graphicsQuality,
        defaultView,
        sfxEnabled,
        hapticsEnabled,
        unitSystem,
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atx-baller-data-${user?.uid || 'guest'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    triggerToast('Baller data exported!');
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText.trim().toLowerCase() !== 'delete') {
      triggerToast('Type "DELETE" to confirm account deletion.', 'error');
      return;
    }

    setDeleting(true);
    try {
      await deleteUserAccount();
      setShowDeleteModal(false);
      navigate('/login');
    } catch (err) {
      triggerToast('Account deletion notice: ' + err.message, 'error');
      setDeleting(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  // Filter courts by currently selected district for Home Court dropdown
  const courtsInDistrict = useMemo(() => {
    return AUSTIN_COURTS_DATA.filter((c) => c.district === district);
  }, [district]);

  // XP level calculation: 1000 XP per level
  const currentXp = userProfile?.xp || 0;
  const currentLevel = Math.floor(currentXp / 1000) + 1;

  // Selected home court object
  const currentHomeCourt = AUSTIN_COURTS_DATA.find((c) => c.id === homeCourtId);

  return (
    <div className="settings-page">
      {/* Toast Alert */}
      {toast && (
        <div className={`settings-toast toast-${toast.type} anim-fade-in`}>
          <span className="toast-icon">
            {toast.type === 'success' ? '✓' : toast.type === 'error' ? '⚠️' : 'ℹ️'}
          </span>
          <span className="toast-msg">{toast.message}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="settings-header">
        <button className="back-btn" onClick={() => navigate(-1)} aria-label="Go back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="settings-header-text">
          <h1>Account & Settings</h1>
          <p className="settings-header-sub">Manage your baller identity, preferences, and security</p>
        </div>
        <div className="settings-header-badge">
          <span className="sh-dot" />
          {isGuest ? 'Guest Session' : 'Synced'}
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="settings-tabs-nav" aria-label="Settings Categories">
        <button
          className={`settings-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <span className="tab-icon">👤</span>
          <span className="tab-label">Profile & Identity</span>
        </button>
        <button
          className={`settings-tab-btn ${activeTab === 'preferences' ? 'active' : ''}`}
          onClick={() => setActiveTab('preferences')}
        >
          <span className="tab-icon">⚙️</span>
          <span className="tab-label">Preferences</span>
        </button>
        <button
          className={`settings-tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          <span className="tab-icon">🔔</span>
          <span className="tab-label">Alerts & Privacy</span>
        </button>
        <button
          className={`settings-tab-btn ${activeTab === 'account' ? 'active' : ''}`}
          onClick={() => setActiveTab('account')}
        >
          <span className="tab-icon">🛡️</span>
          <span className="tab-label">Security & Data</span>
        </button>
      </nav>

      {/* ══════════════════════════════════════════
          TAB 1: PROFILE & BALLER IDENTITY
         ══════════════════════════════════════════ */}
      {activeTab === 'profile' && (
        <div className="settings-tab-content anim-fade-in">
          {/* AVATAR STUDIO */}
          <section className="settings-card avatar-studio-card">
            <div className="card-header">
              <h2 className="card-title">Avatar Studio</h2>
              <span className="card-badge">Live Customization</span>
            </div>

            <div className="avatar-studio-layout">
              {/* Avatar Preview */}
              <div className="avatar-preview-box">
                <div className="avatar-ring-glow">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Player Avatar" className="avatar-img-preview" />
                  ) : (
                    <div className="avatar-initials-preview">
                      {displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'ATX'}
                    </div>
                  )}
                  <span className="avatar-level-badge">Lv. {currentLevel}</span>
                </div>
                <div className="avatar-caption">
                  <span className="avatar-xp-tag">⚡ {currentXp.toLocaleString()} XP</span>
                </div>
              </div>

              {/* Avatar Actions */}
              <div className="avatar-actions-column">
                <div className="avatar-btn-row">
                  <button
                    type="button"
                    className="avatar-action-btn primary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <span>📁</span> Upload Photo
                  </button>
                  <button
                    type="button"
                    className="avatar-action-btn secondary"
                    onClick={startCamera}
                  >
                    <span>📷</span> Take Selfie
                  </button>
                  <button
                    type="button"
                    className={`avatar-action-btn secondary ${showPresetPicker ? 'active' : ''}`}
                    onClick={() => {
                      stopCamera();
                      setShowPresetPicker(!showPresetPicker);
                    }}
                  >
                    <span>🎨</span> ATX Presets
                  </button>
                  {avatarUrl && (
                    <button
                      type="button"
                      className="avatar-action-btn danger"
                      onClick={() => {
                        setAvatarUrl('');
                        triggerToast('Avatar reset to default initials.');
                      }}
                      title="Reset avatar to initials"
                    >
                      <span>✕</span> Remove
                    </button>
                  )}
                </div>

                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />

                <p className="avatar-hint">
                  Supports JPG, PNG, WEBP. Cropped and optimized automatically for fast 3D court rendering.
                </p>
              </div>
            </div>

            {/* Webcam Live Capture Viewfinder */}
            {cameraActive && (
              <div className="camera-viewfinder-overlay anim-scale-in">
                {cameraFlash && <div className="camera-flash-overlay" />}
                <div className="camera-viewfinder-inner">
                  <div className="camera-viewfinder-header">
                    <span>Live Camera</span>
                    <button type="button" className="close-mini-btn" onClick={stopCamera}>✕</button>
                  </div>
                  <video ref={videoRef} autoPlay playsInline muted className="camera-feed-video" />
                  <div className="camera-viewfinder-footer">
                    <button type="button" className="snap-btn" onClick={handleCameraSnap}>
                      <span className="snap-btn-ring" />
                    </button>
                    <span className="snap-label">Tap to capture</span>
                  </div>
                </div>
              </div>
            )}

            {cameraError && <div className="camera-error-banner">{cameraError}</div>}

            {/* Curated Presets Picker */}
            {showPresetPicker && (
              <div className="preset-picker-box anim-fade-in">
                <div className="preset-picker-header">
                  <span>Austin Sports & Mascot Avatars</span>
                  <button
                    type="button"
                    className="close-mini-btn"
                    onClick={() => setShowPresetPicker(false)}
                  >
                    ✕
                  </button>
                </div>
                <div className="preset-grid">
                  {PRESET_AVATARS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className="preset-avatar-btn"
                      onClick={() => {
                        const uri = generateEmojiAvatarUri(preset.emoji, preset.color);
                        setAvatarUrl(uri);
                        setShowPresetPicker(false);
                        triggerToast(`Applied ${preset.label} avatar!`);
                      }}
                    >
                      <span className="preset-emoji">{preset.emoji}</span>
                      <span className="preset-title">{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* PLAYER IDENTITY DETAILS */}
          <section className="settings-card">
            <div className="card-header">
              <h2 className="card-title">Baller Identity</h2>
              <span className="card-badge">Public Profile</span>
            </div>

            {/* Display Name */}
            <div className="form-group">
              <div className="label-row">
                <label htmlFor="displayName">Player Name / Gamertag</label>
                <span className="char-count">{displayName.length}/24</span>
              </div>
              <input
                id="displayName"
                type="text"
                className="custom-input"
                placeholder="e.g. Austin Dunker"
                value={displayName}
                maxLength={24}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <span className="field-hint">This name appears on the Austin 3D globe, court leaderboards, and pickup lobbies.</span>
            </div>

            {/* Bio / Court Motto */}
            <div className="form-group">
              <div className="label-row">
                <label htmlFor="playerBio">Court Motto / Bio</label>
                <span className="char-count">{bio.length}/140</span>
              </div>
              <textarea
                id="playerBio"
                className="custom-textarea"
                rows={2}
                placeholder="e.g. Early morning runs at Mueller 🏀 | Always down for 3v3"
                value={bio}
                maxLength={140}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>

            {/* Austin District & Home Court */}
            <div className="form-row-2col">
              <div className="form-group">
                <label htmlFor="districtSelect">Home District</label>
                <select
                  id="districtSelect"
                  className="custom-select"
                  value={district}
                  onChange={(e) => {
                    setDistrict(e.target.value);
                    // Reset home court if it belongs to another district
                    setHomeCourtId('');
                  }}
                >
                  {Object.keys(DISTRICT_META).map((key) => {
                    const d = DISTRICT_META[key];
                    return (
                      <option key={key} value={key}>
                        {d.label}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="homeCourtSelect">Primary Home Court</label>
                <select
                  id="homeCourtSelect"
                  className="custom-select"
                  value={homeCourtId}
                  onChange={(e) => setHomeCourtId(e.target.value)}
                >
                  <option value="">No primary court selected</option>
                  {courtsInDistrict.map((court) => (
                    <option key={court.id} value={court.id}>
                      {court.name}
                    </option>
                  ))}
                  {/* Also show all other courts grouped if desired */}
                  {courtsInDistrict.length === 0 &&
                    AUSTIN_COURTS_DATA.map((court) => (
                      <option key={court.id} value={court.id}>
                        {court.name} ({court.district})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Skill Level Selection */}
            <div className="form-group">
              <label>Skill Level</label>
              <div className="skill-levels-grid">
                {SKILL_LEVELS.map((lvl) => (
                  <button
                    key={lvl.id}
                    type="button"
                    className={`skill-level-card ${skillLevel === lvl.id ? 'active' : ''}`}
                    onClick={() => setSkillLevel(lvl.id)}
                  >
                    <span className="sl-icon">{lvl.icon}</span>
                    <span className="sl-title">{lvl.label}</span>
                    <span className="sl-rating">{lvl.levelText}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Play Style Archetype */}
            <div className="form-group">
              <label>Play Style Archetype</label>
              <div className="playstyle-chips-grid">
                {PLAY_STYLES.map((ps) => (
                  <button
                    key={ps.id}
                    type="button"
                    className={`playstyle-chip ${playStyle === ps.id ? 'active' : ''}`}
                    onClick={() => setPlayStyle(ps.id)}
                  >
                    <span className="psc-emoji">{ps.emoji}</span>
                    <div className="psc-info">
                      <span className="psc-title">{ps.label}</span>
                      <span className="psc-desc">{ps.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Top Sports Preferences */}
            <div className="form-group">
              <div className="label-row">
                <label>Top Sports ({selectedSports.length}/3)</label>
                <span className="field-hint">Used for personalized court recommendations</span>
              </div>
              <div className="sports-chips-cloud">
                {Object.keys(SPORT_META).map((sportKey) => {
                  const s = SPORT_META[sportKey];
                  const isSelected = selectedSports.includes(sportKey);
                  return (
                    <button
                      key={sportKey}
                      type="button"
                      className={`sport-chip ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSportToggle(sportKey)}
                    >
                      <span className="sc-emoji">{s.emoji}</span>
                      <span className="sc-label">{s.label}</span>
                      {isSelected && <span className="sc-check">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* LIVE BALLER CARD PREVIEW */}
          <section className="settings-card preview-card-section">
            <div className="card-header">
              <h2 className="card-title">Live Baller Card Preview</h2>
              <span className="card-badge preview-badge">Austin Player Pass</span>
            </div>

            <div className="live-baller-card">
              <div className="lbc-top">
                <div className="lbc-avatar-box">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="lbc-avatar-img" />
                  ) : (
                    <div className="lbc-avatar-fallback">
                      {displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'ATX'}
                    </div>
                  )}
                  <span className="lbc-lvl">Lv.{currentLevel}</span>
                </div>
                <div className="lbc-player-info">
                  <div className="lbc-name-row">
                    <h3 className="lbc-name">{displayName || 'Anonymous Baller'}</h3>
                    <span className="lbc-rep">5.0 ★</span>
                  </div>
                  <div className="lbc-district-row">
                    <span className="lbc-dot" style={{ backgroundColor: DISTRICT_META[district]?.color || '#22d366' }} />
                    <span>{DISTRICT_META[district]?.label || district}</span>
                    {currentHomeCourt && (
                      <span className="lbc-home-court">· 🏟️ {currentHomeCourt.shortName || currentHomeCourt.name}</span>
                    )}
                  </div>
                </div>
              </div>

              {bio && <p className="lbc-bio">"{bio}"</p>}

              <div className="lbc-meta-row">
                <div className="lbc-pill">
                  <span className="pill-tag">Archetype</span>
                  <span className="pill-val">
                    {PLAY_STYLES.find((p) => p.id === playStyle)?.emoji}{' '}
                    {PLAY_STYLES.find((p) => p.id === playStyle)?.label}
                  </span>
                </div>
                <div className="lbc-pill">
                  <span className="pill-tag">Skill</span>
                  <span className="pill-val">
                    {SKILL_LEVELS.find((s) => s.id === skillLevel)?.icon}{' '}
                    {SKILL_LEVELS.find((s) => s.id === skillLevel)?.label}
                  </span>
                </div>
                <div className="lbc-pill">
                  <span className="pill-tag">XP</span>
                  <span className="pill-val accent">⚡ {currentXp.toLocaleString()}</span>
                </div>
              </div>

              <div className="lbc-sports-row">
                {selectedSports.map((sk) => {
                  const meta = SPORT_META[sk];
                  return (
                    <span key={sk} className="lbc-sport-tag">
                      {meta?.emoji} {meta?.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ══════════════════════════════════════════
          TAB 2: APP & GAMEPLAY PREFERENCES
         ══════════════════════════════════════════ */}
      {activeTab === 'preferences' && (
        <div className="settings-tab-content anim-fade-in">
          <section className="settings-card">
            <div className="card-header">
              <h2 className="card-title">Graphics & 3D World Performance</h2>
              <span className="card-badge">Engine Settings</span>
            </div>

            <div className="setting-toggle-row">
              <div className="toggle-text">
                <span className="toggle-label">World 3D Graphics Quality</span>
                <span className="toggle-sub">Adjust shadow rendering, anti-aliasing, and mesh resolution for Austin 3D globe</span>
              </div>
              <div className="segmented-control">
                {[
                  { id: 'battery', label: 'Battery' },
                  { id: 'balanced', label: 'Balanced' },
                  { id: 'ultra', label: 'Ultra 3D' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    className={`seg-btn ${graphicsQuality === mode.id ? 'active' : ''}`}
                    onClick={() => setGraphicsQuality(mode.id)}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="setting-toggle-row">
              <div className="toggle-text">
                <span className="toggle-label">Default Launch View</span>
                <span className="toggle-sub">Choose which screen appears when you open ATX Let's Play</span>
              </div>
              <div className="segmented-control">
                <button
                  type="button"
                  className={`seg-btn ${defaultView === 'world' ? 'active' : ''}`}
                  onClick={() => setDefaultView('world')}
                >
                  🌍 3D World
                </button>
                <button
                  type="button"
                  className={`seg-btn ${defaultView === 'dashboard' ? 'active' : ''}`}
                  onClick={() => setDefaultView('dashboard')}
                >
                  📊 Quick Dashboard
                </button>
              </div>
            </div>
          </section>

          <section className="settings-card">
            <div className="card-header">
              <h2 className="card-title">Audio & Tactile Feedback</h2>
              <span className="card-badge">Sensory</span>
            </div>

            <div className="setting-toggle-row">
              <div className="toggle-text">
                <span className="toggle-label">Sound Effects (SFX)</span>
                <span className="toggle-sub">Court whistles, timer chimes, ball bounce audio cues</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={sfxEnabled}
                  onChange={(e) => setSfxEnabled(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="setting-toggle-row">
              <div className="toggle-text">
                <span className="toggle-label">Haptic Feedback</span>
                <span className="toggle-sub">Micro-vibrations when calling next or tapping courts on mobile</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={hapticsEnabled}
                  onChange={(e) => setHapticsEnabled(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="setting-toggle-row">
              <div className="toggle-text">
                <span className="toggle-label">Distance Units</span>
                <span className="toggle-sub">Display court distances in miles or kilometers</span>
              </div>
              <div className="segmented-control">
                <button
                  type="button"
                  className={`seg-btn ${unitSystem === 'mi' ? 'active' : ''}`}
                  onClick={() => setUnitSystem('mi')}
                >
                  Miles (mi)
                </button>
                <button
                  type="button"
                  className={`seg-btn ${unitSystem === 'km' ? 'active' : ''}`}
                  onClick={() => setUnitSystem('km')}
                >
                  Kilometers (km)
                </button>
              </div>
            </div>
          </section>

          {/* App Info Card */}
          <section className="settings-card info-card">
            <div className="card-header">
              <h2 className="card-title">System & Version</h2>
            </div>
            <div className="app-info-grid">
              <div className="info-stat">
                <span className="info-label">App Release</span>
                <span className="info-val">v2026.1 (Pro Baller)</span>
              </div>
              <div className="info-stat">
                <span className="info-label">Cloud Sync</span>
                <span className="info-val green-text">Swami Cloud · Connected</span>
              </div>
              <div className="info-stat">
                <span className="info-label">Austin Network</span>
                <span className="info-val">15 Districts · 25+ Courts</span>
              </div>
              <div className="info-stat">
                <span className="info-label">Publisher</span>
                <span className="info-val">© 2026 Swami Software, LLC</span>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ══════════════════════════════════════════
          TAB 3: ALERTS & PRIVACY
         ══════════════════════════════════════════ */}
      {activeTab === 'notifications' && (
        <div className="settings-tab-content anim-fade-in">
          <section className="settings-card">
            <div className="card-header">
              <h2 className="card-title">Austin Court Alerts</h2>
              <span className="card-badge">Proximity</span>
            </div>

            <div className="setting-toggle-row">
              <div className="toggle-text">
                <span className="toggle-label">Pickup Proximity Alerts</span>
                <span className="toggle-sub">Get notified when 3+ ballers check in or start a pickup at your Home Court</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={pickupAlerts}
                  onChange={(e) => setPickupAlerts(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="setting-toggle-row">
              <div className="toggle-text">
                <span className="toggle-label">Direct Game Invites</span>
                <span className="toggle-sub">Allow registered players in your district to challenge or invite you to games</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={gameInvites}
                  onChange={(e) => setGameInvites(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>
          </section>

          <section className="settings-card">
            <div className="card-header">
              <h2 className="card-title">Privacy & Social Presence</h2>
              <span className="card-badge">Social Control</span>
            </div>

            <div className="setting-toggle-row">
              <div className="toggle-text">
                <span className="toggle-label">On-Court Active Status</span>
                <span className="toggle-sub">Show an active green marker next to your avatar when you are physically checked in at a court</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={onCourtStatus}
                  onChange={(e) => setOnCourtStatus(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="setting-toggle-row">
              <div className="toggle-text">
                <span className="toggle-label">Public Leaderboard Visibility</span>
                <span className="toggle-sub">Display your XP rank and games played on Austin district leaderboards (toggle off for Stealth Mode)</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={publicProfile}
                  onChange={(e) => setPublicProfile(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>
          </section>
        </div>
      )}

      {/* ══════════════════════════════════════════
          TAB 4: SECURITY & DATA
         ══════════════════════════════════════════ */}
      {activeTab === 'account' && (
        <div className="settings-tab-content anim-fade-in">
          {/* Account Status Card */}
          <section className="settings-card">
            <div className="card-header">
              <h2 className="card-title">Account Credentials</h2>
              <span className="card-badge">{isGuest ? 'Temporary Session' : 'Secured'}</span>
            </div>

            <div className="credential-row">
              <div className="cred-info">
                <span className="cred-label">Authenticated Identity</span>
                <span className="cred-val">{user?.email || (isGuest ? 'Anonymous Guest Baller' : 'Player Account')}</span>
              </div>
              <div className="cred-provider-pill">
                {user?.providerData?.[0]?.providerId === 'google.com'
                  ? 'Google Auth'
                  : isGuest
                  ? 'Local Guest'
                  : 'Email & Password'}
              </div>
            </div>

            {/* Guest Upgrade Box */}
            {isGuest && (
              <div className="guest-upgrade-banner">
                <div className="gub-header">
                  <span className="gub-bolt">⚡</span>
                  <div>
                    <h4>Save Your Austin XP Permanently</h4>
                    <p>You have earned <strong>{currentXp} XP</strong> as a guest. Link an email to save your stats and access your profile anywhere.</p>
                  </div>
                </div>

                {!linkSuccess ? (
                  <form onSubmit={handleLinkAccount} className="gub-form">
                    {linkError && <div className="gub-error">{linkError}</div>}
                    <div className="form-row-2col">
                      <input
                        type="email"
                        className="custom-input"
                        placeholder="Email Address"
                        value={linkEmail}
                        onChange={(e) => setLinkEmail(e.target.value)}
                        required
                      />
                      <input
                        type="password"
                        className="custom-input"
                        placeholder="Create Password (min 6 chars)"
                        value={linkPassword}
                        onChange={(e) => setLinkPassword(e.target.value)}
                        required
                      />
                    </div>
                    <button type="submit" className="gub-submit-btn" disabled={linkingAccount}>
                      {linkingAccount ? 'Securing Account...' : 'Lock In XP & Create Account'}
                    </button>
                  </form>
                ) : (
                  <div className="gub-success">
                    ✓ Account permanently secured! Welcome to the verified Austin network.
                  </div>
                )}
              </div>
            )}

            {/* Password Update Form (for registered email users) */}
            {!isGuest && user?.providerData?.[0]?.providerId === 'password' && (
              <form onSubmit={handlePasswordUpdate} className="password-update-form">
                <h3 className="section-mini-title">Change Password</h3>
                {passwordMsg.text && (
                  <div className={`pwd-feedback ${passwordMsg.type}`}>{passwordMsg.text}</div>
                )}
                <div className="form-row-2col">
                  <input
                    type="password"
                    className="custom-input"
                    placeholder="New Password (min 6 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <input
                    type="password"
                    className="custom-input"
                    placeholder="Confirm New Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="secondary-btn"
                  disabled={passwordUpdating || !newPassword}
                >
                  {passwordUpdating ? 'Updating Password...' : 'Update Password'}
                </button>
              </form>
            )}
          </section>

          {/* Data Export Card */}
          <section className="settings-card">
            <div className="card-header">
              <h2 className="card-title">Baller Data Portability</h2>
              <span className="card-badge">2026 GDPR / CCPA Standard</span>
            </div>
            <p className="card-desc">
              Download a complete JSON export of your player passport, XP timeline, badges earned, and court preferences.
            </p>
            <div className="btn-action-row">
              <button type="button" className="secondary-btn" onClick={handleExportData}>
                <span>📥</span> Export Baller Data (JSON)
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  triggerToast('Local cache refreshed!');
                }}
              >
                <span>🔄</span> Refresh Local Cache
              </button>
            </div>
          </section>

          {/* Danger Zone */}
          <section className="settings-card danger-card">
            <div className="card-header">
              <h2 className="card-title danger-text">Danger Zone</h2>
            </div>
            <div className="danger-row">
              <div>
                <span className="danger-item-title">Sign Out</span>
                <p className="danger-item-desc">Sign out of your active session on this device.</p>
              </div>
              <button type="button" className="danger-zone-btn" onClick={handleLogout}>
                Sign Out
              </button>
            </div>

            <div className="danger-row" style={{ marginTop: '1rem', borderTop: '1px solid rgba(239,68,68,0.2)', paddingTop: '1rem' }}>
              <div>
                <span className="danger-item-title">Delete Account</span>
                <p className="danger-item-desc">Permanently remove your baller profile, XP history, and leaderboard records.</p>
              </div>
              <button
                type="button"
                className="delete-account-btn"
                onClick={() => setShowDeleteModal(true)}
              >
                Delete Account
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ══════════════════════════════════════════
          STICKY SAVE ACTION BAR (when dirty)
         ══════════════════════════════════════════ */}
      {isDirty && (
        <div className="sticky-save-bar anim-slide-up">
          <div className="save-bar-info">
            <span className="save-bar-dot" />
            <span>Unsaved modifications detected</span>
          </div>
          <div className="save-bar-actions">
            <button
              type="button"
              className="discard-btn"
              onClick={handleResetChanges}
              disabled={saving}
            >
              Discard
            </button>
            <button
              type="button"
              className="save-btn"
              onClick={handleSaveChanges}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          DELETE CONFIRMATION MODAL
         ══════════════════════════════════════════ */}
      {showDeleteModal && (
        <div className="modal-backdrop anim-fade-in">
          <div className="modal-card anim-scale-in">
            <div className="modal-header">
              <span className="modal-icon-danger">⚠️</span>
              <h3>Confirm Account Deletion</h3>
            </div>
            <p className="modal-body-text">
              This action is permanent and cannot be undone. All your earned XP ({currentXp.toLocaleString()} XP),
              unlocked badges, and game stats will be erased from the Austin network.
            </p>
            <p className="modal-prompt-text">
              Type <strong>DELETE</strong> below to confirm:
            </p>
            <input
              type="text"
              className="custom-input delete-confirm-input"
              placeholder="Type DELETE"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
            />
            <div className="modal-actions-row">
              <button
                type="button"
                className="modal-cancel-btn"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-confirm-delete-btn"
                disabled={deleteConfirmText.trim().toLowerCase() !== 'delete' || deleting}
                onClick={handleDeleteAccount}
              >
                {deleting ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
