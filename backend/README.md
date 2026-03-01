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

### `service`
- `AuthService`
  - Register ve login is akisi burada.
  - Email kontrolu, sifre kontrolu, password hash ve token donusu burada.
- `CustomUserDetailsService`
  - DB'deki user'i Spring Security `UserDetails` formatina cevirir.
  - JWT dogrulama akisi bunu kullanir.

### `repository`
- `UserRepository`
  - `existsByEmail`
  - `findByEmail`
  - User tablosuna erisim burada.

### `entity`
- `User`
  - Kullanici tablosu modeli.
  - Alanlar: email, passwordHash, fullName, heightCm, weightKg, createdAt, updatedAt.

### `dto`
- `RegisterRequestDto`: kayit body
- `LoginRequestDto`: giris body
- `AuthResponseDto`: register/login response (token dahil)

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

### `api`
- `HealthController`
  - `GET /api/ping` (public)
- `UserController`
  - `GET /api/me` (protected)

## Auth Akisi

### Register
1. `POST /api/auth/register`
2. Email unique kontrolu
3. Password hash (`BCrypt`)
4. User save
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
