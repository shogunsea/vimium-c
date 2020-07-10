<span style="color: #2f508e;">Vim</span>ium <span style="color: #a55e18;">C</span>
![Icon](icons/icon32.png) - All by Keyboard
===========================================

[![Version](https://img.shields.io/github/v/release/gdh1995/vimium-c?color=critical&label=gdh1995%2Fvimium-c&logo=GitHub
  )](https://github.com/gdh1995/vimium-c/releases)
[![MIT license](https://img.shields.io/badge/license-MIT-blue)](LICENSE.txt)
[![GitHub stars](https://img.shields.io/github/stars/gdh1995/vimium-c?logo=GitHub&labelColor=181717&color=orange
  )](https://github.com/gdh1995/vimium-c/stargazers)
[![Gitee star](https://gitee.com/gdh1995/vimium-c/badge/star.svg?theme=dark
  )](https://gitee.com/gdh1995/vimium-c/stargazers)
[![Current build status](https://travis-ci.org/gdh1995/vimium-c.svg?branch=master
  )](https://travis-ci.org/gdh1995/vimium-c)

[![Firefox users](https://img.shields.io/amo/users/vimium-c@gdh1995.cn?label=Firefox%2063%2B&logo=Mozilla%20Firefox&labelColor=FF7139&logoColor=white
  )](https://addons.mozilla.org/firefox/addon/vimium-c/)
[![Firefox rating](https://img.shields.io/amo/rating/vimium-c@gdh1995.cn?logo=Mozilla%20Firefox&labelColor=FF7139&logoColor=white&color=blue
  )](https://addons.mozilla.org/firefox/addon/vimium-c/reviews/)
[![Chrome users](https://img.shields.io/chrome-web-store/users/hfjbmagddngcpeloejdejnfgbamkjaeg?labelColor=4285F4&label=Chrome%2043%2B&logo=Google%20Chrome&logoColor=white&color=critical
  )](https://chrome.google.com/webstore/detail/vimium-c-all-by-keyboard/hfjbmagddngcpeloejdejnfgbamkjaeg)
[![Chrome rating](https://img.shields.io/chrome-web-store/rating/hfjbmagddngcpeloejdejnfgbamkjaeg?logo=Google%20Chrome&labelColor=4285F4&logoColor=white&color=critical
  )](https://chrome.google.com/webstore/detail/vimium-c-all-by-keyboard/hfjbmagddngcpeloejdejnfgbamkjaeg)
[![Chrome rating count](https://img.shields.io/chrome-web-store/rating-count/hfjbmagddngcpeloejdejnfgbamkjaeg?logo=Google%20Chrome&labelColor=4285F4&logoColor=white&color=critical
  )](https://chrome.google.com/webstore/detail/vimium-c-all-by-keyboard/hfjbmagddngcpeloejdejnfgbamkjaeg/reviews)

**Visit on [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/vimium-c/) /
[Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/aibcglbfblnogfjhbcmmpobjhnomhcdo) /
[Chrome Web Store](https://chrome.google.com/webstore/detail/vimium-c-all-by-keyboard/hfjbmagddngcpeloejdejnfgbamkjaeg
  )**

A <span style="color: #a55e18;">C</span>ustomized
  [<span style="color: #2f508e;">Vim</span>ium](https://github.com/philc/vimium)
  (to click web page content and manipulate browser windows using only keyboard)
  having <span style="color: #a55e18;">**C**</span>hinese support,
    global <span style="color: #a55e18;">**C**</span>ommands
    and inje**c**tion functionality,
  in <span style="color: #a55e18;">**C**</span>-style code for qui**c**ker action and less resource **c**ost.

[<span style="color: #2f508e;">Vim</span>ium](https://github.com/philc/vimium) 的一款<span
  style="color: #a55e18;">修改版</span>（可以用键盘点击网页内容、操作浏览器窗口），添加了完整的<span
  style="color: #a55e18;">中文</span>支持、<span
  style="color: #a55e18;">全局快捷键</span>功能，还能运行在某些接受Vimium C的扩展程序的私有页面里，并且对CPU和内存资源的<span
  style="color: #a55e18;">消耗很低</span>。

[阅读中文介绍 (description in Chinese) 。](README_zh.md)

This project is mainly developed and maintained by [gdh1995](https://github.com/gdh1995),
and licensed under the [MIT license](LICENSE.txt).

本项目主要由 [gdh1995](https://github.com/gdh1995) 开发并维护，且以 [MIT 许可协议](LICENSE.txt) 开源。

It (the released version) supports the new MS Edge, Chrome and other Chromium-based browsers
  whose core versions are >= 43, and has a prefect support for a recent Firefox (since version 63.0).
It can even run on MS Edge (EdgeHTML), though there're still some errors.
If re-compiled from the source code, Vimium C is able to support Chromium 32~42.

它支持内核版本不低于 43 的新版 Microsoft Edge、Chrome 和其它以 Chromium 为内核的浏览器，
同时也能完美运行在近些年发布的 Firefox 63 和更高版本上，甚至在 Edge (EdgeHTML 内核) 上也能正常执行大部分命令。
如果从源码重新编译，Vimum C 还可以支持 Chromium 32~42。

![Usage Demo of Vimium C](https://gdh1995.cn/vimium-c/demo.gif)

An old name of this project is "Vimium++", which has been given up on 2018-08-21.


# Project Introduction

__<span style="color: #2f508e;">Vim</span>ium <span style="color: #a55e18;">C</span>:__

* [中文介绍 (description in Chinese)](README_zh.md)
* a web extension for Chrome and Firefox that provides keyboard-based navigation and control
    of the web, in the spirit of the Vim editor.
* add some powerful functions and provide more configurable details and convenience.
* here is its [license](LICENSE.txt) and [privacy policy](PRIVACY-POLICY.md)
* the initial code is forked from [philc/vimium:master](https://github.com/philc/vimium) on 2014.
* customized after translating it from CoffeeScript into JavaScript and then TypeScript.

__Other extensions supporting Vimium C:__

* PDF Viewer for Vimium C
  : a modified version of [PDF Viewer](
      https://chrome.google.com/webstore/detail/pdf-viewer/oemmndcbldboiebfnladdacbdfmadadm)
    from [PDF.js](https://github.com/mozilla/pdf.js/)
  * Visit it on [Chrome Web Store](
      https://chrome.google.com/webstore/detail/pdf-viewer-for-vimium-c/nacjakoppgmdcpemlfnfegmlhipddanj)
* Shortcut Forwarding Tool
  * Provide 32 configurable shortcuts and forward them to another extension like Vimium C
  * Visit it on [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/shortcut-forwarding-tool/) /
    [Chrome Web Store](
      https://chrome.google.com/webstore/detail/shortcut-forwarding-tool/clnalilglegcjmlgenoppklmfppddien)
* NewTab Adapter
  * Take over browser's new tab settings and open another configurable URL
  * Visit it on [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/newtab-adapter/) /
    [Chrome Web Store](https://chrome.google.com/webstore/detail/newtab-adapter/cglpcedifkgalfdklahhcchnjepcckfn)
* Modified Weidu New Tab (微度新标签页修改版)
  : a modified and lite version of [www.weidunewtab.com](http://www.weidunewtab.com/) (or
      [www.newtabplus.com](http://www.newtabplus.com/) )
  * Visit it on [Chrome Web Store](
      https://chrome.google.com/webstore/detail/微度新标签页修改版/hdnehngglnbnehkfcidabjckinphnief)


# Release Notes

#### 1.84.0
* LinkHints: **better compatibility with Firefox popup blocker** in "newtab" mode
* now **support the high contrast mode** on Firefox and Edge (Chromium)
  ([#191](https://github.com/gdh1995/vimium-c/issues/191))
* fix some bugs, including a regression of custom CSS and broken <kbd>Tab</kbd> during `focusInput`
* substitution rules: extend its usages
  * support post-actions like `decode/unescape/upper/lower/reverse`
  * the syntax is `s/query/replaced/i,decode,upper,reverse`: repeatly append a <kbd>,</kbd> and an action
  * most related commands supports `sedKey: character` to filter pre-defined rules
  * now the prefix of a rule can include up to 6 any English letters, and the rule gets used if only `sedKey` is in it
* `focusInput`: add option `prefer: CSS selector` to choose a desired input
* Vomnibar: use <kbd>Meta+N</kbd> to select the N-th item, like Alfred
* Vomnibar: add an option `incognito=null/boolean/"reverse"` ([#195](https://github.com/gdh1995/vimium-c/issues/195))
* Marks: now allow some host pages to report scrolling position and jump to marks in their own ways
  ([#193](https://github.com/gdh1995/vimium-c/issues/193))
* the UI of options page: use flat mode
* build: record arguments to be able to reproduce the same package, in order to meet requirements of Firefox Add-ons

See more on [RELEASE-NOTES.md](RELEASE-NOTES.md).

### Known Issues

There're some known issues on previous or latest versions of Chrome,
and please read https://github.com/gdh1995/vimium-c/wiki/Known-issues-on-various-versions-of-Chrome
  for more information.


# Building

If you want to compile this project manually, please run:

``` bash
npm install typescript
npm install pngjs # only needed for Chromium-based browsers
node scripts/tsc
# ./scripts/make.sh vimium_c-debug.zip
```

`gulp local` can also compile files in place (using configurable build options),
while `gulp dist` compiles and minimizes files into `dist/`.

The options including `MinCVer` and `BTypes` in [gulp.tsconfig.json](scripts/gulp.tsconfig.json)
  are used to control supported target browsers and set a minimum browser version.


# Donate / 捐赠

<a name="donate"></a>
Vimium C is an open-source browser extension, and everyone can install and use it free of charge.
If you indeed want to give its author ([gdh1995@qq.com](https://github.com/gdh1995)) financial support,
you may donate any small amount of money to him through
  [Open Collective](https://opencollective.com/vimium-c), [PayPal](https://www.paypal.me/gdh1995)
  or [Alipay](https://intl.alipay.com/). Thanks a lot!

Vimium C 是一款开源的浏览器扩展程序，任何人都可以安装使用它而无需支付任何费用。
如果您确实想要资助它的开发者（[gdh1995@qq.com](https://github.com/gdh1995)），
可以通过[支付宝](https://www.alipay.com/)、[Open Collective](https://opencollective.com/vimium-c)
或 [PayPal](https://www.paypal.me/gdh1995) 无偿赠与他一小笔钱。谢谢您的支持！

A donation list is in / 捐赠列表详见: https://github.com/gdh1995/vimium-c/wiki/Donation-List .

![gdh1995 的支付宝二维码](https://gdh1995.cn/alipay-recv-money.png)
![PayPal QRCode of gdh1995](https://gdh1995.cn/paypal-recv-money.png)

# Thanks & Licenses

Vimium C: Copyright (c) Dahan Gong, Phil Crosby, Ilya Sukhar.
See the [MIT LICENSE](LICENSE.txt) for details.

* [Vimium](https://github.com/philc/vimium):
  Copyright (c) 2010 Phil Crosby, Ilya Sukhar.
  Licensed under the [MIT license](https://github.com/philc/vimium/blob/master/MIT-LICENSE.txt).
* [TypeScript](https://github.com/Microsoft/TypeScript):
    and modified `es.d.ts`, `es/*`, `dom.d.ts` and `chrome.d.ts` in `types/`:
  Copyright (c) Microsoft Corporation (All rights reserved).
  Licensed under the [Apache License 2.0](https://github.com/microsoft/TypeScript/blob/master/LICENSE.txt).
  See more on [www.typescriptlang.org](http://www.typescriptlang.org/).
* [Viewer.js](https://github.com/fengyuanchen/viewerjs)
  ([Modified](https://github.com/gdh1995/viewerjs)):
  Copyright (c) 2015-present Chen Fengyuan.
  Licensed under the [MIT license](https://github.com/fengyuanchen/viewerjs/blob/master/LICENSE).
* [JavaScript Expression Evaluator](https://github.com/silentmatt/expr-eval)
  ([Modified](https://github.com/gdh1995/js-expression-eval)):
  Copyright (c) 2015 Matthew Crumley.
  Licensed under the [MIT license](
    https://github.com/silentmatt/expr-eval/blob/4327f05412a3046a9b527b6ec3b50843cb0428e8/LICENSE.txt).
* The orange picture in the icon is from https://pixabay.com/vectors/orange-fruit-mandarin-citrus-fruit-158258/
* [微度新标签页](http://www.weidunewtab.com/):
  (c) 2012 杭州佐拉网络有限公司 保留所有权利.
* [PDF.js](https://github.com/mozilla/pdf.js/):
  Copyright (c) Mozilla and individual contributors.
  Licensed under the [Apache License 2.0](https://github.com/mozilla/pdf.js/blob/master/LICENSE).

# Declaration for Applicable Regions

The [Vimium C](https://microsoftedge.microsoft.com/addons/detail/vimium-c/aibcglbfblnogfjhbcmmpobjhnomhcdo)
    and other extensions published by [gdh1995](https://github.com/gdh1995)
    are available for all people in *"all regions"*
    of Microsoft Edge Add-ons, Chrome Web Store and some other markets.
This behavior is only to make these extensions easier to use, but<br>
**DOES NOT EXPRESS OR IMPLIED** the author (gdh1995) "agrees or has no objection to"
    that "Taiwan" can be parallel to "China",
    which was an **inappropriate** status quo in the stores' pages on 2019-11-16.

According to [The Constitution of the People's Republic of China](
    http://www.npc.gov.cn/npc/c505/201803/e87e5cd7c1ce46ef866f4ec8e2d709ea.shtml)
    and international consensus,
*Taiwan is **an inalienable part** of the sacred territory of the People's Republic of China*.
