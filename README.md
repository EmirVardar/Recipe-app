# Bitirme Projesi

Bu repoda iki ana klasor var:

- `backend`: Spring Boot backend
- `mobile`: Expo (React Native) mobil uygulama

## Klasor Yapisi

- `/Users/emirvardar/Desktop/bitirme/backend`
- `/Users/emirvardar/Desktop/bitirme/mobile`

## Ilk Kurulum (Database - Docker)

PostgreSQL container olusturma (ilk seferde bir kez):

```bash
docker run --name recipe-postgres \
  -e POSTGRES_DB=deneme \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=1234 \
  -p 5432:5432 \
  -d postgres:16
```

Sonraki kullanimda DB baslat/durdur:

```bash
docker start recipe-postgres
docker stop recipe-postgres
```

## Calistirma (iOS Simulator)

1) Backend:

```bash
cd /Users/emirvardar/Desktop/bitirme/backend
./mvnw spring-boot:run
```

2) Mobile:

```bash
cd /Users/emirvardar/Desktop/bitirme/mobile
npx expo start --ios
```

## Beklenen Sonuc

- Mobile ana ekranda `Backend Connection Test` altinda `status: ok` gorunur.
- iOS simulator otomatik olarak `http://localhost:8080` kullanir.

## Notlar

- Mobile tarafinda lint calisiyor (`npm run lint`).
- Backend bagimliliklari internetten cekiliyor. Maven tarafinda sorun olursa internet/proxy ayarlarini kontrol et.
- Maven panelinde proje gorunmezse `backend/pom.xml` dosyasini `Add as Maven Project` yap.

## Ek README'ler

- Backend detaylari: `/Users/emirvardar/Desktop/bitirme/backend/README.md`
- Mobile detaylari: `/Users/emirvardar/Desktop/bitirme/mobile/README.md`
