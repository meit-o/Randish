# Supabase Edge Functions

## nearby-places

地図の近くにある飲食店候補を Hot Pepper と Geoapify から取得する API です。両者で0件のときだけ、設定で有効にした Google Places を検索します。

### ローカル・Postmanでの確認

Supabase CLI で対象プロジェクトをリンクし、API キーを登録して関数をデプロイします。

```powershell
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set GEOAPIFY_API_KEY="GeoapifyのAPIキー"
supabase secrets set HOTPEPPER_API_KEY="Hot PepperのAPIキー"
supabase functions deploy nearby-places --project-ref YOUR_PROJECT_REF
```

Hot Pepper・Geoapify に掲載が少ない地域でも探す場合、Google Places を追加できます。Google の利用料金と上限を確認してから、Supabase の Secrets に登録してください。

```powershell
supabase secrets set GOOGLE_PLACES_API_KEY="Google PlacesのAPIキー"
supabase secrets set RANDISH_GOOGLE_PLACES_ENABLED="true"
supabase functions deploy nearby-places --remote=YOUR_PROJECT_REF
```

Postman は `POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/nearby-places` に JSON を送ります。

Headers:

- `apikey`: Supabase の publishable key（旧 anon key）
- `Authorization`: `Bearer <Supabase Auth の access token>`
- `Content-Type`: `application/json`

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

レスポンスの `places` に店舗候補、`diagnostics.providers` に各プロバイダーの取得件数が入ります。

## アプリから段階的に使う

`mobile/.env` に次の値を設定してアプリを再起動すると、ログイン中の地図検索だけ Edge Function を先に呼びます。未ログイン時や Edge Function が失敗した場合は Render の `/api/places/nearby` にフォールバックします。その他の API は引き続き Render を使います。

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

ローカルで Render 側の API も使う場合は、`EXPO_PUBLIC_RANDISH_API_BASE_URL=https://randish-api.onrender.com` も設定します。Edge Function が0件を返した場合、実店舗候補があれば Render の結果を採用します。

publishable key はクライアントに含まれる公開キーです。Hot Pepper・Geoapify のキーや Supabase secret key はここに設定しないでください。

## 移行の範囲と注意

- 現在 Edge Function が置き換えるのは地図・近隣検索だけです。候補一覧、抽選、認証、履歴、保存、課金などは Render API のままです。
- アプリ設定を入れる前は既存の Render API を使います。
- Supabase Auth の有効な access token を `Authorization` に送ります。関数は Supabase Auth でそのトークンを確認してから外部 API を呼びます。
- キャッシュは Edge Function の実行インスタンス内で 2 分保持します。インスタンスが切り替わるとキャッシュも消えます。
- Edge Function のコード変更は Supabase に自動反映されません。変更後は CLI で再デプロイが必要です。
