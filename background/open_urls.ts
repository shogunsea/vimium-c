import {
  framesForTab_, cPort, cRepeat, get_cOptions, set_cOptions, set_cPort, set_cRepeat, set_cEnv,
  lastWndId_, curIncognito_, curTabId_, curWndId_, recencyForTab_, vomnibarBgOptions_, OnFirefox, OnChrome, OnEdge,
  CurCVer_, IsEdg_, paste_, substitute_, newTabUrls_, os_, CONST_, shownHash_, set_shownHash_, newTabUrl_f
} from "./store"
import * as BgUtils_ from "./utils"
import {
  PopWindow, InfoToCreateMultiTab, getGroupId, selectTab, tabsUpdate, isRefusingIncognito_,
  selectFrom, selectWnd, getCurTab, runtimeError_, getTabUrl, getCurWnd, Window, Tabs_,
  Windows_, tabsCreate, openMultiTabs, selectWndIfNeed, makeWindow, browser_, Q_
} from "./browser"
import {
  convertToUrl_, createSearchUrl_, hasUsedKeyword_, lastUrlType_, quotedStringRe_, reformatURL_
} from "./normalize_urls"
import { findUrlEndingWithPunctuation_, findUrlInText_ } from "./parse_urls"
import { safePost, showHUD, complainLimits, findCPort, isNotVomnibarPage, getCurFrames_ } from "./ports"
import { createSimpleUrlMatcher_, matchSimply_ } from "./exclusions"
import { trans_ } from "./i18n"
import { makeCommand_ } from "./key_mappings"
import {
  copyCmdOptions, runNextCmdBy, parseFallbackOptions, replaceCmdOptions, overrideOption, runNextCmd,
  overrideCmdOptions, runNextOnTabLoaded, executeCommand, fillOptionWithMask, sendFgCmd
} from "./run_commands"
import { Marks_ } from "./tools"
import { parseSedOptions_ } from "./clipboard"
import { findLastVisibleWindow_ } from "./filter_tabs"
import C = kBgCmd

type ShowPageData = [string, typeof shownHash_, number]

const ReuseValues: {
  [K in Exclude<UserReuseType & string
        , "newfg" | "new-fg" | "newFg" | "newwindow" | "newWindow" | "new-window"> as NormalizeKeywords<K>]:
      K extends keyof typeof ReuseType ? (typeof ReuseType)[K] : never
} = {
  current: ReuseType.current, reuse: ReuseType.reuse, newwnd: ReuseType.newWnd, frame: ReuseType.frame,
  newbg: ReuseType.newBg, lastwndfg: ReuseType.lastWndFg, lastwnd: ReuseType.lastWndFg,
  lastwndbg: ReuseType.lastWndBg, iflastwnd: ReuseType.ifLastWnd, reuseincurwnd: ReuseType.reuseInCurWnd,
  lastwndbgbg: ReuseType.lastWndBgInactive, lastwndbginactive: ReuseType.lastWndBgInactive
}

/** if not opener, then return `tab.index + 1` by default; otherwise a default position is `undefined` */
export const newTabIndex = (tab: Readonly<Tab>
      , pos: OpenUrlOptions["position"] | UnknownValue, opener: boolean
      , doesGroup: OpenUrlOptions["group"]): number | undefined =>
    pos === "before" || pos === "left" || pos === "prev" || pos === "previous" ? tab.index
    : pos === "after" || pos === "next" || pos === "right" ? tab.index + 1 : pos === "default" ? undefined
    : doesGroup !== false && getGroupId(tab) != null
    // next to the current if no opener - in case of failing in setting group
    ? pos === "start" || pos === "begin" ? tab.index
      : pos === "end" ? undefined
      : (pos satisfies UnknownValue, OnFirefox && opener) ? undefined : tab.index + 1
    : pos === "start" || pos === "begin" ? 0
    : pos === "end" ? opener ? 3e4 : undefined
    /** pos is undefined, or "default" */
    : (pos satisfies UnknownValue, OnFirefox && opener) ? undefined : tab.index + 1

export const preferLastWnd = <T extends Pick<Window, "id">> (wnds: T[]): T => {
  return wnds.find(i => i.id === lastWndId_) || wnds[wnds.length - 1]!
}

export const parseOpenPageUrlOptions = (options: OpenPageUrlOptions): SimpleParsedOpenUrlOptions => ({
  g: options.group, i: options.incognito, m: options.replace,
  o: options.opener, r: options.reuse, p: options.position, w: options.window
})

const normalizeIncognito = (incognito: OpenUrlOptions["incognito"]): boolean | null => {
  return typeof incognito === "boolean" ? incognito
      : !incognito ? null
      : incognito === "force" ? true
      : incognito === "reverse" ? curIncognito_ !== IncognitoType.true
      : incognito === "same" || (incognito satisfies "keep") === "keep" ? curIncognito_ === IncognitoType.true
      : null
}

const normalizeWndType = (wndType: string | boolean | null | undefined): "popup" | "normal" | undefined =>
    wndType === "popup" || wndType === "normal" ? wndType : undefined

export const checkHarmfulUrl_ = (url: string, port?: Port | null): boolean => {
  url = url.slice(0, 128).split("?")[0].replace(<RegExpG> /\\/g, "/")
  let bsod = !!(Build.OS & (1 << kOS.win)) && os_ === kOS.win
      && (<RegExpOne> /\/globalroot\/device\/condrv|\bdevice\/condrv\/kernelconnect/).test(url)
  if (bsod) {
    set_cPort(port || cPort)
    showHUD(trans_("harmfulURL"))
  }
  return bsod
}

