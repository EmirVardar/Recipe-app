# Backend Notes

Bu dokuman backend mimarisini ve dosya gorevlerini kisa olarak anlatir.
Bu dosya, her yeni ozellik eklendiginde guncellenecek referans notudur.

## Calisma Ozeti

- `AuthController` request alir.
- `AuthService` is kurallarini calistirir (validate, sifre hash, login kontrol).
- `UserRepository` veritabani islemlerini yapar.
- `JwtService` token uretir ve dogrular.
- `JwtAuthenticationFilter` her istekte Bearer token kontrolu yapar.
- `SecurityConfig` hangi endpointin acik/korumali oldugunu belirler.

## Paketler ve Gorevleri

### `controller`
- `AuthController`
  - `/api/auth/register`
  - `/api/auth/login`
  - Gelen DTO'lari service katmanina aktarir.
- `HealthController`
  - `/api/ping` (public)
- `UserController`
  - `/api/me` (protected)
- `UserHealthController`
  - `/api/onboarding/status`
  - `/api/me/profile`
  - `/api/me/medical`
  - `/api/me/nutrition`
  - Giris yapan kullanicinin onboarding verilerini yonetir.
- `AssistantController`
  - `/api/assistant/chat` (protected)
  - Chat mesaji alip OpenAI entegrasyonu uzerinden yanit doner.

### `service`
- `AuthService`
  - Register ve login is akisi burada.
  - Email kontrolu, sifre kontrolu, password hash ve token donusu burada.
- `CustomUserDetailsService`
  - DB'deki user'i Spring Security `UserDetails` formatina cevirir.
  - JWT dogrulama akisi bunu kullanir.
- `UserHealthService`
  - Onboarding status hesaplama.
  - Profile/medical/nutrition kayitlarini upsert etme.
- `OpenAiService` (`service/assistant`)
  - OpenAI entegrasyonu icin tek servis giris noktasi.
  - Prompt alip `OpenAiClient` uzerinden modele gonderir.
- `AssistantChatService` (`service/assistant`)
  - Chat endpoint is kurallarini yonetir.
  - Basit sistem prompt + kullanici mesaji ile OpenAI cevabini doner.

### `repository`
- `UserRepository`
  - `existsByEmail`
  - `findByEmail`
  - User tablosuna erisim burada.
- `UserProfileRepository`
  - `findByUserId`
- `UserMedicalRepository`
  - `findByUserId`
- `UserNutritionPreferenceRepository`
  - `findByUserId`

### `entity`
- `User`
  - Kullanici tablosu modeli.
  - Alanlar: email, passwordHash, fullName, createdAt, updatedAt.
  - Iliskiler: `UserProfile`, `UserMedical`, `UserNutritionPreference` (1-1).
- `UserProfile`
  - Temel profil bilgileri: age, sex, heightCm, weightKg, activityLevel, goal.
- `UserMedical`
  - Klinik bilgiler: chronicConditions, medications, allergies, intolerances.
- `UserNutritionPreference`
  - Beslenme tercihleri: dietType, avoidFoods, preferredFoods, budgetLevel.

### `dto`
- `RegisterRequestDto`: kayit body (email, password, fullName)
- `LoginRequestDto`: giris body
- `AuthResponseDto`: register/login response (id, email, fullName, accessToken, message)
- `ProfileUpdateRequestDto` / `ProfileResponseDto`
- `MedicalUpdateRequestDto` / `MedicalResponseDto`
- `NutritionPreferenceUpdateRequestDto` / `NutritionPreferenceResponseDto`
- `OnboardingStatusResponseDto`
- `AssistantChatRequestDto` / `AssistantChatResponseDto`

### `security`
- `JwtService`
  - Token uretme ve token parse/dogrulama.
- `JwtAuthenticationFilter`
  - `Authorization: Bearer <token>` headerini okuyup kimlik dogrular.

### `config`
- `SecurityConfig`
  - Stateless session
  - `/api/auth/**` ve `/api/ping` acik
  - Diger endpointler token ister
  - Password encoder (`BCryptPasswordEncoder`) bean

### `integration/openai`
- `OpenAiClient`
  - `https://api.openai.com/v1/chat/completions` cagrisi burada yapilir.
  - Backend'den OpenAI'ye cikan tum HTTP cagrilarinin tek noktasi.

## Auth Akisi

### Register
1. `POST /api/auth/register`
2. Email unique kontrolu
3. Password hash (`BCrypt`)
4. `User` save (sadece kimlik/auth alanlari)
5. JWT token uretilir
6. `AuthResponseDto` doner

### Login
1. `POST /api/auth/login`
2. Email ile user bulunur
3. Girilen password, hash ile karsilastirilir
4. Basariliysa JWT token uretilir
5. `AuthResponseDto` doner

### Protected Request
1. Istekte `Authorization: Bearer <token>` gelir
2. Filter token'dan email cikarir
3. User DB'den yuklenir
4. Token gecerliyse istek authenticated devam eder

## Postman Hızlı Test

- `POST /api/auth/register`
- `POST /api/auth/login`
- Login/registration response icindeki `accessToken` alin
- `GET /api/me` isteginde header ekle:
  - `Authorization: Bearer <accessToken>`
- `GET /api/onboarding/status` isteginde ayni headeri kullan
- `PUT /api/me/profile` ile temel profil gir
- `PUT /api/me/medical` ile medikal bilgiler gir
- `PUT /api/me/nutrition` ile beslenme tercihlerini gir
- `POST /api/assistant/chat` ile chat testi yap:
  - body: `{ \"message\": \"Diyabet için kahvalti onerisi ver\" }`

Beklenen:
- token yoksa `/api/me` -> `401`
- token varsa `/api/me` -> `200`

## Config Notu

`src/main/resources/application.yml` icinde:
- DB baglanti ayarlari
- JWT ayarlari:
  - `jwt.secret`
  - `jwt.exp-min`

Uretim icin `JWT_SECRET` ortam degiskenini guclu bir degerle set et.
