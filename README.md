# Perheen työtila

Yhteinen, kevyt perhesovellus: kauppalistat ja tehtävälistat, jotka päivittyvät
reaaliajassa kaikkien laitteissa. Sanelu ja tekoälysiistiminen, kuvien liittäminen,
ei raskasta kirjautumista – riittää osoite, perhe-PIN ja oman nimen valinta.

Käyttäjät: Antti, Katja, Iisakki, Eelis, Meea, Petra.

---

## Mitä tarvitset

- Supabase-tili (ilmainen taso riittää)
- Netlify-tili (ilmainen taso riittää)
- Anthropic API -avain (sanelun siistimiseen, maksaa senttejä/käyttö)

Asennus vie noin 20 minuuttia. Mitään ei tarvitse osata koodata – riittää
kopioida arvoja paikasta toiseen.

---

## Vaihe 1 – Supabase (tietokanta)

1. Kirjaudu osoitteeseen <https://supabase.com> ja luo uusi projekti (New project).
   Valitse alueeksi esim. *Frankfurt (eu-central-1)*. Odota että projekti käynnistyy.
2. Avaa vasemmalta **SQL Editor** → **New query**.
3. Avaa tästä projektista tiedosto `supabase/schema.sql`, kopioi koko sisältö
   editoriin ja paina **Run**. Tämä luo taulut, reaaliaikaisuuden ja kuvakansion.
4. Avaa **Project Settings → API**. Ota talteen kaksi arvoa:
   - **Project URL** (esim. `https://abcd.supabase.co`)
   - **anon public** -avain (pitkä merkkijono)

> Kuvat tallentuvat automaattisesti `kuvat`-bucketiin, jonka SQL loi. Jos haluat
> tarkistaa, se näkyy kohdassa **Storage**.

---

## Vaihe 2 – Anthropic API -avain (sanelun siistiminen)

1. Mene <https://console.anthropic.com> → **API Keys** → luo uusi avain.
2. Ota avain talteen (alkaa `sk-ant-...`). **Älä** laita tätä mihinkään
   selaimessa näkyvään – se annetaan vain Netlifylle vaiheessa 4.

---

## Vaihe 3 – Vie koodi GitHubiin (helpoin tapa Netlifylle)

Vaihtoehto A (suositus): luo GitHubiin uusi tyhjä repo ja työnnä tämä kansio sinne.
Vaihtoehto B: voit myös raahata kansion suoraan Netlifyn käyttöliittymään
(Add new site → Deploy manually), mutta tällöin sanelufunktio ja automaattiset
buildit jäävät pois – GitHub on parempi.

---

## Vaihe 4 – Netlify (julkaisu)

1. Kirjaudu <https://netlify.com> → **Add new site → Import an existing project**
   → valitse GitHub-repo.
2. Build-asetukset tunnistuvat automaattisesti (`netlify.toml`):
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
3. Avaa **Site configuration → Environment variables** ja lisää nämä:

   | Nimi | Arvo |
   |------|------|
   | `VITE_SUPABASE_URL` | Supabasen Project URL |
   | `VITE_SUPABASE_ANON_KEY` | Supabasen anon public -avain |
   | `VITE_FAMILY_PIN` | Perheen yhteinen koodi, esim. `2468` |
   | `ANTHROPIC_API_KEY` | Anthropic-avain `sk-ant-...` |

4. Paina **Deploy**. Hetken kuluttua saat osoitteen, esim.
   `https://perheen-tyotila.netlify.app`. Voit halutessasi vaihtaa nimen
   kohdasta **Domain management**.

Valmis. Jaa osoite ja PIN perheelle.

---

## Käyttö puhelimessa

- Avaa osoite Safarilla (iPhone) tai Chromella (Android).
- **Lisää kotinäytölle** → sovellus avautuu kuin oikea appi.
- Ensimmäisellä kerralla: syötä PIN ja valitse oma nimi. Valinta muistetaan.
- Sanele mikrofoninapilla: puhu lista kerralla ("maitoa, kaks leipää, banaaneja"),
  tekoäly pilkkoo ne erillisiksi riveiksi, joista jokainen voidaan ruksia kaupassa.
- Kuvan voi liittää riville kameranapilla (otat kuvan tai valitset kirjastosta).
- Kun useampi on kaupassa eri kärryillä, ruksaukset näkyvät toisilla heti.

---

## Paikallinen kehitys (valinnainen)

```bash
npm install
cp .env.example .env     # täytä arvot
npm run dev
```

Sanelun siistiminen tarvitsee Netlify-funktion. Aja paikallisesti koko paketti:

```bash
npm install -g netlify-cli
netlify dev
```

---

## Laajentaminen myöhemmin

Sama rakenne kantaa Muistilistat- ja Kalenteri-kategoriat: ne ovat jo etusivulla
"Tulossa"-merkinnällä. Datamalli (`lists` + `items`) toimii sellaisenaan
muistilistoille; kalenteri vaatii oman pienen lisänsä. Perheenjäsenet ja
kategoriat määritellään tiedostossa `src/config.js`.

## Tietoturva lyhyesti

Sovellus käyttää Supabasen julkista anon-avainta ja yhteistä perhe-PINiä.
Tämä on tarkoituksella kevyt ratkaisu perhekäyttöön: kuka tahansa osoitteen
**ja** PINin tietävä pääsee sisään. Älä jaa osoitetta ja PINiä ulkopuolisille.
Anthropic-avain ei koskaan päädy selaimeen – sitä käyttää vain palvelinfunktio.