const onEvalUrl_ = (workType: Urls.WorkType, options: KnownOptions<C.openUrl>, tabs: [Tab] | [] | undefined
    , arr: Urls.BaseEvalResult): void => {
  const applyOptions = (urls: string[] | null): void => {
    replaceCmdOptions<C.openUrl>(options)
    overrideCmdOptions<C.openUrl>({ urls, url: null, url_f: null, copied: null, keyword: null }, true)
  }
  BgUtils_.resetRe_()
  switch (arr[1]) {
  case Urls.kEval.copy:
    showHUD((arr as Urls.CopyEvalResult)[0], kTip.noTextCopied)
    runNextCmdBy(1, options as {})
    break
  case Urls.kEval.paste:
  case Urls.kEval.plainUrl:
    applyOptions(null)
    if (arr[1] === Urls.kEval.plainUrl || options.$p) {
      workType = Urls.WorkType.Default
    } else { // `.$p` may be computed from clipboard text and then unstable
      overrideOption<C.openUrl, "$p">("$p", 1)
    }
    openUrlWithActions(convertToUrl_((arr as Urls.PasteEvalResult)[0]), workType, false, tabs)
    break
  case Urls.kEval.status:
    if (workType >= Urls.WorkType.EvenAffectStatus && arr[0]) {
      runNextCmdBy(1, options as {})
    }
    break
  case Urls.kEval.run:
    const cmd = (arr as Urls.RunEvalResult)[0]
    const curTab = curTabId_
    if (cmd[0] === "openUrls") {
      const urls = cmd.slice(1) as (string | Urls.BaseEvalResult)[]
      const urls2: string[] = []
      for (let url of urls) {
        if (typeof url !== "string" && (url[1] === Urls.kEval.paste || url[1] === Urls.kEval.plainUrl)) {
          url = convertToUrl_((arr as Urls.PasteEvalResult)[0], null, workType) as string | Urls.BaseEvalResult
        }
        if (typeof url === "string") { urls2.push(url); continue }
        void Promise.resolve(url).then((arr2): void => {
          if (arr2[1] !== Urls.kEval.run || (arr2 as Urls.RunEvalResult)[0][0] !== "openUrls") {
            onEvalUrl_(workType, options, tabs, arr2)
          }
        })
      }
      if (urls2.length === 0) { return }
      applyOptions(urls2)
      tabs && tabs.length > 0 ? openUrls(tabs) : getCurTab(openUrls)
      return
    }
    setTimeout((): void => {
      const frames = framesForTab_.get(curTab)
      const opts: KnownOptions<C.runKey> & SafeObject = BgUtils_.safer_({ keys: [cmd[1]] })
      set_cEnv(null)
      executeCommand(makeCommand_("runKey", opts)!, 1, kKeyCode.None, frames ? frames.cur_ : null, 0, null)
    }, 0)
    break
  }
}

const runNextIf = (succeed: boolean | Tab | Window | undefined, options: OpenUrlOptions | Req.FallbackOptions
    , result?: Tab | null | false): void => {
  succeed ? runNextOnTabLoaded(options, result) : runNextCmdBy(0, options as OpenUrlOptions & Req.FallbackOptions)
}

const safeUpdate = (options: OpenUrlOptions, reuse: ReuseType, url: string
    , secondTimes?: true, tabs1?: [Tab]): void => {
  const callback = (tab?: Tab): void => { runNextIf(tab, options, tab); return runtimeError_() }
  if (!tabs1) {
    if (isRefusingIncognito_(url) && secondTimes !== true) {
      getCurTab(safeUpdate.bind(null, options, reuse, url, true))
      return
    }
  } else if (tabs1.length > 0 && tabs1[0].incognito && isRefusingIncognito_(url)) {
    tabsCreate({ url }, callback)
    return
  }
  if (reuse === ReuseType.frame && cPort && cPort.s.frameId_) {
    sendFgCmd(kFgCmd.framesGoBack, false, { r: 1, u: url })
    return
  }
  tabs1 ? tabsUpdate(tabs1[0].id, { url }, callback) : tabsUpdate({ url }, callback)
}

const makeWindowFrom = (url: string | string[], focused: boolean, incognito: boolean, options: OpenUrlOptions
    , exOpts: chrome.windows.CreateDataEx, wnd: Pick<Window, "state"> | null | undefined): void => {
  makeWindow({ url, focused, incognito,
    type: (typeof url === "string" || url.length === 1) ? normalizeWndType(options.window) : undefined,
    left: exOpts.left, top: exOpts.top, width: exOpts.width, height: exOpts.height
  }, exOpts.state != null ? exOpts.state as chrome.windows.ValidStates
      : wnd && wnd.state !== "minimized" ? wnd.state : "", (wnd2): void => {
    runNextIf(wnd2, options, wnd2 && wnd2.tabs[0])
  })
}

const openUrlInIncognito = (urls: string[], reuse: ReuseType
    , options: Readonly<Pick<OpenUrlOptions, "position" | "opener" | "window" | "group">>
    , tab: Tab | undefined, wnds: Array<Pick<Window, "id" | "focused" | "incognito" | "type" | "state">>): void => {
  const active = reuse !== ReuseType.newBg
  const curWndId = tab ? tab.windowId : curWndId_
  const curWnd = wnds.find(wnd => wnd.id === curWndId), inCurWnd = curWnd != null && curWnd.incognito
  if (!options.window && reuse !== ReuseType.newWnd
      && (inCurWnd || (wnds = wnds.filter(w => w.incognito && w.type === "normal")).length > 0)) {
    const args: InfoToCreateMultiTab & { windowId: number } = {
      url: urls[0], active, windowId: inCurWnd ? curWndId : preferLastWnd(wnds).id
    }
    if (inCurWnd) {
      const opener = options.opener === true
      args.index = newTabIndex(tab!, options.position, opener, options.group)
      opener && (args.openerTabId = tab!.id)
    }
    openMultiTabs(args, cRepeat, true, urls, inCurWnd && options.group, tab, (tab2): void => {
      !inCurWnd && active && selectWnd(tab2)
      runNextIf(tab2, options, tab2)
    })
  } else {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    makeWindowFrom(urls, true, true, options, options as any, curWnd)
  }
}

export const parseReuse = (reuse: UserReuseType | null | undefined): ReuseType =>
    reuse == null ? ReuseType.Default
    : typeof reuse !== "string" ? typeof reuse === "boolean" ? reuse ? ReuseType.reuse : ReuseType.newFg
       : isNaN(+reuse) ? ReuseType.Default : reuse | 0
    : (reuse = reuse.toLowerCase().replace("window", "wnd").replace(<RegExpG & { source: "-" }> /-/g, ""),
      reuse in ReuseValues ? ReuseValues[reuse as keyof typeof ReuseValues] : ReuseType.Default)


