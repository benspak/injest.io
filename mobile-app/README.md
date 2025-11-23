# Injest Mobile App

React Native mobile application for Injest.io - an AI-assisted knowledge recall platform.

## Features

- **Authentication**: Login and signup with JWT token-based authentication
- **Capture**: Capture photos, create notes, and save links
- **Search**: Semantic search across all your items
- **Items**: View and manage your items (notes, links, files, emails)
- **Collections**: Organize items into collections
- **Offline Support**: Basic offline functionality with AsyncStorage

## Getting Started

### Prerequisites

- Node.js >= 18
- React Native development environment set up
- iOS: Xcode and CocoaPods
- Android: Android Studio and Android SDK

### Installation

1. Install dependencies:
```bash
npm install
```

2. For iOS, install CocoaPods:
```bash
cd ios && pod install && cd ..
```

3. Configure API URL:
   - Edit `src/config/api.ts` to set your API URL
   - Default: `http://localhost:5555` for development
   - For Android emulator: use `http://10.0.2.2:5555`
   - For physical devices: use your computer's local IP (e.g., `http://192.168.1.100:5555`)

4. Run the app:
```bash
# iOS
npm run ios

# Android
npm run android
```

## Project Structure

```
mobile-app/
├── src/
│   ├── api/          # API client and types
│   ├── components/   # Reusable components
│   ├── navigation/   # Navigation setup
│   ├── screens/      # Screen components
│   ├── services/     # Business logic services
│   ├── store/        # State management
│   └── utils/        # Utility functions
├── android/          # Android native code
├── ios/              # iOS native code
└── package.json
```

## API Configuration

The app connects to the Injest.io backend API. Make sure the API server is running and accessible. The API URL can be configured via environment variables or in `src/config/api.ts`.

## Development

- Start Metro bundler: `npm start`
- Run on iOS: `npm run ios`
- Run on Android: `npm run android`
- Lint: `npm run lint`

## License

ISC
