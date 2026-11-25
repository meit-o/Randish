---
name: ENISHI Web
description: 深緑と白で、日常の縁を静かに支える日本語Web UI
colors:
  primary: "#1b4b3e"
  primary-hover: "#123b30"
  text: "#293d34"
  muted: "#647269"
  page: "#f6f8f6"
  surface: "#ffffff"
  pale: "#edf3ee"
  line: "#e2e8e2"
  danger: "#a83d35"
  danger-hover: "#852d27"
  focus: "#8ab49b"
  button-light: "#f8faf5"
  button-light-hover: "#dde8dc"
  outline-line: "#cbd9cc"
  outline-hover: "#edf3ec"
  nav-text: "#5e6c62"
  nav-hover: "#f4f7f3"
  nav-active: "#eaf1e9"
  chip-selected: "#e4eedf"
  chip-selected-line: "#aac2a6"
  paper: "#fffefa"
  paper-line: "#e4e5d6"
  scroll-thumb: "#8da891"
  scroll-thumb-hover: "#627f69"
typography:
  headline:
    fontFamily: '"Noto Sans JP", sans-serif'
    fontSize: "1.85rem"
    fontWeight: 600
    lineHeight: 1.6
    letterSpacing: "0.025em"
  title:
    fontFamily: '"Noto Sans JP", sans-serif'
    fontSize: "1.13rem"
    fontWeight: 600
    lineHeight: 1.7
  body:
    fontFamily: '"Noto Sans JP", sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.9
  label:
    fontFamily: '"Noto Sans JP", sans-serif'
    fontSize: "0.85rem"
    fontWeight: 500
  button:
    fontFamily: '"Noto Sans JP", sans-serif'
    fontSize: "0.85rem"
    fontWeight: 500
    lineHeight: 1.5
  quiet:
    fontFamily: '"Noto Sans JP", sans-serif'
    fontSize: "0.81rem"
    lineHeight: 1.8
  wordmark:
    fontFamily: "Georgia, serif"
    fontSize: "1.75rem"
    letterSpacing: "0.14em"
rounded:
  tag: "4px"
  control: "7px"
  floating-menu: "8px"
  navigation: "9px"
  card: "12px"
  panel: "14px"
  round: "50%"
spacing:
  gap-8: "8px"
  gap-12: "12px"
  gap-16: "16px"
  gap-20: "20px"
  gap-24: "24px"
  gap-28: "28px"
  gap-30: "30px"
  gap-35: "35px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "11px 20px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-light:
    backgroundColor: "{colors.button-light}"
    textColor: "{colors.primary}"
    rounded: "{rounded.control}"
    padding: "9px 17px"
  button-light-hover:
    backgroundColor: "{colors.button-light-hover}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "11px 20px"
  button-outline-hover:
    backgroundColor: "{colors.outline-hover}"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.surface}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "11px 20px"
  button-danger-hover:
    backgroundColor: "{colors.danger-hover}"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    padding: "5px 0"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "12px 13px"
    width: "100%"
  navigation:
    backgroundColor: "transparent"
    textColor: "{colors.nav-text}"
    rounded: "{rounded.navigation}"
    padding: "14px 17px"
    width: "100%"
  navigation-active:
    backgroundColor: "{colors.nav-active}"
    textColor: "{colors.primary}"
  chip:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  chip-selected:
    backgroundColor: "{colors.chip-selected}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "30px"
  spot-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
  paper:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.card}"
    padding: "26px 28px"
  stay-panel:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "28px 30px"
---

# Design System: ENISHI Web

## Overview

**Creative North Star: "日本の図書館の閲覧室"**

深緑と白の落ち着いた雰囲気を、広い余白、読みやすい日本語、静かな線で表す。白い作業面に深緑の操作を置き、淡い緑で補足と選択状態を支える。Noto Sans JPの本文・操作と、GeorgiaのENISHIワードマークを組み合わせる。

対象は追加した**ENISHIのWeb／専用APIを使う画面**。既存RandishモバイルUIには適用しない。記録の根拠は `web/src/main.jsx` と `web/src/style.css` の完成実装、確認済みブランド方針は `PRODUCT.md` と `docs/ENISHI.surface.md`。限定的な仕上げレビューを、全画面・全状態の監査済みという意味には広げない。

**Key Characteristics:**

- 深緑の主操作、白い作業面、淡緑の補助面。
- 日本語サンセリフと、ロゴに限ったセリフの組み合わせ。
- 3本の重なる輪郭と、控えめな状態変化。
- 通常の面は線と色で区切り、影は一時的な浮遊UIに使う。

## Colors

緑を帯びたニュートラルを土台に、主操作の深緑を明確に立てる。値の正本は上のトークン。

### Primary

- **深緑** (`primary` / `primary-hover`)：主ボタン、滞在パネル、ロゴ、選択状態。濃いhover色で操作への反応を示す。
- **淡緑** (`pale`、`nav-active`、`chip-selected`)：補助面・選択面。白い背景との区別を控えめに保つ。
- **危険操作の赤** (`danger` / `danger-hover`)：削除・退会などの操作とエラー。ブランドの第二アクセントとして装飾に使わない。

### Neutral

