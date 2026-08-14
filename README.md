# Seyahat Concierge

Paylaştığın 3 ekranın (Concierge, Keşfet, Seyahatlerim) React Native (Expo) uygulaması ve
onu besleyen Express backend'i.

## Ne çalışıyor, ne mock

- **Backend gerçek ve çalışıyor**: Express API, seyahatleri bir JSON dosyasında
  (`server/data/trips.json`) gerçekten saklıyor; oluşturma/silme/güncelleme kalıcı.
- **Concierge sohbeti gerçek bir LLM'e (Ollama) bağlı**: Backend, `/api/concierge/search`
  isteğinde önce yerel Ollama sunucuna (`server/src/llm.js`) bağlanmayı dener. Model,
  sana verdiğim destinasyon kataloğunu görür, kullanıcının serbest metnini gerçekten
  anlayıp hem doğal bir cevap yazar hem de kataloğdan en uygun rotaları seçer. Ollama
  çalışmıyorsa veya zaman aşımına uğrarsa backend otomatik olarak eski kural tabanlı
  ayrıştırıcıya (`server/src/matching.js`, ay/gün/anahtar kelime eşleştirme) düşer —
  uygulama hiçbir zaman çökmez, sadece cevap kalitesi düşer.
- **Destinasyonlar gerçek**: Keşfet ekranındaki şehirler artık elle yazılmıyor;
  Travelpayouts'un `city-directions` ucundan İstanbul'dan **gerçekten uçulan**
  popüler rotalar çekiliyor (`server/src/catalog.js`). Şehir/ülke isimleri
  Travelpayouts'un referans veri dosyalarından geliyor.
- **Uçuş fiyatları gerçek**: Travelpayouts (Aviasales) Data API'sinden canlı
  gidiş-dönüş fiyatı çekiliyor (`server/src/providers/travelpayouts.js`). Token
  girilmemişse veya API cevap vermezse katalogdaki tahmini fiyata düşer ve
  arayüzde "(tahmini)" olarak işaretlenir — yani hiçbir zaman uydurma fiyatı
  gerçekmiş gibi göstermez.
- **`data/destinations.js` artık katalog değil, zenginleştirme verisi**: canlı
  listede o şehir varsa oradaki Türkçe isim, tanıtım cümlesi, etiketler ve otel
  tahmini kullanılır; tanımadığı şehirler nötr varsayılanlarla gelir.
- **Otel fiyatları hâlâ tahmini**: Bir otel API'si bağlı değil.
  `server/src/data/destinations.js` içindeki `hotelPricePerNight` örnek veridir.
  Arayüzde uçuş ve otel kalemleri ayrı gösterilir, hangisinin gerçek olduğu bellidir.
- **Kullanıcı girişi yok**: Tek kullanıcılı demo (Ayşe). Auth eklemek istersen
  backend'e kolayca eklenecek şekilde yapılandırıldı.
- Görsellerde `picsum.photos` üzerinden placeholder fotoğraflar kullanılıyor
  (gerçek destinasyon fotoğrafı değil, internet bağlantısı gerektirir).

## Klasör yapısı

```
travel-concierge-app/
  app/      React Native (Expo) uygulaması
  server/   Express API + JSON veri deposu
```

## Çalıştırma

### 0) Ollama'yı çalıştır (opsiyonel ama önerilir)

Concierge sohbetinin gerçek bir AI ile cevap vermesi için Ollama'nın ayakta ve
modelin çekili olması gerekir:

```bash
ollama serve            # arka planda zaten çalışıyor olabilir
ollama pull gemma4:31b-cloud   # ilk seferde modeli indirir/bağlar
```

`server/.env` dosyasında bağlantı ayarları var (gerekirse değiştir):

```
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma4:31b-cloud
```

Ollama çalışmıyorsa uygulama hata vermez, sadece eski kural tabanlı cevaplara döner.

### 0.5) Uçuş fiyatı API anahtarını gir (opsiyonel)

Canlı uçuş fiyatları için ücretsiz bir Travelpayouts hesabı gerekiyor:

1. [travelpayouts.com](https://www.travelpayouts.com/) üzerinden kaydol (ücretsiz).
2. Profil > **API token** bölümünden token'ı kopyala.
3. `server/.env` dosyasında ilgili satırı doldur:

```
TRAVELPAYOUTS_TOKEN=buraya_kendi_tokenin
```

Token'ı repoya koyma — `.env` zaten `.gitignore` içinde. Boş bırakırsan uygulama
çalışmaya devam eder, fiyatlar sadece "(tahmini)" olarak gösterilir.

Backend ayakta mı ve token'ı görüyor mu diye kontrol:
`http://localhost:4000/api/health` → `flightApi.configured` alanı `true` olmalı.

### 1) Backend'i başlat

```bash
cd server
npm install   # zaten yüklü, gerekirse tekrar çalıştır
npm start     # http://localhost:4000
```

### 2) Uygulamayı başlat

```bash
cd app
npm install   # zaten yüklü, gerekirse tekrar çalıştır
npx expo start
```

- **Web'de denemek için**: terminalde `w` tuşuna bas ya da `npx expo start --web`.
- **Telefonda Expo Go ile denemek için**: `app/.env` dosyası oluşturup
  `EXPO_PUBLIC_API_URL=http://<bilgisayarının-LAN-IP-si>:4000` satırını ekle
  (telefon `localhost` ile bilgisayarındaki backend'e ulaşamaz, aynı Wi-Fi ağında
  olmanız ve bilgisayarının IP'sini kullanman gerekir).
- **Android emülatöründe**: hiçbir ayar gerekmez, `10.0.2.2` otomatik kullanılır.

## Ekranlar

1. **Concierge** — Sohbet tarzı arama: "Mayıs ayında Cuma tatile çıkacağım, Pazar
   dönerim, deniz kenarı olsun" gibi bir cümle yaz, en uygun 3 rota önerilir.
   Filtre chip'leri (Bütçe dostu / Aktarmasız uçuşlar / 5 yıldızlı otel) sonucu
   gerçekten yeniden hesaplar.
2. **Keşfet** — Mevsimlik öne çıkan destinasyonlar, editörün seçimi, ve arama
   geçmişinden öneri. Bir karta dokununca detay sayfası açılır, "Bu rotayı
   planla" ile taslak seyahat olarak Seyahatlerim'e eklenir.
3. **Seyahatlerim** — Yaklaşan / Geçmiş / Taslaklar sekmeleri, her seyahatin
   durumu ve fiyatı. Detay sayfasında onaylama ve silme yapılabilir.

## Bilinen sınırlamalar

- Gerçek ödeme/rezervasyon akışı yok.
- Otel fiyatları hâlâ tahmini (otel API'si bağlı değil). Uçuş fiyatları canlı.
- LLM sadece hangi destinasyonun uygun olduğuna karar veriyor; fiyatları
  görmüyor ve hesaplamıyor, fiyatlar backend'de canlı veriden ekleniyor.
- Canlı destinasyon listesi varsayılan olarak en ucuz 18 rota ile sınırlı
  (`CATALOG_SIZE` ile değiştirilebilir) ve 30 dakika önbelleklenir
  (`CATALOG_TTL_MS`).
- Şehir/ülke isimleri Travelpayouts'ta Türkçe yoksa İngilizce gelir
  (`TRAVELPAYOUTS_LOCALE` önce denenir, olmazsa `en`'e düşer). Katalogda elle
  tanımlı şehirler Türkçe isimlerini korur.
- Canlı rotalarda mevsim/etiket bilgisi olmadığı için kural tabanlı eşleştirici
  (Ollama kapalıyken devreye giren yedek) sadece elle tanımlı şehirleri
  puanlayabilir. LLM açıkken tüm canlı şehirler arasından seçim yapılır.
- Tek kullanıcı, giriş ekranı yok.
- Yerel LLM'in hızı/kalitesi tamamen senin çalıştırdığın modele bağlı;
  `OLLAMA_TIMEOUT_MS` (varsayılan 45sn) içinde cevap gelmezse kural tabanlı
  yanıta düşülür.
