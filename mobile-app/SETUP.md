# Mobile App Setup Guide

## Prerequisites

1. **Node.js** >= 18
2. **React Native CLI**: `npm install -g react-native-cli`
3. **iOS Development** (macOS only):
   - Xcode (latest version)
   - CocoaPods: `sudo gem install cocoapods`
4. **Android Development**:
   - Android Studio
   - Android SDK
   - Java Development Kit (JDK)

## Installation Steps

### 1. Install Dependencies

```bash
cd mobile-app
npm install
```

### 2. iOS Setup

```bash
cd ios
pod install
cd ..
```

### 3. Configure API URL

The API URL is configured in `src/config/api.ts`. By default:
- Development: `http://localhost:5555`
- Production: Update the `API_URL` constant

For iOS simulator, use `http://localhost:5555`.
For Android emulator, use `http://10.0.2.2:5555`.
For physical devices, use your computer's local IP address (e.g., `http://192.168.1.100:5555`).

### 4. Run the App

**iOS:**
```bash
npm run ios
```

**Android:**
```bash
npm run android
```

**Start Metro Bundler:**
```bash
npm start
```

## Project Structure

```
mobile-app/
├── src/
│   ├── api/              # API client and types
│   ├── components/       # Reusable UI components
│   ├── config/           # Configuration files
│   ├── context/          # React context providers
│   ├── navigation/       # Navigation setup
│   ├── screens/          # Screen components
│   │   ├── auth/         # Authentication screens
│   │   └── ...          # Other screens
│   └── services/        # Business logic services
├── android/              # Android native code
├── ios/                  # iOS native code
└── package.json
```

## Features

- ✅ Authentication (Login/Signup)
- ✅ Capture photos, notes, and links
- ✅ Search across all items
- ✅ View items and collections
- ✅ Item detail view
- ✅ Collection management

## Troubleshooting

### Metro Bundler Issues
- Clear cache: `npm start -- --reset-cache`

### iOS Build Issues
- Clean build: `cd ios && xcodebuild clean && cd ..`
- Reinstall pods: `cd ios && pod deintegrate && pod install && cd ..`

### Android Build Issues
- Clean build: `cd android && ./gradlew clean && cd ..`
- Clear cache: `cd android && ./gradlew cleanBuildCache && cd ..`

### API Connection Issues
- Ensure the backend API is running
- Check API URL configuration
- For physical devices, ensure device and computer are on the same network
- Check firewall settings

## Development Notes

- The app uses AsyncStorage for token persistence
- All API calls are made through the `apiClient` in `src/api/client.ts`
- Navigation uses React Navigation v6
- UI follows iOS design guidelines with Material Icons
