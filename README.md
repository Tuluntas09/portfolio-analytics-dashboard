# Quant Portfolio Analytics Dashboard

Claude Design ciktilarindan uretilmis, React tabanli portfoy analiz dashboardu.

Bu repo tek urun yuzeyi olarak Claude tasarimina birebir yaklastirilmis React prototipini tutar. Streamlit/Python arayuzu kaldirilmistir; proje artik sade, sunuma uygun ve tek dashboard akisi uzerinden ilerler.

## Urun Siniri

Bu arac yalnizca **portfoy analitigi, risk izleme ve senaryo analizi** saglar.

- Yatirim tavsiyesi vermez
- Al / sat / tut sinyali uretmez
- Hedef fiyat veya getiri tahmini sunmaz
- Finansal planlama ya da aracilik hizmetinin yerini tutmaz

Gosterilen tum metrikler ve senaryolar tarihsel veriye dayali, varsayimli model ciktilarindan ibarettir. Gecmis performans gelecek sonuclari garantilemez.

Ayrintili sinir bilgisi icin [DISCLAIMER.md](./DISCLAIMER.md) dosyasina bakin.

## Proje Ozeti

Dashboard, birden fazla finansal varliktan olusan portfoyun getiri, risk, korelasyon, rebalancing, optimizasyon, Monte Carlo simulasyonu ve sirket verisi gibi basliklarini tek ekranda okunabilir hale getirir.

Amac, CV/GitHub portfoyunde hem finansal analiz dusuncesini hem de kullanilabilir dashboard tasarimi ve frontend uygulama becerisini gostermektir.

## One Cikan Ozellikler

- Ticker arama ve lot bazli portfoy olusturma
- Koyu/acik tema destegi
- Finnhub quote verisiyle guncel son fiyat kullanimi
- Yahoo Finance fallback ile gercek fiyat gecmisi
- Finnhub company profile verisinin Company Data sekmesine baglanmasi
- Karar akisi: Overview, Risk, Optimization, Simulation, Analysis, Company Data, Data
- Her ana modulde "Bu ekran neyi cevapliyor?" aciklamasi ve analist yorum kartlari
- Portfoy getiri gelisimi ve varlik bazli ozet
- Risk metrikleri: volatilite, Sharpe, Sortino, maksimum dusus, parametrik VaR (95%, 1 aylık)
- Korelasyon ve risk katkisi gorunumleri
- Rebalancing karsilastirmasi
- Max Sharpe ve minimum risk optimizasyonu
- Monte Carlo simulasyonu ve stres senaryolari
- Sirket profili, quote ve fiyat gecmisi icin local API proxy
- Hafif smoke test ile kritik regresyon kontrolleri

## Teknoloji

- React 18 UMD
- Vite
- Vanilla CSS design tokens
- SVG tabanli grafik componentleri
- Node.js smoke test scripti

## Calistirma

```bash
npm install
npm run dev
```

Ardindan:

```text
http://localhost:8502/
```

Market data proxy:

```bash
set FINNHUB_API_KEY=your_key_here
npm run api
```

Proxy `FINNHUB_API_KEY` degerini environment variable olarak okur. Ayrica local gelistirme icin `.env.local`, `.env` veya `.streamlit/secrets.toml` icinden ayni anahtari okuyabilir. Bu dosyalar repoya eklenmemelidir.

Proxy varsayilan olarak:

```text
http://127.0.0.1:8787/api/health
```

Production build:

```bash
npm run build
```

Smoke test:

```bash
npm run test:smoke
```

API health test:

```bash
npm run test:api
```

History normalization test:

```bash
npm run test:history
```

## Proje Yapisi

```text
.
|-- index.html
|-- package.json
|-- vite.config.js
|-- public/
|   `-- legacy/
|       |-- app.jsx
|       |-- charts.jsx
|       |-- data.jsx
|       |-- sidebar.jsx
|       |-- ui.jsx
|       |-- views-analysis.jsx
|       `-- views-overview.jsx
|-- server/
|   `-- market-data-server.mjs
`-- scripts/
    |-- api-health-check.mjs
    |-- history-normalization-check.mjs
    `-- smoke-check.mjs
