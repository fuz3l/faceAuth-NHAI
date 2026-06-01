# DatalakeFaceAuth - Offline Facial Recognition & Liveness System

DatalakeFaceAuth is a React Native CLI (no Expo) application designed for government field personnel (NHAI) to perform secure, fully offline biometric verification and liveness checks.

---

## Key System Features

*   **100% Offline Matching**: Compares 128-dimensional face embedding vectors against locally stored personnel credentials in a local SQLite datastore.
*   **Real-time Biometric Liveness Heuristics**: 
    *   **Eye Aspect Ratio (EAR)**: Captures eye blinks to confirm live status.
    *   **Head Turn Ratio (Yaw Heuristics)**: Tracks horizontal movement of the nose relative to cheek boundaries (no separate liveness model required).
*   **Dual TFLite Pipelines**:
    *   **MediaPipe Face Mesh (TFLite)**: Extracts 468 3D landmarks for liveness.
    *   **MobileFaceNet (TFLite)**: Generates 128D embeddings from cropped, aligned face images.
*   **Local SQLite Storage**: Local audit trails of scans, enrolled personnel, and pending synchronization records.
*   **AWS Sync Architecture**: Complete delta replication design (documented in [AWS_SYNC_ARCHITECTURE.md](AWS_SYNC_ARCHITECTURE.md)).
*   **Under 20MB Footprint**: Achieved by bypassing heavy framework overlays (like Skia or Reanimated) and integrating direct, native Android (Kotlin/CameraX) and iOS (Swift/AVFoundation) camera/TFLite bridges.

---

## 🛠️ Prerequisites & Local Setup

Make sure your machine is configured for React Native CLI development.

### 1. System Requirements
*   **Node.js**: `v20.x` or newer (recommended `v20.19.x` or `v22.x`)
*   **CocoaPods** (for iOS builds)
*   **Java Development Kit (JDK 17)**: 
    *   On macOS, install via Homebrew:
        ```bash
        brew install --cask zulu@17
        ```
    *   Configure your environment profile (`~/.zshrc`):
        ```bash
        export JAVA_HOME=$(/usr/libexec/java_home -v 17)
        ```
        Then reload the terminal shell: `source ~/.zshrc`

### 2. Project Installation
Clone the repository and install dependency bundles:
```bash
npm install
```

### 3. Native Configuration Files

#### Android SDK Setup
Create a file named `local.properties` inside the `android/` directory:
```properties
# android/local.properties
sdk.dir=/Users/YOUR_MAC_USERNAME/Library/Android/sdk
```
*(Replace `YOUR_MAC_USERNAME` with your actual macOS username)*

#### iOS CocoaPods Setup
Install iOS pods using Bundler (makes sure versions are identical):
```bash
cd ios
bundle install
bundle exec pod install
cd ..
```

---

## 🚀 Running the App Locally

### Step 1: Start Metro Bundler
Start the JavaScript packager:
```bash
npm start
```

### Step 2: Build & Deploy

#### Android Development
Deploy the debug APK to a connected physical device or emulator:
```bash
npm run android
```

#### iOS Development
Deploy to the iOS Simulator or device:
```bash
npm run ios
```

---

## 🧪 Simulation / Sandbox Mode (Emulator-Friendly)

By default, TFLite model execution and camera streaming require a physical device. To allow easy testing on standard Android/iOS emulators, the app includes a **Simulation Sandbox**:
*   If the app detects it is running on a simulator or if the model weights (`face_landmark.tflite` and `mobilefacenet.tflite` in `assets` / bundles) are missing/placeholder files, the custom Camera view **automatically switches to Simulator Mode**.
*   This mode synthesizes realistic facial landmarks and updates the UI through liveness gestures step-by-step:
    1.  *Look Center* (aligns face)
    2.  *Blink Eyes* (simulates EAR dropping)
    3.  *Turn Head Left* (simulates left yaw shift)
    4.  *Turn Head Right* (simulates right yaw shift)
    5.  *Access Granted / Denied* (emits a mock face embedding vector)
*   **For Production**: Replace the placeholder files under `android/app/src/main/assets/` and `ios/` with your actual trained TFLite models. The native view will automatically detect them and switch to live real-time camera inference.

---

## 📁 Codebase Directory Layout

*   [`src/App.tsx`](src/App.tsx): Main application wrapper, state-based screen routes, and UI stylesheet.
*   [`src/database/database.ts`](src/database/database.ts): Offline SQLite service handling DB tables, CRUD operations, and matching queries.
*   [`src/components/FaceCamera.tsx`](src/components/FaceCamera.tsx): React Component bridging native iOS/Android camera views.
*   [`src/utils/liveness.ts`](src/utils/liveness.ts): Mathematical helper functions to compute Eye Aspect Ratio (EAR) and Head Yaw ratio.
*   [`src/utils/matching.ts`](src/utils/matching.ts): Math routines calculating Cosine Similarity `(A . B) / (||A|| * ||B||)`.
*   [`android/app/src/main/java/com/datalakefaceauth/`](android/app/src/main/java/com/datalakefaceauth/):
    *   `FaceCaptureView.kt`: Custom CameraX preview view, TFLite execution, liveness state machine, and canvas overlays.
    *   `FaceCaptureViewManager.kt`: Bridges view properties/events (onFaceProcessed, onLivenessUpdate, onStatusMessage).
*   [`ios/DatalakeFaceAuth/`](ios/DatalakeFaceAuth/):
    *   `FaceCaptureView.swift`: UIKit AVCaptureSession camera delegate running liveness calculations, drawing overlays, and mapping events.
    *   `FaceCaptureViewManager.swift` & `.m`: Objective-C mapping layers.

---

## 🧪 Running Unit Tests

To run Jest unit tests testing the mathematical calculations:
```bash
npm run test
```
*(Runs similarity verification and EAR threshold checks)*
