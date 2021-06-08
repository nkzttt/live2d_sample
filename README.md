# LIVE2D SAMPLE FOR WEB

## はじめに

[公式サイト](https://www.live2d.com/download/cubism-sdk/download-web/)にて使用許諾契約をご確認の上、ご自身で Cubism Core for Web をダウンロードしてください。

## 動作サンプル
[https://nkzttt.github.io/live2d_sample/sample/](https://nkzttt.github.io/live2d_sample/sample/)

## 使い方

1. html に `id="l2d"` を付与した要素を任意の場所に配置します。
1. ビルドした js ファイルを body 閉じタグの上で読み込みます。
1. 1 の下に `script` タグを追加し、 `window.Live2DConfig` を以下のように定義します。

``` js
window.Live2DConfig = {
  moc: '.moc3 のパス',
  texture: 'テクスチャ画像のパス',
  motion: '.motion3.json のパス',
};
```

その他の機能は解析中です・・・