- **緑墨** (`text`) と **補助の灰緑** (`muted`)：本文と補足を分ける。薄い装飾色を本文色として継承しない。
- **白** (`surface`)、**薄緑のページ** (`page`)、**手紙の生成り** (`paper`)：作業面、外側、置き手紙の面を区別する。
- **薄い境界** (`line`)、**フォーカスの緑** (`focus`)：面の区切りとキーボード操作の位置を示す。
- スクロールバーも淡緑のトラックと灰緑のつまみに揃える。チャット内部には別の淡緑の組み合わせがある。

## Typography

**Body / Controls:** Noto Sans JP, sans-serif。ルートは16px。本文段落はbody、標準のページ見出しはheadline、節見出しはtitle、補足はquietのトークンを使う。フォーム入力は0.91rem、長文の説明・手紙は0.95remで行間2.2の実装がある。

**Wordmark:** Georgia, serif。ENISHIの文字とフッターのブランド表記に使う。日本語の見出しをこのロゴ用書体へ置き換えない。

ページ見出しは760px以下で1.55rem・行間1.65。ロゴ、認証コピー、滞在パネルには固有のサイズがあり、ページ見出しの尺度を一律に当てない。

## Layout

デスクトップは固定サイドバー242px、本文最大幅1500px。標準本文余白は上下左右を37px / 43px / 48pxとし、ヘッダーは高さ79px。主要領域は可変列と補助列、カード一覧は2〜3列を使い分ける。繰り返す間隔はspacingの実測値を参照し、単一の等間隔グリッドは仮定しない。

- 1500px以上：本文余白を45px 55pxへ広げる。
- 1200px以下：サイドバー215px、本文余白30px 28px。人物カードは1列。
- 1000px以下：ホームの主領域・詳細画面は1列へ。補助内容を下へ移す。
- 760px以下：サイドバーを隠し、上部の小型ロゴと固定の5項目ボトムナビへ。本文余白28px 20px 30px、カード一覧は1列。フッター・トーストに下部ナビのための余白を確保する。

## Elevation & Depth

通常のカードは影を付けず、境界線と白・淡緑・生成りの面で奥行きを作る。メニュー、トースト、ダイアログだけに柔らかい影がある。正確な3種の影とダイアログ背景はsidecarに記録する。チェックイン状態の点にある輪状の光は、面を浮かせる影ではなく状態表示。

**The Quiet Surface Rule.** 通常のコンテンツ面は線と色で区切り、浮遊UIの影を一般カードへ広げない。

## Shapes

操作部は小さな角丸、カードと大きなパネルは一段大きい角丸。タグはtag、ボタン・入力・チップはcontrol、ナビはnavigation、施設・手紙はcard、大型パネル・ダイアログはpanelのトークンに従う。アバター・状態点・アイコンの器は円形。写真は器に沿って切り抜く。

**The Three Outlines Rule.** ENISHIマークと滞在モチーフは、中央を共有する3本の楕円輪郭を重ねる。傾きは−35度・0度・35度。塗りつぶした人や位置の表示に読み替えない。認証面では3つの円を横に重ねた関連表現がある。

## Components

### Buttons

主ボタンは深緑と白、標準最小高44px。淡色は緑の面上、アウトラインは補助操作、赤は危険操作に使う。テキスト操作は枠を持たない。hoverは背景・文字・境界を0.18秒で変化させる。disabledは不許可カーソルと不透明度0.5。キーボードのfocus-visibleは3pxの緑の輪郭、4pxの離隔を保つ。

### Chips / Tags

フィルターチップは白い面と線、選択時は淡緑の面と緑の境界。カテゴリタブは選択時に深緑と白へ切り替える。手紙の小さなタグは状態表示であり、ボタンとして見せない。

### Cards / Containers

通常パネルは白と薄い線。施設カードは写真と説明を分け、写真hover時だけ明度を0.92へ落とす。置き手紙は生成りの面と紙色の線を使い、本文の改行を保つ。カード全体に浮遊影を追加しない。

### Inputs / Fields

白地、緑灰色の1px線、controlの角丸、paddingはinputトークン。プレースホルダーはmuted。textareaは縦にリサイズできる。検索欄は複合の器として9pxの角丸を使い、focus-withinに2pxの線・3pxの離隔を付ける。エラーは赤い日本語の文で示す。

### Navigation

サイドバーの選択項目は淡緑の面、深緑の文字、太さ600。hoverはさらに薄い緑。モバイルの5項目ナビはアイコンと短いラベルを縦に並べ、選択時の文字と線を深緑にする。アイコンはインラインSVGの線画で、装飾的な絵文字へ置き換えない。

### Stay Panel / Shared Chrome

深緑の滞在パネルは、白い見出し、薄緑の補足、淡色の操作、背景の3本輪郭で構成する。輪郭は本文の背後に置く。共通スクロールバーはテーマの緑に揃える。動きは状態フィードバックに限定し、prefers-reduced-motionではtransitionと滑らかなスクロールを無効にする。

## Do's and Don'ts

### Do:

- **Do** 深緑の操作、白い作業面、淡緑の補助面の役割を維持する。
- **Do** 3本の重なる輪郭、線画SVG、ENISHIワードマークの関係を保つ。
- **Do** 日本語の操作を具体的に書き、フォーカス表示と小画面のナビ余白を引き継ぐ。

### Don't:

- **Don't** 通常カードを、浮遊メニューやダイアログと同じ影で持ち上げる。
- **Don't** ロゴ用のGeorgiaを日本語本文・ページ見出しへ広げる。
- **Don't** このENISHI専用の記録を、既存Randishモバイル画面のデザイン規則として適用する。
