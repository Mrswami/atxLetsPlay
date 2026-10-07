const fs = require('fs');

let content = fs.readFileSync('src/pages/Settings.jsx', 'utf8');

// 1. Remove sticky save bar
const stickyRegex = /\{\/\* ══════════════════════════════════════════\s*STICKY SAVE ACTION BAR[\s\S]*?\{isDirty && \([\s\S]*?<div className="sticky-save-bar anim-slide-up">[\s\S]*?<\/div>\s*\)\}/g;
content = content.replace(stickyRegex, '');

// 2. Add email toggles to notifications tab
const emailToggles = `
            <section className="settings-card">
              <div className="card-header">
                <h2 className="card-title">Email Notifications</h2>
                <span className="card-badge">Comms</span>
              </div>
              <div className="setting-toggle-row">
                <div className="toggle-text">
                  <span className="toggle-label">Game Reminders</span>
                </div>
                <label className="toggle-switch"><input type="checkbox" defaultChecked /><span className="toggle-slider" /></label>
              </div>
              <div className="setting-toggle-row">
                <div className="toggle-text">
                  <span className="toggle-label">Court Invitations</span>
                </div>
                <label className="toggle-switch"><input type="checkbox" defaultChecked /><span className="toggle-slider" /></label>
              </div>
              <div className="setting-toggle-row">
                <div className="toggle-text">
                  <span className="toggle-label">Friend Invitations & Adds</span>
                </div>
                <label className="toggle-switch"><input type="checkbox" defaultChecked /><span className="toggle-slider" /></label>
              </div>
            </section>
`;
content = content.replace('              <div className="card-header">\n                <h2 className="card-title">Austin Court Alerts</h2>', emailToggles + '\n              <div className="card-header">\n                <h2 className="card-title">Austin Court Alerts</h2>');

// 3. Add Save button to the end of all existing tabs
// Profile
content = content.replace('          </section>\n        </div>\n      )}\n\n      {/* ══════════════════════════════════════════\n          TAB 2:', '          </section>\n          <div style={{ marginTop: "2rem", display: "flex", justifyContent: "flex-end" }}><button type="button" className="save-btn" onClick={handleSaveChanges} disabled={saving} style={{ padding: "0.75rem 2rem", fontSize: "1.1rem", borderRadius: "30px", background: "var(--accent-color, #ff4e00)", color: "#fff", border: "none", cursor: "pointer", fontWeight: "bold" }}>{saving ? "Saving..." : "Save Profile Changes"}</button></div>\n        </div>\n      )}\n\n      {/* ══════════════════════════════════════════\n          TAB 2:');

// Preferences
content = content.replace('          </section>\n        </div>\n      )}\n\n      {/* ══════════════════════════════════════════\n          TAB 3:', '          </section>\n          <div style={{ marginTop: "2rem", display: "flex", justifyContent: "flex-end" }}><button type="button" className="save-btn" onClick={handleSaveChanges} disabled={saving} style={{ padding: "0.75rem 2rem", fontSize: "1.1rem", borderRadius: "30px", background: "var(--accent-color, #ff4e00)", color: "#fff", border: "none", cursor: "pointer", fontWeight: "bold" }}>{saving ? "Saving..." : "Save Preferences"}</button></div>\n        </div>\n      )}\n\n      {/* ══════════════════════════════════════════\n          TAB 3:');

// Notifications
content = content.replace('          </section>\n        </div>\n      )}\n\n      {/* ══════════════════════════════════════════\n          TAB 4:', '          </section>\n          <div style={{ marginTop: "2rem", display: "flex", justifyContent: "flex-end" }}><button type="button" className="save-btn" onClick={handleSaveChanges} disabled={saving} style={{ padding: "0.75rem 2rem", fontSize: "1.1rem", borderRadius: "30px", background: "var(--accent-color, #ff4e00)", color: "#fff", border: "none", cursor: "pointer", fontWeight: "bold" }}>{saving ? "Saving..." : "Save Privacy Settings"}</button></div>\n        </div>\n      )}\n\n      {/* ══════════════════════════════════════════\n          TAB 4:');

// 4. Add "Find Friends" tab content right before TAB 2
const friendsTab = `
      {activeTab === 'friends' && (
        <div className="settings-tab-content anim-fade-in">
          <section className="settings-card">
            <div className="card-header">
              <h2 className="card-title">Find Friends</h2>
              <span className="card-badge">Network</span>
            </div>
            <div className="form-group">
              <label>Search by Unique Username</label>
              <div className="input-with-prefix" style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', marginTop: '1rem' }}>
                <span className="input-prefix" style={{ paddingLeft: '1rem', color: '#888', fontWeight: 'bold' }}>@</span>
                <input
                  type="text"
                  className="custom-input"
                  style={{ border: 'none', background: 'transparent', flex: 1, outline: 'none' }}
                  placeholder="austin_baller"
                />
                <button type="button" style={{ background: '#10b981', color: '#fff', border: 'none', padding: '0 1rem', fontWeight: 'bold', cursor: 'pointer', height: '100%', minHeight: '44px' }}>
                  Search & Add
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
`;
content = content.replace('{/* ══════════════════════════════════════════\n          TAB 2:', friendsTab + '\n      {/* ══════════════════════════════════════════\n          TAB 2:');

fs.writeFileSync('src/pages/Settings.jsx', content, 'utf8');
console.log('Node patch complete!');
