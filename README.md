# 音声文字起こしツール

Groq Whisper APIを活用し、Web Audio APIで音声を分割して並列処理により高速な文字起こしを実現するWebアプリケーションです。

## 主な機能

### 🎵 音声アップロード
- **対応形式**: MP3, WAV, M4A, OGG, FLAC
- **ファイルサイズ**: 最大100MB
- **ドラッグ&ドロップ対応**

### ⚡ 高速並列処理
- **Web Audio API**による音声分割（30秒〜2分間隔）
- **最大10並列**でのAPI呼び出し
- **1時間の音声を10-15分**で処理完了

### 📝 結果表示・編集
- **タイムスタンプ付き**テキスト表示
- **インライン編集**機能
- **テキスト内検索**
- **セグメント別表示**

### 📤 エクスポート機能
- **TXT**: プレーンテキスト
- **SRT**: 字幕ファイル（SubRip）
- **VTT**: Web字幕（WebVTT）
- **JSON**: 詳細データ付き

## 技術スタック

- **フロントエンド**: React + Next.js 14 (App Router)
- **UI**: Tailwind CSS + shadcn/ui
- **音声処理**: Web Audio API
- **API**: Groq Whisper API
- **言語**: TypeScript

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

```bash
# .env.localファイルを作成
cp .env.example .env.local
```

`.env.local`にGroq APIキーを設定:

```env
GROQ_API_KEY=your_groq_api_key_here
```

**Groq APIキーの取得方法**:
1. [Groq Console](https://console.groq.com/)にアクセス
2. アカウント作成・ログイン
3. API Keysページでキーを生成

### 3. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

## 使用方法

1. **音声ファイルをアップロード**
   - ドラッグ&ドロップまたはファイル選択

2. **処理設定を調整**
   - セグメント長（30秒/60秒/120秒）
   - 並列処理数（3〜10）
   - 言語設定（日本語/英語/自動検出）

3. **文字起こし開始**
   - 「文字起こしを開始」ボタンをクリック

4. **結果確認・編集**
   - テキスト編集
   - セグメント別表示
   - 検索機能

5. **エクスポート**
   - お好みの形式でダウンロード

## パフォーマンス

- **処理速度**: 1時間の音声 → 10-15分で完了
- **並列処理**: 最大10セグメント同時処理
- **メモリ効率**: ブラウザリソース最適化

## 対応ブラウザ

- Chrome/Edge: フル対応
- Firefox: フル対応
- Safari: フル対応（Web Audio API制限あり）

## 開発

### ビルド

```bash
npm run build
```

### リント

```bash
npm run lint
```

### 型チェック

```bash
npx tsc --noEmit
```

## デプロイ

### Vercel（推奨）

1. Vercelにプロジェクトをインポート
2. 環境変数`GROQ_API_KEY`を設定
3. デプロイ

```bash
# Vercel CLIの場合
vercel --prod
```

## ライセンス

MIT License

## 貢献

1. フォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. コミット (`git commit -m 'Add some amazing feature'`)
4. プッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## サポート

問題が発生した場合は、GitHubのIssuesページで報告してください。

---

**Powered by Groq Whisper API + Next.js 14 + Web Audio API**