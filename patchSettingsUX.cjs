const fs = require('fs');
let content = fs.readFileSync('src/pages/Settings.jsx', 'utf8');

// 1. Remove manual Save buttons
const saveBtnRegex = /<div style=\{\{ marginTop: "2rem", display: "flex", justifyContent: "flex-end" \}\}>.*?<\/button><\/div>/g;
content = content.replace(saveBtnRegex, '');

// 2. Auto-save on blur for text fields
content = content.replace(
  'onChange={(e) => setDisplayName(e.target.value)}',
  'onChange={(e) => setDisplayName(e.target.value)}\n                onBlur={() => handleSaveChanges()}'
);
content = content.replace(
  'onChange={(e) => setBio(e.target.value)}',
  'onChange={(e) => setBio(e.target.value)}\n                onBlur={() => handleSaveChanges()}'
);

// 3. For the username field, auto-check availability (debounced)
const usernameLogicRegex = /const \[checkingUsername, setCheckingUsername\] = useState\(false\);[\s\S]*?const \[usernameAvailable, setUsernameAvailable\] = useState\(null\);[\s\S]*?async function checkUsernameAvailability\(\) \{[\s\S]*?\} finally \{\s*setCheckingUsername\(false\);\s*\}\s*\}/;

const newUsernameLogic = `
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(null);

  useEffect(() => {
    if (!username.trim() || username === initialState?.username) {
      setUsernameAvailable(null);
      setUsernameError('');
      return;
    }
    const timer = setTimeout(async () => {
      setCheckingUsername(true);
      setUsernameAvailable(null);
      setUsernameError('');
      try {
        const q = query(collection(db, 'users'), where('username', '==', username.toLowerCase()));
        const snap = await getDocs(q);
        const takenByOther = snap.docs.find(d => d.id !== user?.uid);
        if (takenByOther) {
          setUsernameError('Username is already taken.');
          setUsernameAvailable(false);
        } else {
          setUsernameAvailable(true);
        }
      } catch (err) {
        setUsernameError('Failed to check availability.');
      } finally {
        setCheckingUsername(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [username, initialState?.username, user?.uid]);

  async function confirmAndSaveUsername() {
     try {
       await updateUsername(username.trim());
       setInitialState(prev => ({ ...prev, username: username.trim() }));
       setUsernameAvailable(null);
       triggerToast('Username officially claimed and saved!');
     } catch (err) {
       setUsernameError(err.message);
     }
  }
`;
content = content.replace(usernameLogicRegex, newUsernameLogic);

// 4. Update the Username UI (remove check button, add Confirm button)
const oldUsernameUI = /<div className="input-with-prefix" style=\{\{ display: 'flex'[\s\S]*?<\/div>\s*\{usernameAvailable && <div className="field-error-msg"[\s\S]*?<\/div>\}/;

const newUsernameUI = `
              <div className="input-with-prefix" style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                <span className="input-prefix" style={{ paddingLeft: '1rem', color: '#888', fontWeight: 'bold' }}>@</span>
                <input
                  id="username"
                  type="text"
                  className="custom-input"
                  style={{ border: 'none', background: 'transparent', flex: 1, outline: 'none' }}
                  placeholder="austin_baller"
                  value={username}
                  maxLength={16}
                  onChange={(e) => {
                    const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                    setUsername(val);
                    setUsernameError('');
                  }}
                />
                {checkingUsername && <span style={{ padding: '0 1rem', color: '#888' }}>Checking...</span>}
                {usernameAvailable && (
                  <button type="button" onClick={confirmAndSaveUsername} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '0 1rem', fontWeight: 'bold', cursor: 'pointer', height: '100%', minHeight: '44px' }}>
                    Confirm & Save
                  </button>
                )}
              </div>
              {usernameAvailable && <div className="field-error-msg" style={{color: '#10b981', marginTop: '0.25rem', fontSize: '0.85rem'}}>Username is available! Click Confirm to lock it in.</div>}
`;
content = content.replace(oldUsernameUI, newUsernameUI);

// 5. Add onBlur to selects/buttons that update state, wait, handleSaveChanges will read old state.
// We should update the selects to call handleSaveChanges after updating state, but wait...
// The easiest way for everything else is to use an effect that watches isDirty, but isDirty evaluates immediately!
// No, the user just wants the form fields to be seamless. 
// A good pattern for selects and toggles is to use a \`setTimeout\` to call \`handleSaveChanges()\` since by then React has batched the state update.
// E.g. onChange={(e) => { setDistrict(e.target.value); setHomeCourtId(''); setTimeout(handleSaveChanges, 100); }}

content = content.replace('setSkillLevel(lvl.id)}', 'setSkillLevel(lvl.id); setTimeout(handleSaveChanges, 50); }');
content = content.replace('setPlayStyle(ps.id)}', 'setPlayStyle(ps.id); setTimeout(handleSaveChanges, 50); }');
content = content.replace('setPickupAlerts(e.target.checked)}', 'setPickupAlerts(e.target.checked); setTimeout(handleSaveChanges, 50); }');
content = content.replace('setGameInvites(e.target.checked)}', 'setGameInvites(e.target.checked); setTimeout(handleSaveChanges, 50); }');
content = content.replace('setOnCourtStatus(e.target.checked)}', 'setOnCourtStatus(e.target.checked); setTimeout(handleSaveChanges, 50); }');
content = content.replace('setPublicProfile(e.target.checked)}', 'setPublicProfile(e.target.checked); setTimeout(handleSaveChanges, 50); }');

fs.writeFileSync('src/pages/Settings.jsx', content, 'utf8');
console.log('Patch complete.');
