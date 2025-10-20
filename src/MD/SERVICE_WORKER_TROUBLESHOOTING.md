# 🆘 Service Worker Troubleshooting

Quick reference for diagnosing and fixing Service Worker issues.

---

## ✅ How to Know It's Fixed

After the update, you should:

1. **See NO more "clone" errors** in console
2. **App loads instantly** from cache (even if network slow)
3. **Works offline** after first load
4. **Auto-updates** silently in background

---

## 🧪 Testing the Service Worker

### Step 1: Open DevTools
```
Windows/Linux: F12
macOS: Cmd+Option+I
```

### Step 2: Check Service Worker Status

Go to **Application** tab → **Service Workers**

You should see:
```
http://localhost:5173/
✓ activated and running
(not redundant)
```

### Step 3: Check Cache Storage

Go to **Application** → **Cache Storage** → `digital-clock-v1`

You should see cached files:
- `/`
- `/index.html`
- `/manifest.json`
- Plus any dynamically cached assets

### Step 4: Monitor Network Activity

Go to **Network** tab

Watch for requests:
- First load: Network requests
- After refresh: Should show `(from cache)` or `(from service worker)`

### Step 5: Test Offline

In **Network** tab:
1. Check "Offline" checkbox
2. Refresh page (Cmd+R or Ctrl+R)
3. App should **still load**
4. You'll see "(from service worker)" for all requests

---

## 🐛 Troubleshooting Guide

### Problem: Seeing "clone" Errors

**Status**: ❌ Old version still running

**Solutions**:

1. **Hard refresh** to clear cache:
   - Windows/Linux: `Ctrl+Shift+R`
   - macOS: `Cmd+Shift+R`

2. **Unregister old Service Worker**:
   - DevTools → Application → Service Workers
   - Click "Unregister"
   - Refresh page

3. **Clear all caches**:
   - DevTools → Application → Cache Storage
   - Right-click each cache → Delete
   - Refresh page

4. **Try different browser**:
   - Errors might be cached per-browser
   - Try Chrome, Firefox, Edge

### Problem: Service Worker Not Activating

**Status**: ⚠️ Installation issue

**Check**:
1. Is `public/sw.js` correctly located?
2. Is `index.html` registering it? (Check for SW registration script)
3. Is the app on HTTPS or localhost? (Required for SW)

**Fix**:
```javascript
// In index.html, should have:
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}
```

### Problem: App Not Loading Offline

**Status**: ⚠️ Cache not populated

**Check**:
1. Did you load the app **online first**? (Cache needs to be populated)
2. Is cache storage enabled in browser?
3. Are there enough resources available?

**Fix**:
1. Load app online first (let it cache files)
2. Wait 5 seconds for cache to populate
3. Then go offline
4. Refresh to test

### Problem: Settings Not Persisting Offline

**Status**: ✅ Expected (partially)

**Why**: Settings use `localStorage` (separate from SW cache)

**Behavior**:
- ✅ Settings visible offline (already in localStorage)
- ✅ Changes saved to localStorage offline
- ⚠️ Changes lost if you uninstall app or clear data

### Problem: Too Much Storage Used

**Status**: ⚠️ Cache too large

**Cache size limits** (varies by browser):
- Chrome: ~50MB per site
- Firefox: Configurable (50MB default)
- Safari: Varies (typically 50MB+)

**Check cache size**:
1. DevTools → Application → Cache Storage
2. Look for `digital-clock-v1` cache
3. Estimate file sizes

**Solution**: Cache is minimal, shouldn't be an issue unless you add large assets

---

## 🔍 Debugging Checklist

```
□ Service Worker shows "activated and running"
□ No errors in console
□ Cache Storage shows cached files
□ App loads when offline
□ Settings persist after refresh
□ Hard refresh doesn't break anything
□ Different browsers work
□ Desktop and mobile work
```

---

## 🚀 Common Workflows

### After Code Update

1. Build: `npm run build`
2. Refresh browser: `F5` or `Cmd+R`
3. SW automatically detects update
4. See notification (if enabled)
5. App reloads with new code

### After Cache Issue

1. Open DevTools: `F12`
2. Unregister SW: Application → Service Workers → Unregister
3. Clear cache: Application → Cache Storage → Delete
4. Close DevTools
5. Refresh page: `F5`
6. Wait 5 seconds for new cache

### Testing New SW

1. Make code changes to `public/sw.js`
2. Build: `npm run build`
3. Hard refresh: `Ctrl+Shift+R`
4. Check DevTools → Application → Service Workers
5. Should show new version activating

---

## 📊 Service Worker Lifecycle

```
NEW CODE
  ↓
Browser downloads new sw.js
  ↓
Compares with old version
  ↓
If different:
  → "waiting" state
  → New version installs
  → "activated" state (if no clients using old)
  ↓
Clients get updated code
  ↓
Refresh page
  ↓
New version active
```

---

## 🔐 Security Notes

- SW only works on **HTTPS** (or localhost for dev)
- SW is **sandboxed** - can't access parent page directly
- SW **persists** across browser sessions
- Settings in localStorage are **not secure** (avoid sensitive data)

---

## 📚 Quick Reference

| Issue | Solution |
|-------|----------|
| Clone errors | Hard refresh (Ctrl+Shift+R) |
| SW not running | Unregister + refresh |
| Cache empty | Load app online first |
| Offline not working | Populate cache first |
| Settings lost | Check localStorage enabled |
| Storage full | Cache is minimal, check OS disk |
| Old code running | Hard refresh + unregister |

---

## 🆘 Still Having Issues?

1. **Check browser console** (F12 → Console)
   - Look for errors
   - Look for warnings
   - Copy error message

2. **Check Network tab** (F12 → Network)
   - Reload page
   - Look for failed requests
   - Note any 404s or 500s

3. **Check Application tab** (F12 → Application)
   - Check SW status (should be "activated and running")
   - Check cache storage (should have files)
   - Check manifest (should be valid)

4. **Try these steps**:
   - Hard refresh: `Ctrl+Shift+R`
   - Unregister SW
   - Clear all caches
   - Close DevTools
   - Refresh: `F5`
   - Wait 5 seconds
   - Refresh again

5. **Still stuck?**
   - Try different browser
   - Try private/incognito window
   - Check browser storage settings
   - Verify HTTPS/localhost

---

**Last Updated**: October 20, 2025  
**Status**: Fixed and verified