const fillUrlMasks = (url: string, tabs: [Tab?] | undefined, url_mask: string | boolean | UnknownValue): string => {
  const tabUrl = tabs && tabs.length > 0 ? getTabUrl(tabs[0]!) : ""
  const masks: Array<string | UnknownValue> = [url_mask !== true ? url_mask === false ? "" : url_mask
      : ((<RegExpI> /[%$]s/i).exec(url) || ["${url_mask}"])[0],
    get_cOptions<C.openUrl>().host_mask || get_cOptions<C.openUrl>().host_mark,
    get_cOptions<C.openUrl>().tabid_mask || get_cOptions<C.openUrl>().tabId_mask
      || get_cOptions<C.openUrl>().tabid_mark || get_cOptions<C.openUrl>().tabId_mark,
    get_cOptions<C.openUrl>().title_mask || get_cOptions<C.openUrl>().title_mark,
    get_cOptions<C.openUrl>().id_mask || get_cOptions<C.openUrl>().id_mark || get_cOptions<C.openUrl>().id_marker
  ]
  const matches: [number, number, string][] = []
  for (let i = 0; i < masks.length; i++) {
    const mask = masks[i] != null ? masks[i] + "" : "", ind = mask ? url.indexOf(mask) : -1
    if (ind >= 0) {
      let end = ind + mask.length
      for (const j of matches) { if (ind < j[1] && end >= j[0]) { continue } }
      matches.push([ ind, end, i === 0
          ? (<RegExpOne> /^[%$]S|^\$\{S:/).test(mask) ? tabUrl : BgUtils_.encodeAsciiComponent_(tabUrl)
          : i === 1 ? new URL(tabUrl).host : i === 2 ? tabUrl && "" + tabs![0]!.id
          : i === 3 ? tabUrl && "" + BgUtils_.encodeAsciiComponent_(tabs![0]!.title) : browser_.runtime.id ])
    }
  }
  if (matches.length) {
    let s = "", lastEnd = 0
    matches.sort((a, b) => a[0] - b[0])
    for (const match of matches) {
      s = s + url.slice(lastEnd, match[0]) + match[2]
      lastEnd = match[1]
    }
    url = s + url.slice(lastEnd)
  }
  return url
}

const openUrlInAnotherWindow = (urls: string[], reuse: Exclude<ReuseType
      , ReuseType.reuse | ReuseType.current | ReuseType.frame | ReuseType.reuseInCurWnd>
    , isCurWndIncognito: boolean
    , options: Readonly<OpenUrlOptions>): void => {
  const incognito = normalizeIncognito(options.incognito)
  let p: Promise<PopWindow | null>
  p = (reuse > ReuseType.OFFSET_LAST_WINDOW ? new Promise<Window | null>(resolve => {
    getCurWnd(false, wnd => (resolve(wnd || null), runtimeError_()))
  }) : findLastVisibleWindow_(normalizeWndType(options.window), true, incognito, curWndId_)).then(wnd => wnd &&
    new Promise(resolve => { Tabs_.query({ active: true, windowId: wnd.id }, tabs => {
      wnd.tabs = tabs; resolve(wnd as PopWindow)
      return runtimeError_()
    }) }))
  void p.then((wnd): void => {
    const isWndLast = !!wnd && !wnd.focused && wnd.id !== curWndId_ // in case a F12 window is focused
    const fallbackInCur = reuse === ReuseType.ifLastWnd && !isWndLast
    if (!wnd || !(isWndLast || reuse === ReuseType.ifLastWnd && (incognito == null || wnd.incognito === !!incognito))) {
      if (reuse === ReuseType.ifLastWnd && runNextCmdBy(0, options as KnownOptions<C.openUrl>)) {
        return
      }
      makeWindowFrom(urls, reuse > ReuseType.lastWndBgInactive, incognito != null ? !!incognito : isCurWndIncognito
          , options, options as any, wnd) // eslint-disable-line @typescript-eslint/no-unsafe-argument
      return
    }
    const curTab = wnd.tabs && wnd.tabs.length > 0 ? selectFrom(wnd.tabs) : null
    openMultiTabs({
      url: urls[0], active: reuse > ReuseType.lastWndBg || fallbackInCur, windowId: wnd.id,
      pinned: !!options.pinned,
      index: curTab ? newTabIndex(curTab, options.position, false, options.group) : undefined
    }, cRepeat, !!options.incognito && typeof options.incognito === "string"
    , urls, options.group, curTab, (newTab): void => {
      if (reuse > ReuseType.lastWndBg) {
        isWndLast && selectWnd(newTab)
      } else if (newTab) {
        reuse > ReuseType.lastWndBgInactive && !fallbackInCur && selectTab(newTab.id)
      }
      runNextIf(newTab, options, reuse > ReuseType.lastWndBg && reuse !== ReuseType.newBg && newTab)
    })
  })
}

const openUrlInNewTab = (urls: string[], reuse: Exclude<ReuseType
      , ReuseType.reuse | ReuseType.current | ReuseType.frame | ReuseType.reuseInCurWnd>
    , options: Readonly<OpenUrlOptions>
    , tabs: [Tab] | [] | undefined): void => {
  const tab: Tab | undefined = tabs && tabs[0], tabIncognito = !!tab && tab.incognito,
  isCurWndIncognito = tabIncognito || curIncognito_ === IncognitoType.true,
  active = reuse !== ReuseType.newBg && reuse !== ReuseType.lastWndBgInactive
  let window: boolean = reuse === ReuseType.newWnd || reuse < ReuseType.OFFSET_LAST_WINDOW + 1 || !!options.window
  let incognito = normalizeIncognito(options.incognito)
  const useForcedIncognito = incognito != null && typeof options.incognito === "string"
  let inReader: boolean | undefined
  if (OnFirefox) {
    for (let i = 0; i < urls.length; i++) {
      if (urls[i].startsWith("about:reader?url=")) {
        urls[i] = BgUtils_.decodeEscapedURL_(urls[i].slice(17))
        inReader = urls.length === 1
      }
    }
  }
  if (!useForcedIncognito && urls.some(isRefusingIncognito_ as (url: string, _?: number) => boolean)) {
    window = isCurWndIncognito || window
  } else if (isCurWndIncognito) {
    window = incognito === false || window
  } else if (incognito) {
    if (reuse > ReuseType.OFFSET_LAST_WINDOW) {
      Windows_.getAll((/*#__NOINLINE__*/ openUrlInIncognito).bind(null, urls, reuse, options, tab))
      return
    }
  }
  if (window) {
    /*#__NOINLINE__*/ openUrlInAnotherWindow(urls, reuse, isCurWndIncognito, options)
    return
  }
  let openerTabId = options.opener && tab ? tab.id : undefined
  const args: InfoToCreateMultiTab = {
    url: urls[0], active, windowId: tab ? tab.windowId : undefined,
    openerTabId, pinned: !!options.pinned,
    index: tab ? newTabIndex(tab, options.position, openerTabId != null, options.group) : undefined
  }
  if (OnFirefox && inReader) {
    (args as chrome.tabs.CreateProperties).openInReaderMode = inReader
  }
  openMultiTabs(args, cRepeat, useForcedIncognito, urls, options.group, tab, (tab2): void => {
    active && tab2 && selectWndIfNeed(tab2)
    runNextIf(tab2, options, active && tab2)
  })
}

const replaceOrOpenInNewTab = <Reuse extends Exclude<ReuseType, ReuseType.current | ReuseType.frame>> (
    url: string, reuse: Reuse, replace: KnownOptions<C.openUrl>["replace"]
    , options: Reuse extends ReuseType.reuse | ReuseType.reuseInCurWnd ? null : KnownOptions<C.openUrl>
    , reuseOptions: Reuse extends ReuseType.reuse | ReuseType.reuseInCurWnd ? MarksNS.FocusOrLaunch : null
    , curTabs?: [Tab] | []): void => {
  const matcher = !replace ? null
      : typeof replace === "string" ? createSimpleUrlMatcher_(replace)
      : typeof replace !== "object" || !replace.t || !replace.v ? null : replace
  const allWindows = reuse === ReuseType.newWnd || reuse === ReuseType.reuse
  const mayReuse = reuse === ReuseType.reuse || reuse === ReuseType.reuseInCurWnd
  const reuseO2 = mayReuse && reuseOptions!.q || {}
  const rawWndType = mayReuse ? reuseO2.w : options!.window
  const wndType = normalizeWndType(rawWndType)
  const incognito = normalizeIncognito(mayReuse ? reuseO2.i : options!.incognito)
  // here it's by intent to make .group default to false
  const useGroup = (mayReuse ? reuseO2.g : options!.group) === true
  set_cRepeat(1)
  if (mayReuse) { reuseO2.m = null; reuseO2.g = useGroup }
  else {
    overrideOption<C.openUrl>("group", useGroup, options!)
    if (options!.replace != null) { overrideOption<C.openUrl>("replace", matcher!, options!) }
  }
  let p: Promise<Pick<Window, "id"> | null>
  if (reuse < ReuseType.OFFSET_LAST_WINDOW + 1 && matcher) {
    p = findLastVisibleWindow_(wndType, reuse === ReuseType.ifLastWnd, incognito, curWndId_)
        .then(wnd => wnd && !(wnd instanceof Array) ? wnd : null)
  } else {
    p = Promise.resolve(!allWindows && curWndId_ >= 0 ? {id: curWndId_} : null)
  }
  void Promise.all([p, !useGroup || curTabs ? null : new Promise<void>(resolve => {
    getCurTab(curTabs2 => { curTabs = curTabs2 || []; resolve() })
  })]).then<Tab | null>(([preferredWnd, _]) => !matcher || !preferredWnd && !allWindows ? null : new Promise(r => {
    Tabs_.query(preferredWnd ? { windowId: preferredWnd.id } : {
      windowType: wndType || undefined
    }, (tabs): void => {
      const refused = incognito != null ? !incognito
          : reuse > ReuseType.OFFSET_LAST_WINDOW ? curIncognito_ !== IncognitoType.true : -2
      let matched = (tabs || []).filter(tab => matchSimply_(matcher, tab.url) && tab.incognito !== refused)
      if (useGroup && matched.length > 0 && curTabs!.length > 0) {
        const curGroup = getGroupId(curTabs![0]!)
        tabs && (matched = matched.filter(tab => getGroupId(tab) === curGroup))
      }
      matched.sort((a, b) => {
        const cachedB = recencyForTab_.get(b.id), cachedA = recencyForTab_.get(a.id)
        return cachedA ? cachedB ? cachedB - cachedA : 1 : cachedB ? -1 : b.id - a.id
      })
      if (reuse === ReuseType.reuse) {
        const inCurWnd = matched.filter(tab => tab.windowId === curWndId_)
        matched = inCurWnd.length > 0 ? inCurWnd : matched
      }
      r(matched.length ? matched[0] : null)
      return runtimeError_()
    })
  })).then<void>(matchedTab => {
    if (matchedTab == null || matchedTab.id === curTabId_ && !mayReuse) {
      mayReuse ? focusOrLaunch_(reuseOptions!)
      : runNextCmdBy(0, options!) ? 0
      : curTabs ? openUrlInNewTab([url], reuse, options!, curTabs)
      : getCurTab(openUrlInNewTab.bind(null, [url], reuse, options!))
    } else if (shownHash_ && matchedTab.url.startsWith(CONST_.ShowPage_)) {
      updateShownPage(mayReuse ? reuseOptions!.f || {} : options!, matchedTab)
    } else {
      const active = reuse !== ReuseType.newBg && reuse !== ReuseType.lastWndBgInactive
      const activeWnd = matchedTab.windowId !== curWndId_ && reuse > ReuseType.lastWndBg
      tabsUpdate(matchedTab.id, { url }, (newTab): void => {
        if (newTab) {
          active && (selectTab(newTab.id), newTab.active = true)
          activeWnd && selectWnd(newTab)
        }
        runNextIf(newTab, mayReuse ? reuseOptions!.f || {} : options!
            , reuse !== ReuseType.newBg && reuse > ReuseType.lastWndBg && newTab)
        return runtimeError_()
      })
    }
  })
}

export const openJSUrl = (url: string, options: Req.FallbackOptions, onBrowserFail?: (() => void) | null
    , reuse?: ReuseType): void => {
  if ((<RegExpOne> /^(void|\(void\))? ?(0|\(0\))?;?$/).test(url.slice(11).trim())) { runNextCmdBy(1, options); return }
  if (!onBrowserFail && cPort) {
    reuse === ReuseType.current && set_cPort(getCurFrames_()?.top_ || cPort)
    if (safePost(cPort, { N: kBgReq.eval, u: url, f: parseFallbackOptions(options)})) { return }
    if (reuse !== ReuseType.Default) { runNextCmdBy(0, options); return }
    set_cPort(null as never)
  }
  const callback1 = (opt?: object | -1): void => {
    if (opt !== -1 && !runtimeError_()) { runNextOnTabLoaded(options, null); return; }
    const code = BgUtils_.DecodeURLPart_(url.slice(11))
    void (Build.MV3 ? Promise.resolve(/* todo: */) : Q_(Tabs_.executeScript, { code })).then((result): void => {
      result === undefined && onBrowserFail && onBrowserFail()
      runNextIf(!!result, options, null)
    })
    return runtimeError_()
  }
  // e.g.: use Chrome omnibox at once on starting
  if (OnChrome && Build.MinCVer < BrowserVer.Min$Tabs$$Update$DoesNotAcceptJavaScriptURLs &&
      CurCVer_ < BrowserVer.Min$Tabs$$Update$DoesNotAcceptJavaScriptURLs) {
    tabsUpdate({ url }, callback1)
  } else {
    callback1(-1)
  }
}

export const openShowPage = (url: string, reuse: ReuseType, options: KnownOptions<C.openUrl>
    , _tab?: Tab | null): boolean => {
  const prefix = CONST_.ShowPage_
  if (url.length < prefix.length + 3 || !url.startsWith(prefix)) { return false; }
  if (_tab === void 0) {
    getCurTab(function (tabs: [Tab]): void {
      const reuse2 = tabs && tabs.length > 0 || reuse === ReuseType.newBg ? reuse : ReuseType.newFg
      openShowPage(url, reuse2, options, tabs && tabs[0] || null)
      return runtimeError_()
    })
    return true
  }
  url = url.slice(prefix.length)
  const incognito = _tab ? _tab.incognito : curIncognito_ === IncognitoType.true
  if (url.startsWith("#!image ") && incognito) {
    url = "#!image incognito=1&" + url.slice(8).trim()
  }
  const arr: ShowPageData = [url, null, 0]
  set_shownHash_(arr[1] = () => {
    clearTimeout(arr[2])
    set_shownHash_(null)
    return arr[0]
  })
  arr[2] = setTimeout(() => {
    arr[0] = "#!url vimium://error (vimium://show: sorry, the info has expired.)"
    arr[2] = setTimeout(function () {
      if (shownHash_ === arr[1]) { set_shownHash_(null) }
      arr[0] = "", arr[1] = null
    }, 2000)
  }, 1200)
  set_cRepeat(1)
  if (reuse === ReuseType.current || reuse === ReuseType.frame
      || incognito && (reuse === ReuseType.newBg || reuse === ReuseType.newFg)) {
    !incognito ? updateShownPage(options, _tab!) :
    /* safe-for-group */ tabsCreate({ url: prefix, active: reuse !== ReuseType.newBg }, newTab => {
      runNextIf(newTab, options, newTab)
    })
  } else {
    OnFirefox && (options.group = false)
    options.incognito = false
    reuse === ReuseType.reuse || reuse === ReuseType.reuseInCurWnd ? replaceOrOpenInNewTab(url, reuse, options.replace
        , null, { u: prefix, p: options.prefix, q: parseOpenPageUrlOptions(options), f: parseFallbackOptions(options)
        }, _tab ? [_tab] : void 0)
    : openUrlInNewTab([prefix], reuse, options, _tab ? [_tab] : void 0)
  }
  return true
}

const updateShownPage = (options: Req.FallbackOptions, tab: Tab): void => {
    const prefix = CONST_.ShowPage_
    let views = !Build.MV3 && !OnEdge && (!OnChrome
              || Build.MinCVer >= BrowserVer.Min$Extension$$GetView$AcceptsTabId
              || CurCVer_ >= BrowserVer.Min$Extension$$GetView$AcceptsTabId)
          && !tab.url.split("#", 2)[1]
      ? browser_.extension.getViews({ tabId: tab.id }) : []
    if (!OnEdge && views.length > 0
        && views[0].location.href.startsWith(prefix) && views[0].onhashchange as unknown) {
      (views[0].onhashchange as () => void)()
      selectTab(tab.id)
    } else {
      tabsUpdate(tab.id, { url: prefix, active: true })
    }
    BgUtils_.nextTick_((): void => { runNextOnTabLoaded(options, null) })
}

// use Urls.WorkType.Default
const openUrls = (tabs: [Tab] | [] | undefined): void => {
  const options = get_cOptions<C.openUrl, true>()
  let urls: string[] = options.urls!
  if (options.$fmt !== 2) {
    if (options.$fmt !== 1) {
      for (let i = 0; i < urls.length; i++) { urls[i] = convertToUrl_(urls[i] + "") }
    }
    if (OnFirefox) {
      urls = urls.filter(i => !newTabUrls_.has(i) && !(<RegExpI> /file:\/\//i).test(i))
      overrideOption<C.openUrl, "urls">("urls", urls)
    }
    overrideOption<C.openUrl, "$fmt">("$fmt", 2)
  }
  for (const url of urls) {
    if (checkHarmfulUrl_(url)) {
      return runtimeError_()
    }
  }
  const rawReuse = parseReuse(options.reuse)
  const reuse = rawReuse === ReuseType.reuse || rawReuse === ReuseType.current || rawReuse === ReuseType.frame
      || rawReuse === ReuseType.reuseInCurWnd ? ReuseType.newFg : rawReuse
  set_cOptions(null)
  openUrlInNewTab(urls, reuse, options, tabs)
}

export const openUrlWithActions = (url: Urls.Url, workType: Urls.WorkType, sed?: boolean, tabs?: [Tab] | []): void => {
  if (typeof url !== "string") { /* empty */ }
  else if (url || workType !== Urls.WorkType.FakeType) {
    const fill = fillOptionWithMask<C.openUrl>(url, get_cOptions<C.openUrl>().mask
        , "value", ["url", "url_mask", "url_mark", "value"], cRepeat)
    if (fill.ok) {
      url = fill.result
      if (fill.useCount) { set_cRepeat(1) }
    }
    let url_mask = get_cOptions<C.openUrl>().url_mask, umark = get_cOptions<C.openUrl>().url_mark
    if (url_mask != null || umark != null) {
      url = /*#__NOINLINE__*/ fillUrlMasks(url, tabs, url_mask != null ? url_mask : umark!)
    }
    if (sed) {
      const postSed = parseSedOptions_(get_cOptions<C.openUrl, true>())
      url = substitute_(url, SedContext.NONE, postSed)
    }
    if (workType !== Urls.WorkType.FakeType) {
      const keyword = (get_cOptions<C.openUrl>().keyword as AllowToString || "") + ""
      const testUrl = get_cOptions<C.openUrl>().testUrl ?? !keyword
      const isSpecialKW = !!keyword && keyword !== "~"
      url = testUrl ? convertToUrl_(url, keyword, workType)
          : createSearchUrl_(url.trim().split(BgUtils_.spacesRe_), keyword
              , isSpecialKW ? Urls.WorkType.KeepAll : workType)
      url = testUrl || !isSpecialKW ? url : convertToUrl_(url as string, null
          , hasUsedKeyword_ && (url as string).startsWith("vimium:") ? Urls.WorkType.EvenAffectStatus : workType)
    }
    const goNext = get_cOptions<C.openUrl, true>().goNext
    if (goNext && url && typeof url === "string") {
      url = substitute_(url, SedContext.goNext)
      url = goToNextUrl(url, cRepeat, goNext === "absolute")[1]
    }
    url = typeof url === "string" ? reformatURL_(url) : url
  } else {
    url = newTabUrl_f
  }
  let options = get_cOptions<C.openUrl, true>(), reuse: ReuseType = parseReuse(options.reuse)
  set_cOptions(null)
  BgUtils_.resetRe_()
  if (OnFirefox && typeof url === "string" && url.startsWith("about:reader?url=")) {
    reuse = reuse !== ReuseType.newBg ? ReuseType.newFg : reuse
  }
  typeof url !== "string"
      ? url instanceof Promise ? url.then(onEvalUrl_.bind(0, workType, options, tabs))
        : /*#__NOINLINE__*/ onEvalUrl_(workType, options, tabs, url)
      : /*#__NOINLINE__*/ openShowPage(url, reuse, options) ? 0
      : BgUtils_.isJSUrl_(url) ? /*#__NOINLINE__*/ openJSUrl(url, options, null, reuse)
      : checkHarmfulUrl_(url) ? runNextCmdBy(0, options)
      : reuse === ReuseType.reuse || reuse === ReuseType.reuseInCurWnd
        ? replaceOrOpenInNewTab(url, reuse, options.replace, null
            , { u: url, p: options.prefix, q: parseOpenPageUrlOptions(options), f: parseFallbackOptions(options)}, tabs)
      : reuse === ReuseType.current || reuse === ReuseType.frame ? /*#__NOINLINE__*/ safeUpdate(options, reuse, url)
      : options.replace ? replaceOrOpenInNewTab(url, reuse, options.replace, options, null, tabs)
      : tabs ? openUrlInNewTab([url], reuse, options, tabs)
      : getCurTab(openUrlInNewTab.bind(null, [url], reuse, options))

}

const openCopiedUrl = (tabs: [Tab] | [] | undefined, url: string | null): void => {
  if (url === null) {
    complainLimits("read clipboard")
    runNextCmd<C.openUrl>(0)
    return
  }
  if (!(url = url.trim())) {
    showHUD(trans_("noCopied"))
    runNextCmd<C.openUrl>(0)
    return
  }
  let urls: string[]
  const copied = get_cOptions<C.openUrl>().copied, searchLines = typeof copied === "string" && copied.includes("any")
  if ((copied === "urls" || searchLines) && (urls = url.split(<RegExpG> /[\r\n]+/g)).length > 1) {
    const urls2: string[] = [], keyword = searchLines && get_cOptions<C.openUrl>().keyword
        ? get_cOptions<C.openUrl>().keyword + "" : null
    let has_err = false
    for (let i of urls) {
      i = i.trim()
      if (i) {
        i = convertToUrl_(i, keyword, Urls.WorkType.Default)
        if (searchLines || lastUrlType_ <= Urls.Type.MaxOfInputIsPlainUrl) {
          urls2.push(i)
        } else {
          urls2.length = 0
          has_err = true
          break
        }
      }
    }
    if (urls2.length > 1) {
      set_cOptions(copyCmdOptions(BgUtils_.safeObj_(), get_cOptions<C.openUrl>()))
      get_cOptions<C.openUrl, true>().urls = urls2
      get_cOptions<C.openUrl, true>().$fmt = 1
      tabs && tabs.length > 0 ? openUrls(tabs) : getCurTab(openUrls)
      return
    }
    if (has_err) {
      if (! runNextCmd<C.openUrl>(0)) {
        showHUD("The copied lines are not URLs")
      }
      return
    }
  }
  if (quotedStringRe_.test(url)) {
    url = url.slice(1, -1)
  } else {
    const _rawTest = get_cOptions<C.openUrl>().testUrl
    if (_rawTest != null ? _rawTest : !get_cOptions<C.openUrl>().keyword) {
      url = findUrlInText_(url, _rawTest)
    }
  }
  let start = url.indexOf("://") + 3
  if (start > 3 && BgUtils_.protocolRe_.test(url)) {
    url = (<RegExpOne> /^ttps?:/i).test(url) ? "h" + url : url
    // an origin with "/"
    let arr: RegExpExecArray | null
    const end = url.indexOf("/", start) + 1 || url.length,
    host = url.slice(start, end),
    type = host.startsWith("0.0.0.0") ? 7
        : host.includes(":::") && (arr = (<RegExpOne> /^(\[?::\]?):\d{2,5}$/).exec(host))
        ? arr[1].length : 0
    url = type ? url.slice(0, start) + (type > 6 ? "127.0.0.1" : "[::1]") + url.slice(start + type) : url
  }
  openUrlWithActions(url, Urls.WorkType.ActAnyway, false, tabs)
}

export const goToNextUrl = (url: string, count: number, abs?: boolean): [found: boolean, newUrl: string] => {
  let matched = false
  let re = <RegExpSearchable<4>> /\$(?:\{(\d+)[,\/#@](\d*):(\d*)(:-?\d*)?\}|\$)/g
  url = url.replace(<RegExpG & RegExpSearchable<4>> re, (s, n, min, end, t): string => {
    if (s === "$$") { return "$" }
    matched = true
    let cur = n && parseInt(n) || 1
    let mini = min && parseInt(min) || 0
    let endi = end && parseInt(end) || 0
    let stepi = t && parseInt(t.slice(1)) || 1
    stepi < 0 && ([mini, endi] = [endi, mini])
    count *= stepi
    cur = !abs ? cur + count : count > 0 ? mini + count - 1 : count < 0 ? endi + count : cur
    return "" + Math.max(mini || 1, Math.min(cur, endi ? endi - 1 : cur))
  })
  return [matched, url]
}

export const openUrl = (tabs?: [Tab] | []): void => {
  if (get_cOptions<C.openUrl>().urls) {
    if (get_cOptions<C.openUrl>().urls instanceof Array) {
      tabs && tabs.length > 0 ? openUrls(tabs) : getCurTab(openUrls)
    }
    return
  }
  if ((get_cOptions<C.openUrl>().url_mask != null || get_cOptions<C.openUrl>().url_mark != null) && !tabs) {
    return runtimeError_() || <any> void getCurTab(openUrl)
  }
  let rawUrl = get_cOptions<C.openUrl>().url
  if (rawUrl) {
    openUrlWithActions(rawUrl as AllowToString + "", Urls.WorkType.EvenAffectStatus, true, tabs)
  } else if (get_cOptions<C.openUrl>().copied) {
    const url = paste_(parseSedOptions_(get_cOptions<C.openUrl, true>()))
    if (url instanceof Promise) {
      void url.then(/*#__NOINLINE__*/ openCopiedUrl.bind(null, tabs))
    } else {
      openCopiedUrl(tabs, url)
    }
  } else {
    let url_f = get_cOptions<C.openUrl, true>().url_f!
    openUrlWithActions(url_f || "", Urls.WorkType.FakeType, false, tabs)
  }
}

export const openUrlReq = (request: FgReq[kFgReq.openUrl], port?: Port | null): void => {
  BgUtils_.safer_(request)
  let isWeb = port != null && isNotVomnibarPage(port, true)
  set_cPort(isWeb ? port! : findCPort(port) || cPort)
  let url: Urls.Url | undefined = request.u || ""
  // { url_f: string, ... } | { copied: true, ... }
  const opts: KnownOptions<C.openUrl> = request.n && parseFallbackOptions(request.n) || {}
  const o2: Readonly<Partial<FgReq[kFgReq.openUrl]["o"]>> = request.o || BgUtils_.safeObj_() as {}
  const keyword = (o2.k || "") + "", testUrl = o2.t ?? !keyword
  const sed = o2.s
  const hintMode = request.m || HintMode.DEFAULT
  const mode1 = hintMode < HintMode.min_disable_queue ? hintMode & ~HintMode.queue : hintMode
  const formatted = request.f != null ? request.f : mode1 === HintMode.OPEN_INCOGNITO_LINK
  opts.group = isWeb ? o2.g : true
  opts.incognito = normalizeIncognito(o2.i) != null ? o2.i : mode1 === HintMode.OPEN_INCOGNITO_LINK || null
  opts.replace = o2.m
  opts.position = o2.p
  opts.reuse = o2.r != null ? o2.r : !hintMode ? request.r
      : request.t === "window" ? ReuseType.newWnd
      : (hintMode & HintMode.queue ? ReuseType.newBg : ReuseType.newFg)
        + (request.t === "last-window" ? ReuseType.OFFSET_LAST_WINDOW : 0)
  opts.window = o2.w
  if (url || !isWeb) {
    if (url[0] === ":" && !isWeb && (<RegExpOne> /^:[bhtwWBHdso]\s/).test(url)) {
      url = request.u = url.slice(2).trim()
    }
    const originalUrl = url
    url = testUrl ? findUrlEndingWithPunctuation_(url, formatted) : url
    url = substitute_(url, !isWeb ? /** from input bar */ testUrl ? SedContext.omni : SedContext.NONE
          : formatted ? SedContext.pageURL : SedContext.pageText, sed)
    let converted: boolean
    if (formatted) {
      url = (converted = url !== originalUrl) ? convertToUrl_(url, null, Urls.WorkType.ConvertKnown) : url
    } else if (converted = !!testUrl || !isWeb && !keyword) {
      url = testUrl ? findUrlInText_(url, testUrl) : url
      url = convertToUrl_(url, keyword, isWeb ? Urls.WorkType.ConvertKnown : Urls.WorkType.EvenAffectStatus)
    } else {
      url = createSearchUrl_(url.trim().split(BgUtils_.spacesRe_), keyword
          , keyword && keyword !== "~" ? Urls.WorkType.ConvertKnown : Urls.WorkType.Default)
      converted = hasUsedKeyword_
      url = !converted ? url : convertToUrl_(url as string, null, (url as string).startsWith("vimium:")
                ? Urls.WorkType.EvenAffectStatus : Urls.WorkType.Default)
    }
    if (!converted) { /* empty */ }
    else if ((lastUrlType_ === Urls.Type.NoScheme || lastUrlType_ === Urls.Type.NoProtocolName) && request.h != null) {
      url = (request.h ? "https" : "http") + (url as string).slice((url as string)[4] === "s" ? 5 : 4)
    } else if (lastUrlType_ === Urls.Type.PlainVimium && (url as string).startsWith("vimium:")
        && !originalUrl.startsWith("vimium://")) {
      url = convertToUrl_(url as string, null, hasUsedKeyword_ || (url as string).startsWith("vimium://run")
          ? Urls.WorkType.EvenAffectStatus : Urls.WorkType.Default)
    }
    opts.opener = isWeb ? o2.o !== false : vomnibarBgOptions_.actions.includes("opener")
    opts.url_f = url
  } else {
    if (request.c === false) { return }
    opts.copied = request.c != null ? request.c : true, opts.keyword = keyword, opts.testUrl = o2.t
    opts.sed = sed
  }
  set_cRepeat(1)
  replaceCmdOptions(opts)
  openUrl()
}

//#region focusOrLaunch

/** safe when cPort is null */
export const focusOrLaunch_ = (request: FgReq[kFgReq.focusOrLaunch], port?: Port | null): void => {

const onMatchedTabs = (tabs: Tab[]): void => {
  const incongito = normalizeIncognito(opts2.i) ?? (curIncognito_ !== IncognitoType.true ? false : null)
  tabs = tabs || []
  if (incongito !== null) { tabs = tabs.filter(tab => tab.incognito === incongito) }
  if (opts2.g && curTabs.length > 0) {
    const curGroup = getGroupId(curTabs[0])
    tabs = tabs.filter(tab => getGroupId(tab) === curGroup)
  }
  if (tabs.length > 0) {
    const tabs2 = tabs.filter(tab2 => tab2.windowId === curWndId_)
    updateMatchedTab(tabs2.length > 0 ? tabs2 : tabs)
    return
  }
  const notInCurWnd = curIncognito_ === IncognitoType.true && isRefusingIncognito_(request.u)
  // if `request.s`, then `typeof request` is `MarksNS.MarkToGo`
  if (request.f && runNextCmdBy(0, request.f)) { /* empty */ }
  else if (curTabs.length <= 0 || opts2.w
      || curIncognito_ === IncognitoType.true && !curTabs[0].incognito) {
    makeWindow({ url: request.u, type: normalizeWndType(opts2.w),
      incognito: notInCurWnd ? false : curIncognito_ === IncognitoType.true
    }, "", (wnd): void => {
      callback(wnd && wnd.tabs && wnd.tabs.length > 0 ? wnd.tabs[0] : null)
    })
  } else if (notInCurWnd) {
    openMultiTabs({ url: request.u, active: true }, 1, null, [null], opts2.g, null, callback)
  } else {
    openMultiTabs({
      url: request.u, index: newTabIndex(curTabs[0], opts2.p, false, true),
      openerTabId: opts2.o && curTabs[0] ? curTabs[0].id : undefined,
      windowId: curTabs[0].windowId, active: true
    }, 1, null, [null], opts2.g, curTabs[0], callback)
  }
  return runtimeError_()
}

const updateMatchedTab = (tabs2: Tab[]): void => {
  const url = request.u
  request.p && tabs2.sort((a, b) => a.url.length - b.url.length)
  let tab: Tab = selectFrom(tabs2)
  if (tab.url.length > tabs2[0].url.length) { tab = tabs2[0]; }
  if (OnChrome
      && url.startsWith(CONST_.OptionsPage_) && !framesForTab_.get(tab.id) && !request.s) {
    /* safe-for-group */ tabsCreate({ url }, callback)
    Tabs_.remove(tab.id)
  } else if (shownHash_ && tab.url.startsWith(CONST_.ShowPage_)) {
    updateShownPage(request.f || {}, tab)
    selectWndIfNeed(tab)
  } else {
    const cur = OnChrome && IsEdg_ ? tab.url.replace(<RegExpOne> /^edge:/, "chrome:") : tab.url
    const wanted = OnChrome && IsEdg_ ? url.replace(<RegExpOne> /^edge:/, "chrome:") : url
    finallyMatched = cur.startsWith(wanted)
    tabsUpdate(tab.id, {
      url: finallyMatched ? undefined : url, active: true
    }, callback)
    selectWndIfNeed(tab)
  }
}

const callback = (tab?: Tab | null): void => {
  if (!tab) { request.f && runNextCmdBy(0, request.f); return runtimeError_(); }
  runNextOnTabLoaded(request.f || {}, tab, request.s && ((): void => {
    Marks_.scrollTab_(request as MarksNS.MarkToGo, tab, kKeyCode.None, finallyMatched)
  }))
}

  let curTabs: [Tab] | never[]
  let finallyMatched = false
  // * do not limit windowId or windowType
  let toTest = reformatURL_(request.u.split("#", 1)[0])
  if (checkHarmfulUrl_(toTest, port)) {
    return
  }
  const opts2 = request.q || (request.q = {})
  if (opts2.g == null || toTest.startsWith(CONST_.OptionsPage_)) {
    opts2.g = false // disable group detection by default
  }
  const reuse = opts2.r != null && parseReuse(opts2.r) || ReuseType.reuse
  if (opts2.m) {
    replaceOrOpenInNewTab(request.u, reuse !== ReuseType.frame ? reuse : ReuseType.reuse, opts2.m, null, request)
    return
  }
  void Q_(getCurTab).then(async (curTabs1): Promise<void> => {
    curTabs = curTabs1!
    const allTests = [], wndId = reuse === ReuseType.reuseInCurWnd && curWndId_ >= 0 ? curWndId_ : undefined
    let toTest2 = toTest, windowType = normalizeWndType(opts2.w) || "normal"
    if (BgUtils_.protocolRe_.test(toTest)) {
      let i = toTest.indexOf("/") + 2, j = toTest.indexOf("/", i + 1), host = toTest.slice(i, j > 0 ? j : void 0)
      if (host && host.includes("@")) { toTest2 = toTest = toTest.slice(0, i) + host.split("@")[1] + toTest.slice(j) }
      if (OnFirefox && host.includes(":")) { toTest2 = toTest.slice(0, i) + host.split(":")[0] + toTest.slice(j) }
    }
  if ((toTest.startsWith("file:") || toTest.startsWith("ftp")) && !toTest.includes(".", toTest.lastIndexOf("/") + 1)) {
      allTests.push(toTest2 + (request.p ? "/*" : "/"))
      OnFirefox && toTest2 !== toTest && allTests.push(toTest + (request.p ? "/*" : "/"))
  }
    allTests.push(request.p ? toTest2 + "*" : toTest2)
    OnFirefox && toTest2 !== toTest && allTests.push(request.p ? toTest + "*" : toTest)
  // if no .replace, then only search in normal windows by intent
    for (let cond of allTests) {
      let matched = await Q_(Tabs_.query, { url: cond, windowType, windowId: wndId })
      if (OnFirefox && matched && matched.length) { matched = matched.filter(i => i.url.startsWith(toTest)) }
      if (matched && matched.length > 0) { return onMatchedTabs(matched) }
    }
    onMatchedTabs([])
  })
}

//#endregion
