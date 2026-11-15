# NOCTIS - setup

npx create-expo-app@latest noctis --template blank-typescript
cd noctis
# delete App.tsx / index.ts, copy this zip's files over the project
# in package.json set:  "main": "expo-router/entry"

npx expo install expo-router expo-secure-store expo-crypto expo-haptics expo-notifications expo-sqlite expo-status-bar expo-system-ui react-native-reanimated react-native-safe-area-context react-native-screens react-native-gesture-handler react-native-worklets @react-native-community/datetimepicker @expo/vector-icons
npx expo install expo-font react-native-svg expo-linear-gradient @expo-google-fonts/noto-nastaliq-urdu @expo-google-fonts/amiri
npx expo install expo-file-system expo-sharing expo-document-picker
npm install @noble/ciphers@^1.3.0 @noble/hashes@^1.8.0
npm install nativewind@^4 zustand date-fns
npm install -D tailwindcss@^3.4

# notifications need a dev build on Android:
npx expo prebuild --platform android
npx expo run:android

# build a shareable APK (needs EAS account):
# npm i -g eas-cli && eas build -p android --profile preview
