# Edge Functions

## `nearby-places` の試験

近隣・地図検索をSupabase Edge Functionsで試すための仮APIです。既存アプリのAPI接続先は変更せず、Postmanから既存の `/api/places/nearby` と結果を比較できます。

### 登録する秘密情報

Supabase CLIでログインし、対象プロジェクトをリンクしてから以下を設定します。

```powershell
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set RANDISH_EDGE_TEST_TOKEN="Postmanで使う長いランダム文字列"
supabase secrets set GEOAPIFY_API_KEY="GeoapifyのAPIキー"
supabase secrets set HOTPEPPER_API_KEY="Hot PepperのAPIキー"
```

Google Placesも試すときだけ設定します。課金が発生する可能性があるため、明示的に有効化した場合だけ呼び出します。

```powershell
supabase secrets set GOOGLE_PLACES_API_KEY="Google PlacesのAPIキー"
supabase secrets set RANDISH_GOOGLE_PLACES_ENABLED="true"
```

登録したらデプロイします。

```powershell
supabase functions deploy nearby-places --project-ref YOUR_PROJECT_REF
```

### Postmanから呼び出す

- Method: `POST`
- URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/nearby-places`
- Headers:
  - `Content-Type`: `application/json`
  - `apikey`: Supabaseの公開 anon key
  - `x-randish-test-token`: `RANDISH_EDGE_TEST_TOKEN` に設定した値
- Body: `raw` / `JSON`

```json
{
  "latitude": 34.7025,
  "longitude": 135.4959,
  "radius": 3000,
  "category": "ラーメン",
  "priceRange": "any",
  "openNow": false
}
```

`diagnostics.providers` に提供元ごとの設定状態・件数が返ります。提供元ごとのエラーは `diagnostics.errors` で確認できます。試験用トークンが未登録の場合、関数はリクエストを拒否します。

## 試験版の範囲

- Hot Pepper、Geoapifyを並行して検索し、Google Placesはキーと有効化フラグの両方がある場合だけ追加検索します。
- 既存APIと同じ候補の基本形式を返します。
- キャッシュはまだありません。Postmanでリクエストするたび、設定済みの各提供元APIを呼び出します。Google Placesは課金に注意してください。
- 既存APIと同等のPremium判定、写真の補完などはまだ移していません。結果を比べてから機能を移し、アプリの接続先を切り替えます。
- `verify_jwt` は試験用に無効にしています。`x-randish-test-token` を必須にし、試験用トークンをアプリや公開コードに入れないでください。
