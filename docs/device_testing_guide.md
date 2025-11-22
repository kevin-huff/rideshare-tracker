# Phase 2.1: Physical Device Testing Guide

## Prerequisites

### Required Hardware
- ✅ Android device (Android 8.0+ recommended, Android 13+ for notifications)
- ✅ USB cable for device connection
- ✅ Computer with the development environment

### Required Software
- ✅ Android Studio installed
- ✅ ADB (Android Debug Bridge) in PATH
- ✅ Node.js and npm
- ✅ React Native CLI: `npm install -g react-native-cli`

---

## Step 1: Device Setup

### Enable Developer Options
1. Open **Settings** on your Android device
2. Navigate to **About Phone**
3. Tap **Build Number** 7 times until "You are now a developer" appears
4. Go back to **Settings** → **System** → **Developer Options**

### Enable USB Debugging
1. In **Developer Options**, enable:
   - ✅ **USB Debugging**
   - ✅ **Stay Awake** (keeps screen on while charging)
   - ✅ **Disable Animations** (optional, for faster testing)

### Verify Connection
```bash
# Connect device via USB, then run:
adb devices

# Expected output:
# List of devices attached
# ABC123XYZ    device
```

If device shows as "unauthorized", check your phone for the USB debugging authorization prompt.

---

## Step 2: Server Configuration

### Option A: Use ngrok (Recommended for Testing)

**Why**: Makes your local server accessible from your phone via public URL.

```bash
# Install ngrok (if not already installed)
# Download from: https://ngrok.com/download

# In a new terminal, run:
ngrok http 3000

# Example output:
# Forwarding  https://abc123.ngrok-free.app -> http://localhost:3000
```

Copy the `https://` URL (e.g., `https://abc123.ngrok-free.app`).

### Option B: Use Local Network IP

**Why**: Direct connection without third-party service (faster, but requires same WiFi).

```bash
# Find your computer's local IP
# macOS/Linux:
ifconfig | grep "inet "

# Windows:
ipconfig

# Look for something like: 192.168.1.XXX
```

**Important**: Ensure your phone is on the **same WiFi network** as your computer.

### Update Mobile App Configuration

Edit `mobile/src/api/client.ts`:

```typescript
// Option A (ngrok):
const DEFAULT_BASE_URL = 'https://abc123.ngrok-free.app';

// Option B (local IP):
const DEFAULT_BASE_URL = 'http://192.168.1.XXX:3000';  // Replace XXX with your IP
```

**Or** (better): Set via AsyncStorage on first launch - see "First Launch Setup" below.

---

## Step 3: Build and Deploy to Device

### Start Metro Bundler
```bash
cd /home/khuff/code/fun/github/rideshare-tracker/mobile
npm start
```

### Build and Install (in a new terminal)
```bash
cd /home/khuff/code/fun/github/rideshare-tracker/mobile

# Clean build (recommended for first time)
cd android && ./gradlew clean && cd ..

# Build and install on device
npx react-native run-android --device

# If multiple devices, specify:
# npx react-native run-android --device --deviceId=ABC123XYZ
```

**Build Time**: First build takes 5-10 minutes. Subsequent builds are faster.

### Verify Installation
- App should launch automatically on your device
- If it crashes, check Metro bundler logs for errors

---

## Step 4: First Launch Setup

### Set API Configuration (Manual Method via Dev Menu)

Since the app defaults to `localhost`, you need to configure the API URL on first launch.

**Option 1: Modify client.ts (already done in Step 2)**

**Option 2: Use React Native Debugger (Advanced)**
1. Shake device to open dev menu
2. Select "Debug"
3. Open Chrome DevTools
4. In Console, run:
   ```javascript
   AsyncStorage.setItem('@api_base_url', 'https://abc123.ngrok-free.app');
   AsyncStorage.setItem('@device_token', 'test-device-123');
   ```
5. Reload app

**Option 3: Add Settings Screen (Recommended for Future)**
Add a settings screen in the app to configure these values via UI.

---

## Step 5: Test Scenarios

### 🧪 Test 1: Permissions Flow

**Objective**: Verify all permissions are requested and granted.

**Steps:**
1. Launch app (fresh install)
2. **Expected**: Permission prompts appear for:
   - Location (Fine)
   - Background Location (Android 10+)
   - Notifications (Android 13+)
3. **Action**: Grant all permissions
4. **Expected**: App shows `IdleScreen` with "Ready to drive"

**Verify:**
- ✅ No crashes
- ✅ App transitions to idle screen after permissions granted
- ✅ If permissions denied, error alert appears

---

### 🧪 Test 2: Start Shift (Online)

**Objective**: Verify shift creation and sync.

**Prerequisites:**
- Server running (`npm run dev` in `/server`)
- API URL configured correctly
- Permissions granted

**Steps:**
1. On `IdleScreen`, tap **"Start Shift"**
2. **Expected**: 
   - Button shows loading spinner
   - After ~1-2 seconds, transitions to `ActiveShiftScreen`
   - HUD shows: "Shift Active" / "Waiting for ride"
   - Stats cards show: 0 rides, $0.00 earnings

