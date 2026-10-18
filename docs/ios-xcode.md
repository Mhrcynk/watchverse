# iPhone sürümünü Mac'te Xcode ile derleme

Bir kez kurulum (Terminal):

```bash
# Node.js ve CocoaPods yoksa
brew install node cocoapods

git clone https://github.com/Mhrcynk/watchverse.git
cd watchverse
git checkout feat/native-mobile
npm ci
npx expo prebuild --platform ios --clean
open ios/WatchVerse.xcworkspace
```

Xcode'da:
1. Sol üstte proje → **Signing & Capabilities** → Team: Apple Developer hesabın. "Automatically manage signing" açık kalsın.
2. Aynı sekmede **Sign in with Apple** yetkisinin listede olduğunu kontrol et (yoksa + Capability ile ekle).
3. Üstte cihaz olarak **Any iOS Device (arm64)** seç → menüden **Product → Archive**.
4. Açılan Organizer penceresinde **Distribute App → App Store Connect → Upload**.
5. Birkaç dakika sonra App Store Connect → TestFlight'ta görünür; kendi iPhone'una TestFlight uygulamasıyla kurarsın.

Kodda değişiklik olunca:

```bash
git pull
npm ci
npx expo prebuild --platform ios
```

Sonra Xcode'da yine Archive → Upload. Her yüklemede sürüm numarasını (Build) bir artır.
