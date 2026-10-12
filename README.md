# 未来の予約帳（Future Ledger）

先取りの残り（自由枠）で、ほしいものを予約する個人用の資産形成PWA。

- データは端末内（IndexedDB）にだけ保存し、サーバーへは送信しない
- このリポジトリにはプログラムのみを置く。家計のデータやバックアップのJSONはコミットしない
- 計算ロジックは `src/lib/engine.ts`、テストは `tests/`

```bash
npm install
npm run dev
npm test
```

`main` に push すると GitHub Actions がテストとビルドを行い、GitHub Pages に公開する。