**Verify:**
- ✅ Loading state appears
- ✅ Transition happens smoothly
- ✅ Check server logs for `POST /v1/shifts` request
- ✅ Check database: `sqlite3 server/data/rideshare.db "SELECT * FROM shifts;"`
- ✅ Notification appears: "Shift active" (Android notification tray)

**Debug if fails:**
- Check Metro bundler for errors
- Check server logs for API errors
- Check phone's notification: "Location tracking enabled"

---

### 🧪 Test 3: Background Location Tracking

**Objective**: Verify GPS tracking continues when app is backgrounded.

**Prerequisites:**
- Active shift (from Test 2)
- Location permissions granted

**Steps:**
1. With shift active, press **Home** button (background the app)
2. **Expected**: Notification persists: "Shift active - Location tracking enabled"
3. Walk around for 2-3 minutes (or drive if possible)
4. Open app again
5. Check database for location pings:
   ```bash
   sqlite3 mobile/rideshare.db "SELECT COUNT(*) FROM location_pings;"
   ```

**Verify:**
- ✅ Notification stays active when backgrounded
- ✅ Location pings are saved (multiple rows in `location_pings` table)
- ✅ Pings have `shift_id` populated
- ✅ Accuracy values are reasonable (<50m for GPS)

**Expected Ping Rate:**
- **Waiting mode**: ~1 ping every 15 seconds
- **In ride mode**: ~1 ping every 4 seconds

---

### 🧪 Test 4: Complete Ride Workflow (Online)

**Objective**: Test full ride lifecycle with server sync.

**Steps:**

#### 4.1: Start Ride
1. On `ActiveShiftScreen`, tap **"Start Ride"**
2. **Expected**:
   - Button shows loading
   - State changes to "En route to pickup"
   - Location tracking switches to high-accuracy mode (faster pings)
3. **Verify**:
   - ✅ Server logs show `POST /v1/rides`
   - ✅ Database has new ride row with `status='en_route'`
   - ✅ Notification updates: "Ride in progress"

#### 4.2: Mark Pickup
1. Tap **"Rider Picked Up"**
2. **Expected**:
   - Button changes to "End Ride"
   - State shows "Ride in progress"
3. **Verify**:
   - ✅ Ride status in DB updated to `in_progress`
   - ✅ `pickup_at` timestamp is set

#### 4.3: End Ride
1. Tap **"End Ride"**
2. **Expected**: Modal appears asking for fare
3. Enter fare amount (e.g., `12.50`)
4. Tap **"Submit"**
5. **Expected**:
   - Modal closes
   - Ride summary appears briefly (or stats update)
   - State returns to "Waiting for ride"
   - Stats update: +1 ride, +$12.50 earnings

**Verify:**
- ✅ Server logs show `PATCH /v1/rides/{id}/end`
- ✅ Database: ride has `ended_at`, `gross_cents=1250`
- ✅ Shift totals updated: `earnings_cents` and `ride_count` incremented
- ✅ Location tracking switches back to waiting mode (slower pings)

---

### 🧪 Test 5: Offline Mode & Queue

**Objective**: Verify offline resilience and queue replay.

**Steps:**

#### 5.1: Disable Network
1. With active shift, enable **Airplane Mode** on device
2. Start a ride (tap "Start Ride")
3. **Expected**: 
   - Button still works (optimistic UI)
   -State changes to "En route"
   - No immediate error

#### 5.2: Complete Actions Offline
1. Mark pickup (tap "Rider Picked Up")
2. End ride with fare `$8.00`
3. **Expected**: All actions succeed locally

**Verify Local State:**
```bash
# On device (via adb shell or after syncing to computer):
adb shell
run-as com.mobile  # Or your app package name
cd databases
sqlite3 rideshare.db
SELECT * FROM pending_requests;
SELECT * FROM rides WHERE synced=0;
```

- ✅ Rows appear in `pending_requests` table
- ✅ Ride exists locally with `synced=0`
- ✅ Location pings still being saved

#### 5.3: Re-enable Network and Verify Sync
1. Disable **Airplane Mode**
2. Wait 30 seconds (sync interval)
3. **Expected**: Automatic sync in background

**Verify Sync:**
```bash
# Check queue is empty
sqlite3 mobile/rideshare.db "SELECT COUNT(*) FROM pending_requests;"
# Expected: 0

# Check server database
sqlite3 server/data/rideshare.db "SELECT * FROM rides ORDER BY started_at DESC LIMIT 1;"
# Expected: The offline ride appears with correct data
```

- ✅ Pending requests cleared
- ✅ Server has the offline ride
- ✅ IDs match (local ID replaced with server ID)
- ✅ Location pings uploaded (check server DB: `location_pings` table)

---

### 🧪 Test 6: End Shift

**Objective**: Verify shift completion and summary.