```

## Veri Durumu

Mevcut UI gercek veri proxy'si aktif oldugunda canli veri kullanir. Proxy veya saglayici verisi kullanilamazsa deterministik mock market modeli fallback olarak devreye girer. UI, veri durumunu `Real Prices`, `Partial Prices` veya `Mock Prices` olarak gosterir.

Gercek veri entegrasyonu su sinir uzerinden calisir:

- `DATA_SOURCES`
- `createMarketDataAdapter`
- `ACTIVE_DATA_ADAPTER`
- `buildPortfolio(..., { source })`
- `server/market-data-server.mjs`

Finnhub API key tarayiciya gommulmez. Key yalnizca local Node proxy tarafinda `FINNHUB_API_KEY` environment variable olarak okunur.

Hazir proxy endpointleri:

- `GET /api/health`
- `GET /api/market/quote?symbol=AAPL`
- `GET /api/market/candles?symbol=AAPL`
- `GET /api/market/history?symbol=AAPL`
- `GET /api/company/profile?symbol=AAPL`
- `GET /api/company/news?symbol=AAPL`

`/api/market/history` normalize edilmis fiyat gecmisi doner. Once Finnhub candle endpointini dener; erisim yoksa Yahoo Finance chart kaynagina duser. Bu pratikte yfinance'in kullandigi Yahoo Finance fiyat serisi mantigina denk gelen fallback katmanidir.

Frontend tarafinda:

- Portfoy fiyat gecmisi `/api/market/history` uzerinden alinir.
- Guncel son fiyat `/api/market/quote` uzerinden alinir.
- Sirket profili `/api/company/profile` uzerinden Company Data sekmesine baglanir.
- Eksik veri durumunda dashboard kirilmaz; mock/fallback veriyle devam eder.

## Program Neler Yapabilir?

- Sol panelden hisse veya ETF arayip portfoye ekleyebilir.
- Lot bazli portfoy pozisyon degeri hesaplayabilir.
- Ana modulleri soru-cevap akisiyle okutur; her ekran once hangi karari destekledigini anlatir.
- Gercek fiyat gecmisiyle portfoy getiri serisi uretebilir.
- Finnhub quote verisiyle son fiyat ve pozisyon degerini guncelleyebilir.
- Varlik bazli getiri, risk, Sharpe, Sortino, beta ve maksimum dusus metriklerini gosterebilir.
- Portfoy dagilimini ve varlik bazli ozet tablolarini sunabilir.
- Korelasyon, yogunlasma ve risk katkisi analizleri yapabilir.
- Benchmark karsilastirmasi sunabilir.
- Rebalancing karsilastirmasi ve rolling metrikler uretebilir.
- Stres testleriyle portfoyun farkli piyasa senaryolarindaki davranisini gosterebilir.
- Monte Carlo simulasyonu ile olasi donem sonu portfoy degeri dagilimini hesaplayabilir.
- Max Sharpe ve minimum risk optimizasyon alternatiflerini karsilastirabilir.
- Company Data sekmesinde Finnhub company profile verisini gosterebilir.
- API proxy, fiyat gecmisi ve quote/profile durumunu dashboard icinde gosterebilir.
- Data sekmesini teknik audit paneli olarak kullanabilir.
- Koyu ve acik tema arasinda gecis yapabilir.
- Kritik regresyonlari smoke/API/history testleriyle kontrol edebilir.

## Modul Akisi

Dashboard karar odakli bir sirayla okunur:

1. `Overview`: Portfoyun genel degeri, getiri/risk ozeti ve dagilimi.
2. `Risk`: Risk seviyesi kabul edilebilir mi, risk nereden geliyor?
3. `Optimization`: Portfoy daha iyi risk/getiri dengesine tasinabilir mi?
4. `Simulation`: Portfoy gelecekte hangi olasi deger araligina gidebilir?
5. `Analysis`: Gecmis davranisi rolling metrikler, rebalancing ve stress testler ne acikliyor?
6. `Company Data`: Portfoydeki sirketlerin temel profili ne soyluyor?
7. `Data`: Dashboard hangi veriyle calisiyor ve veri sagligi nasil denetleniyor?

## Kalite Kontrolleri

`npm run test:smoke` su riskleri yakalar:

- Legacy script yukleme sirasi bozuldu mu
- Eski Finnhub endpoint etiketleri UI koduna geri dondu mu
- Veri adapter exportlari mevcut mu
- Real proxy metadata'si kayitli mi
- Bos portfoy finite metrik uretiyor mu
- Bilinmeyen ticker filtreleniyor mu
- Veri sekmesi bos portfoyde fiyat serisine erken erisiyor mu
- Karar akisi tab sirasi korunuyor mu
- Modul giris kartlari ve Data audit yapisi korunuyor mu

`npm run test:api` proxy health endpointini, eksik sembol validasyonunu ve API key yokken canli endpointlerin 503 donmesini dogrular.

`npm run test:history` Finnhub ve Yahoo Finance fiyat payload'larinin ortak history formatina donusturuldugunu dogrular.

## Yol Haritasi

1. Haber verisi entegrasyonu
   `/api/company/news` endpointi Company Data sekmesindeki haber kartlarina baglanacak.

2. Modul ayrimi
   Global `window` kullanan legacy JSX dosyalari Vite native ES module yapisina tasinacak.

3. Grafik katmani
   SVG componentleri korunabilir, ancak daha buyuk veri setleri icin chart abstraction iyilestirilecek.

4. Test kapsami
   Smoke testin yanina Playwright tabanli temel browser testleri eklenecek.

5. Finansal model gelisimi
   Risk-free rate, benchmark secimi, transaction cost ve optimizasyon varsayimlari kullaniciya daha kontrollu sunulacak.

## Not

Bu proje yatirim tavsiyesi uretmez. Finansal metrikler ve senaryolar analitik dashboard prototipi gostermek amaciyla sunulur. Model sinirlamalari ve veri kalitesi hakkinda detayli bilgi icin `docs/` klasorundeki belgelere bakin:

- [docs/ARCHITECTURE_AUDIT.md](./docs/ARCHITECTURE_AUDIT.md)
- [docs/DATA_QUALITY_MODEL.md](./docs/DATA_QUALITY_MODEL.md)
- [docs/PRODUCTIZATION_ROADMAP.md](./docs/PRODUCTIZATION_ROADMAP.md)
- [DISCLAIMER.md](./DISCLAIMER.md)
