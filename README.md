# Randish

Randishは、「何を食べるか決められない」ときに、条件に合う飲食店を探して選べるアプリです。現在地やジャンルなどを使って店を検索し、ルーレットで選べます。

## 構成

- `mobile/`：Expo・React Native製のスマートフォンアプリ
- `server/`：Spring Boot製のAPIサーバー
- `supabase/`：データベースのマイグレーション

アプリはAPIサーバーを通じて飲食店情報やユーザー情報を取得します。飲食店検索にはHot PepperやGeoapifyを使い、設定に応じてGoogle Placesにも対応します。

## ローカルで起動する

### APIサーバー

```powershell
cd server
mvn spring-boot:run
```

APIは `http://localhost:8080` で起動します。

### スマートフォンアプリ

別のターミナルで実行します。

```powershell
cd mobile
npm install
npm run start
```

Expo Goを実機で使う場合は、アプリからアクセスするAPIのURLにPCのローカルIPアドレスを指定してください。例：`http://192.168.1.23:8080`。スマートフォンとPCは同じWi-Fiに接続してください。

## APIキーなどの設定

必要に応じて `.env.example` を参考に `.env.local` を作成し、APIキーやデータベース接続情報を設定します。Google Placesなどの秘密鍵はサーバー側だけに置き、アプリに含めないでください。

`.env.local`、APIキー、パスワードなどの秘密情報はGitに登録しないでください。

## 関連資料

- [データベース設計](server/docs/database-design.md)
- [負荷テスト](loadtest/README.md)