**Steps:**
1. On `ActiveShiftScreen`, tap **"End Shift"**
2. **Expected**:
   - Shift ends locally
   - Final sync triggered
   - After 5 seconds, `ShiftSummaryScreen` appears
3. Review summary stats:
   - Total rides
   - Total earnings + tips
   - Distance
   - $/hr rate

**Verify:**
- ✅ Server logs show `PATCH /v1/shifts/{id}/end`
- ✅ Database: shift has `ended_at` timestamp
- ✅ Location tracking stops (notification disappears)
- ✅ Summary screen shows accurate stats

#### 6.1: Return to Idle
1. On summary screen, tap **"Back to Home"**
2. **Expected**: Returns to `IdleScreen`
3. **Verify**:
   - ✅ State is `idle`
   - ✅ No active shift in memory
   - ✅ Previous shift summary shows on idle screen (optional feature)

---

### 🧪 Test 7: App Restart Persistence

**Objective**: Verify state restoration after app restart.

**Steps:**

#### 7.1: With Active Shift
1. Start a shift, start a ride, mark pickup
2. Force-close app (swipe away from recent apps)
3. Reopen app

**Expected:**
- ✅ App restores to "Ride in progress" state
- ✅ Stats are correct
- ✅ Location tracking resumes
- ✅ All data matches pre-close state

#### 7.2: During Offline Period
1. Enable Airplane Mode
2. Start a ride, complete it
3. Force-close app
4. Reopen app (still offline)
5. Disable Airplane Mode

**Expected:**
- ✅ Offline ride data persists
- ✅ Sync resumes after network returns
- ✅ No data loss

---

### 🧪 Test 8: Battery & Performance

**Objective**: Monitor resource usage during extended use.

**Preparation:**
```bash
# Monitor battery drain
adb shell dumpsys batterystats --reset
# Use app for 30+ minutes
adb shell dumpsys batterystats > battery_stats.txt
```

**Steps:**
1. Start a shift
2. Leave app running for 30 minutes
3. Alternate between:
   - Backgrounded (home screen)
   - Foreground (app visible)
   - In ride vs. waiting states

**Monitor:**
- CPU usage (via Android Studio Profiler)
- Memory usage (should be <200MB)
- Battery drain (compare to baseline)

**Expected:**
- ✅ No excessive battery drain (< 5%/hour in waiting mode)
- ✅ App doesn't crash or freeze
- ✅ Location pings continue consistently
- ✅ No memory leaks (memory stays stable over time)

---

## Debugging Tips

### View Logs in Real-Time
```bash
# All app logs
adb logcat | grep "ReactNativeJS"

# Just errors
adb logcat *:E
```

### Inspect Database on Device
```bash
adb shell
run-as com.mobile
cd databases
sqlite3 rideshare.db
.tables
SELECT * FROM shifts;
.quit
```

### Common Issues

**Issue**: App crashes on launch
- **Check**: Metro bundler logs
- **Fix**: Rebuild with `./gradlew clean`

**Issue**: Permissions not requested
- **Check**: AndroidManifest.xml has all permissions
- **Fix**: Uninstall app, reinstall

**Issue**: Location not tracking
- **Check**: Location services enabled on device
- **Check**: Notification shows "Location tracking enabled"
- **Fix**: Open device Settings → Location → ensure High Accuracy mode

**Issue**: API requests fail
- **Check**: Server is running (`npm run dev`)
- **Check**: ngrok tunnel is active (if using ngrok)
- **Check**: API URL in AsyncStorage is correct
- **Fix**: Update `@api_base_url` or modify `client.ts`

**Issue**: No location pings in database
- **Check**: Background location permission granted
- **Check**: Device location services enabled
- **Check**: Walk/drive for a few minutes (stationary won't trigger pings)

---

## Success Criteria

Your Phase 2.1 is **production-ready** if all these pass:

### Critical (Must Pass):
- ✅ Shift can start and end successfully
- ✅ Rides can be created, updated, and completed
- ✅ Location pings are saved while shift is active
- ✅ Background location works when app is backgrounded
- ✅ Offline queue processes correctly when network returns
- ✅ App restores state after restart
- ✅ No crashes during normal workflows

### Important (Should Pass):
- ✅ Stats update correctly after each ride
- ✅ Sync happens within 30 seconds of network returning
- ✅ Foreground service notification persists
- ✅ Battery drain is reasonable (<5%/hour)
- ✅ ID synchronization works (local → server IDs)

### Nice-to-Have:
- ✅ Minimal memory usage (<200MB)
- ✅ Fast API responses (<500ms)
- ✅ Smooth UI transitions

---

## Next Steps After Testing

1. **Document Issues**: Create GitHub issues for any bugs found
2. **Performance Tuning**: Adjust location intervals if battery drain is high
3. **Add Tip UI**: Implement the missing tip entry screen
4. **Map Integration**: Add MapLibre for route visualization (Phase 2.2)
5. **Production Config**: Update API URL for production server
6. **Deployment**: Prepare for Google Play or internal distribution

Good luck with testing! 🚀
