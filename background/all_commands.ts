import {
  cPort, cRepeat, cKey, get_cOptions, set_cPort, set_cRepeat, cNeedConfirm, contentPayload_, framesForTab_,
  framesForOmni_, bgC_, set_bgC_, set_cmdInfo_, curIncognito_, curTabId_, recencyForTab_, settingsCache_, CurCVer_,
  OnChrome, OnFirefox, OnEdge, substitute_, CONST_, curWndId_
} from "./store"
import * as BgUtils_ from "./utils"
import {
  Tabs_, Windows_, InfoToCreateMultiTab, openMultiTabs, tabsGet, getTabUrl, selectFrom, runtimeError_, R_,
  selectTab, getCurWnd, getCurTab, getCurShownTabs_, browserSessions_, browser_, selectWndIfNeed,
  getGroupId, isRefusingIncognito_, Q_, isNotHidden_, ShownTab
} from "./browser"
import { createSearchUrl_ } from "./normalize_urls"
import { parseSearchUrl_ } from "./parse_urls"
import * as settings_ from "./settings"
import { requireURL_, complainNoSession, showHUD, complainLimits, getPortUrl_ } from "./ports"
import { setOmniStyle_ } from "./ui_css"
import { trans_ } from "./i18n"
import { stripKey_ } from "./key_mappings"
import {
  confirm_, overrideCmdOptions, runNextCmd, runKeyWithCond, portSendFgCmd, sendFgCmd, overrideOption, runNextCmdBy,
  runNextOnTabLoaded, getRunNextCmdBy, kRunOn, hasFallbackOptions, runKeyInSeq
} from "./run_commands"
import { doesNeedToSed, parseSedOptions_ } from "./clipboard"
import { goToNextUrl, newTabIndex, openUrl } from "./open_urls"
import {
  parentFrame, enterVisualMode, showVomnibar, toggleZoom, captureTab,
  initHelp, framesGoBack, mainFrame, nextFrame, performFind, framesGoNext
} from "./frame_commands"
import { onShownTabsIfRepeat_, getTabRange, getTabsIfRepeat_ } from "./filter_tabs"
import {
  copyWindowInfo, joinTabs, moveTabToNewWindow, moveTabToNextWindow, reloadTab, removeTab, toggleMuteTab,
  togglePinTab, toggleTabUrl, reopenTab_
} from "./tab_commands"
import { ContentSettings_, FindModeHistory_, Marks_, TabRecency_ } from "./tools"
import C = kBgCmd
import Info = kCmdInfo

set_cmdInfo_(As_<{
  [K in keyof BgCmdOptions]: K extends keyof BgCmdInfoMap ? BgCmdInfoMap[K] : Info.NoTab
}>([
  /* kBgCmd.blank           */ Info.NoTab, Info.NoTab, Info.NoTab, Info.NoTab, Info.NoTab,
  /* kBgCmd.performFind     */ Info.NoTab, Info.NoTab, Info.NoTab, Info.NoTab, Info.NoTab,
  /* kBgCmd.addBookmark     */ Info.NoTab, Info.NoTab, Info.ActiveTab, Info.NoTab, Info.NoTab,
  /* kBgCmd.clearMarks      */ Info.NoTab, Info.NoTab, Info.ActiveTab, Info.CurShownTabsIfRepeat, Info.NoTab,
  /* kBgCmd.goBackFallback  */ Info.ActiveTab, Info.NoTab, Info.NoTab, Info.NoTab, Info.NoTab,
  /* kBgCmd.moveTab         */ Info.CurShownTabsIfRepeat, Info.NoTab, Info.ActiveTab, Info.NoTab,
      Info.CurShownTabsIfRepeat,
  /* kBgCmd.removeRightTab  */ Info.CurShownTabsIfRepeat, Info.NoTab, Info.NoTab, Info.ActiveTab, Info.NoTab,
  /* kBgCmd.restoreTab      */ Info.NoTab, Info.ActiveTab, Info.NoTab, Info.NoTab, Info.ActiveTab,
  /* kBgCmd.togglePinTab    */ Info.NoTab, Info.CurShownTabsIfRepeat, Info.ActiveTab, Info.ActiveTab, Info.NoTab,
      Info.NoTab,
  /* kBgCmd.closeDownloadBar*/ Info.NoTab, Info.NoTab
]))

const _AsBgC = <T extends Function>(command: T): T => {
  if (!(Build.NDEBUG || command != null)) {
    throw new ReferenceError("Refer a command before it gets inited")
  }
  return Build.NDEBUG ? command : function (this: unknown) { return command.apply(this, arguments) } as unknown as T
}

set_bgC_([
  /* kBgCmd.blank: */ (): void | kBgCmd.blank => {
    let wait = get_cOptions<C.blank, true>().for || get_cOptions<C.blank, true>().wait
    if (wait === "ready") {
      // run in callback, to avoid extra 67ms
      runNextOnTabLoaded({}, null, (): void => { runNextCmdBy(1, get_cOptions<C.blank, true>(), 1) })
      return
    }
    wait = !wait ? hasFallbackOptions(get_cOptions<C.blank, true>()) ? Math.abs(cRepeat) : 0
        : Math.abs(wait === "count" || wait === "number" ? cRepeat : wait | 0)
    if (wait) {
      wait = Math.max(34, wait)
      wait > 17 && wait <= 1000 && cPort && cPort.postMessage({ N: kBgReq.suppressForAWhile, t: wait + 50 })
      runNextCmdBy(1, get_cOptions<C.blank, true>(), wait)
    }
  },

//#region need cport
  /* kBgCmd.goNext: */ (): void | kBgCmd.goNext => {
    const rawRel = get_cOptions<C.goNext>().rel
    const rel = rawRel ? rawRel + "" : "next"
    const isNext = get_cOptions<C.goNext>().isNext != null ? !!get_cOptions<C.goNext>().isNext
        : !rel.includes("prev") && !rel.includes("before")
    const sed = parseSedOptions_(get_cOptions<C.goNext, true>())
    if (!doesNeedToSed(SedContext.goNext, sed)) {
      framesGoNext(isNext, rel)
      return
    }
    void Promise.resolve(getPortUrl_(framesForTab_.get(cPort.s.tabId_)!.top_)).then((tabUrl): void => {
      const count = isNext ? cRepeat : -cRepeat
      const template = tabUrl && substitute_(tabUrl, SedContext.goNext, sed)
      const [hasPlaceholder, next] = template ? goToNextUrl(template, count
          , get_cOptions<C.goNext>().absolute ? "absolute" : true) : [false, tabUrl]
      if (hasPlaceholder && next) {
        set_cRepeat(count)
        if (get_cOptions<C.goNext>().reuse == null) {
          overrideOption<C.goNext, "reuse">("reuse", ReuseType.current)
        }
        overrideCmdOptions<C.openUrl>({ url_f: next, goNext: false })
        openUrl()
      } else {
        framesGoNext(isNext, rel)
      }
    })
  },
  /* kBgCmd.insertMode: */ (): void | kBgCmd.insertMode => {
    let _key = get_cOptions<C.insertMode>().key, _hud: boolean | UnknownValue,
    hud = (_hud = get_cOptions<C.insertMode>().hideHUD) != null ? !_hud
        : (_hud = get_cOptions<C.insertMode>().hideHud) != null ? !_hud
        : !settingsCache_.hideHud,
    key = _key && typeof _key === "string"
        && (_key.length > 2 || _key.length < 2 && !(<RegExpI> /[0-9a-z]/i).test(_key)) ? stripKey_(_key) : ""
    sendFgCmd(kFgCmd.insertMode, hud, {
      h: hud ? trans_(`${kTip.globalInsertMode}` as "5", [key && ": " + (key.length === 1 ? `" ${key} "` : _key)])
          : null,
      k: key || null,
      i: !!get_cOptions<C.insertMode>().insert,
      p: !!get_cOptions<C.insertMode>().passExitKey,
      r: <BOOL> +!!get_cOptions<C.insertMode>().reset,
      u: !!get_cOptions<C.insertMode>().unhover
    })
  },
  /* kBgCmd.nextFrame: */ _AsBgC<BgCmdNoTab<kBgCmd.nextFrame>>(nextFrame),
  /* kBgCmd.parentFrame: */ _AsBgC<BgCmdNoTab<kBgCmd.parentFrame>>(parentFrame),
  /* kBgCmd.performFind: */ _AsBgC<BgCmdNoTab<kBgCmd.performFind>>(performFind),
  /* kBgCmd.toggle: */ (resolve): void | kBgCmd.toggle => {
    type Keys = SettingsNS.FrontendSettingsSyncingItems[keyof SettingsNS.FrontendSettingsSyncingItems][0]
    type ManualNamesMap = SelectNameToKey<SettingsNS.ManuallySyncedItems>
    const key: Keys = (get_cOptions<C.toggle>().key || "") + "" as Keys,
    key2 = key === "darkMode" ? "d" as ManualNamesMap["darkMode"]
        : key === "reduceMotion" ? "m" as ManualNamesMap["reduceMotion"]
        : settings_.valuesToLoad_[key],
    old = key2 ? contentPayload_[key2] : 0, keyRepr = trans_("quoteA", [key])
    let value = get_cOptions<C.toggle>().value, isBool = typeof value === "boolean", msg = ""
    if (!key2) {
      msg = trans_(key in settings_.defaults_ ? "notFgOpt" : "unknownA", [keyRepr])
    } else if (typeof old === "boolean") {
      isBool || (value = null)
    } else if (isBool || value === undefined) {
      msg = trans_(isBool ? "notBool" : "needVal", [keyRepr])
    } else if (typeof value !== typeof old) {
      msg = JSON.stringify(old)
      msg = trans_("unlikeVal", [keyRepr, msg.length > 10 ? msg.slice(0, 9) + "\u2026" : msg])
    }
    if (msg) {
      showHUD(msg)
    } else {
      value = settings_.updatePayload_(key2, value)
      const frames = framesForTab_.get(cPort.s.tabId_)!, cur = frames.cur_
      for (const port of frames.ports_) {
        let isCur = port === cur
        portSendFgCmd(port, kFgCmd.toggle, isCur, { k: key2, n: isCur ? keyRepr : "", v: value }, 1)
      }
      resolve(1)
    }
  },
  /* kBgCmd.showHelp: */ (): void | kBgCmd.showHelp => {
    if (cPort.s.frameId_ === 0 && !(cPort.s.flags_ & Frames.Flags.hadHelpDialog)) {
      initHelp({ a: get_cOptions<C.showHelp, true>() }, cPort)
    } else {
      import(CONST_.HelpDialogJS)
      sendFgCmd(kFgCmd.showHelpDialog, true, get_cOptions<C.showHelp, true>())
    }
  },
  /* kBgCmd.showVomnibar: */ (): void | kBgCmd.showVomnibar => { showVomnibar() },
  /* kBgCmd.visualMode: */ _AsBgC<BgCmdNoTab<kBgCmd.visualMode>>(enterVisualMode),
//#endregion

  /* kBgCmd.addBookmark: */ (resolve): void | kBgCmd.addBookmark => {
    const path: string | UnknownValue = get_cOptions<C.addBookmark>().folder || get_cOptions<C.addBookmark>().path
    const nodes = path ? (path + "").replace(<RegExpG & RegExpSearchable<0>> /\\\/?|\//g
          , s => s.length > 1 ? "/" : "\n").split("\n").filter(i => i) : []
    const allTabs = !!get_cOptions<C.addBookmark>().all
    if (!nodes.length) { showHUD('Need "path" to a bookmark folder.'); resolve(0); return }
    browser_.bookmarks.getTree((tree): void => {
      if (!tree) { resolve(0); return runtimeError_() }
      let roots = tree[0].children!
      let doesMatchRoot = roots.filter(i => i.title === nodes[0])
      if (doesMatchRoot.length) {
        roots = doesMatchRoot
      } else {
        roots = roots.reduce((i, j) => i.concat(j.children!), [] as chrome.bookmarks.BookmarkTreeNode[])
      }
      let folder: chrome.bookmarks.BookmarkTreeNode | null = null
      for (let node of nodes) {
        roots = roots.filter(i => i.title === node)
        if (!roots.length) {
          resolve(0)
          return showHUD("The bookmark folder is not found.")
        }
        folder = roots[0]
        if (!folder.children) { break }
      }
      (!allTabs && cRepeat * cRepeat < 2 ? getCurTab : getCurShownTabs_)(function doAddBookmarks(tabs?: Tab[]): void {
        if (!tabs || !tabs.length) { runtimeError_(); return }
        const ind = (OnFirefox ? selectFrom(tabs, 1) : selectFrom(tabs)).index
        let [start, end] = allTabs ? [0, tabs.length] : getTabRange(ind, tabs.length)
        let count = end - start
        if (count > 20 && cNeedConfirm) {
              void confirm_("addBookmark", count).then(doAddBookmarks.bind(0, tabs))
              return
        }
        for (const tab of tabs.slice(start, end)) {
          browser_.bookmarks.create({ parentId: folder!.id, title: tab.title, url: getTabUrl(tab) }, runtimeError_)
        }
        showHUD(`Added ${end - start} bookmark${end > start + 1 ? "s" : ""}.`)
        resolve(1)
      })
    })
  },
  /* kBgCmd.autoOpenFallback: */ (resolve): void | kBgCmd.autoOpenFallback => {
    if (get_cOptions<kBgCmd.autoOpenFallback>().copied === false) { resolve(0); return }
    overrideCmdOptions<C.openUrl>({ copied: true })
    openUrl()
  },
  /* kBgCmd.captureTab: */ _AsBgC<BgCmdActiveTab<kBgCmd.captureTab>>(captureTab),
  /* kBgCmd.clearCS: */ (resolve): void | kBgCmd.clearCS => {
    OnChrome ? resolve(ContentSettings_.clearCS_(get_cOptions<C.clearCS, true>(), cPort))
    : (ContentSettings_.complain_ as (_: any) => any)(resolve(0))
  },
  /* kBgCmd.clearFindHistory: */ (resolve): void | kBgCmd.clearFindHistory => {
    const incognito = cPort ? cPort.s.incognito_ : curIncognito_ === IncognitoType.true
    FindModeHistory_.removeAll_(incognito)
    showHUD(trans_("fhCleared", [incognito ? trans_("incog") : ""]))
    resolve(1)
  },
  /* kBgCmd.clearMarks: */ (resolve): void | kBgCmd.clearMarks => {
    const p = get_cOptions<C.clearMarks>().local ? get_cOptions<C.clearMarks>().all ? Marks_.clear_("#")
    : requireURL_({ H: kFgReq.marks, u: "" as "url", a: kMarkAction.clear }, true) : Marks_.clear_()
    p && p instanceof Promise ? p.then((url): void => { url && resolve(1) }) : resolve(1)
  },
  /* kBgCmd.copyWindowInfo: */ _AsBgC<BgCmdNoTab<kBgCmd.copyWindowInfo>>(copyWindowInfo),
  /* kBgCmd.createTab: */ function createTab(tabs: [Tab] | undefined, resolve: OnCmdResolved, dedup?: "dedup"): void {
    let pure = get_cOptions<C.createTab, true>().$pure, tab: Tab | null
    if (pure == null) {
      overrideOption<C.createTab, "$pure">("$pure", pure = !(Object.keys(get_cOptions<C.createTab>()
          ) as (keyof BgCmdOptions[C.createTab])[])
          .some(i => i !== "opener" && i !== "position" && i !== "evenIncognito" && i[0] !== "$"))
    }
    if (!pure) {
      openUrl(tabs)
    } else if (!(tab = tabs && tabs.length > 0 ? tabs[0] : null) && curTabId_ >= 0 && !runtimeError_()
        && dedup !== "dedup") {
      Q_(tabsGet, curTabId_).then((newTab): void => { createTab(newTab && [newTab], resolve, "dedup") })
    } else {
      const opener = get_cOptions<C.createTab>().opener === true
      openMultiTabs(<InfoToCreateMultiTab> As_<Omit<InfoToCreateMultiTab, "url">>(tab ? {
        active: true, windowId: tab.windowId,
        openerTabId: opener ? tab.id : void 0,
        index: newTabIndex(tab, get_cOptions<C.createTab>().position, opener, true)
      } : {active: true}), cRepeat, get_cOptions<C.createTab, true>().evenIncognito, [null], true, tab, (tab2) => {
        tab2 && selectWndIfNeed(tab2)
        resolve(!!tab2)
      })
    }
  },
  /* kBgCmd.discardTab: */ (curOrTabs: [Tab] | Tab[], oriResolve: OnCmdResolved): void | kBgCmd.discardTab => {
    if (OnChrome && Build.MinCVer < BrowserVer.Min$tabs$$discard && CurCVer_ < BrowserVer.Min$tabs$$discard) {
      showHUD(trans_("noDiscardIfOld", [BrowserVer.Min$tabs$$discard]))
      oriResolve(0)
      return
    }
    onShownTabsIfRepeat_(true, 1, function onTabs(tabs, [start, current, end], resolve, force1?: boolean): void {
      if (force1) { [start, end] = getTabRange(current, tabs.length, 0, 1) }
      let count = end - start - 1
      if (count > 20 && cNeedConfirm) {
        void confirm_("discardTab", count).then(onTabs.bind(null, tabs, [start, current, end], resolve))
        return
      }
      const near = tabs.length === 1 && !tabs[0].active ? tabs[0]
          : tabs[current + ((cRepeat > 0 ? current + 1 < end : current === 0) ? 1 : -1)]
      let changed: Promise<null | undefined>[] = [], aliveExist = !near.discarded
      if (aliveExist && (count < 2 || near.autoDiscardable)) {
        changed.push(Q_(Tabs_.discard, near.id))
      }
      for (let i = start; i < end; i++) {
        const tab = tabs[i]
        if (i !== current && tab !== near && !tab.discarded) {
          aliveExist = true
          tab.autoDiscardable && changed.push(Q_(Tabs_.discard, tab.id))
        }
      }
      if (!changed.length) {
        showHUD(aliveExist ? trans_("discardFail") : "Discarded.")
        resolve(0)
      } else {
        void Promise.all(changed).then((arr): void => {
          const done = arr.filter(i => i !== void 0), succeed = done.length > 0
          showHUD(succeed ? `Discarded ${done.length} tab(s).` : trans_("discardFail"))
          resolve(succeed)
        })
      }
    }, curOrTabs, oriResolve)
  },
  /* kBgCmd.duplicateTab: */ (resolve: OnCmdResolved): void | kBgCmd.duplicateTab => {
    const tabId = cPort ? cPort.s.tabId_ : curTabId_
    if (tabId < 0) {
      complainLimits(trans_("dupTab"))
      resolve(0)
      return
    }
    const notActive = get_cOptions<C.duplicateTab>().active === false
    Q_(Tabs_.duplicate, tabId).then((result): void => {
      if (!result) { resolve(0); return }
      notActive && selectTab(tabId, runtimeError_)
      notActive ? resolve(1) : runNextOnTabLoaded(get_cOptions<C.duplicateTab, true>(), result)
      if (cRepeat < 2) { return }
    const fallback = (tab: Tab): void => {
      openMultiTabs({
        url: getTabUrl(tab), active: false, windowId: tab.windowId,
        pinned: tab.pinned, index: tab.index + 2, openerTabId: tab.id
      }, cRepeat - 1, true, [null], true, tab, null)
    }
      if (!OnChrome
          || Build.MinCVer >= BrowserVer.MinNoAbnormalIncognito || CurCVer_ >= BrowserVer.MinNoAbnormalIncognito
          || curIncognito_ === IncognitoType.ensuredFalse || CONST_.DisallowIncognito_) {
        tabsGet(tabId, fallback)
        return
      }
      getCurWnd(true, (wnd): void => {
        const tab = wnd && wnd.tabs.find(tab2 => tab2.id === tabId)
        if (!tab || !wnd!.incognito || tab.incognito) {
          return tab ? fallback(tab) : runtimeError_()
        }
        for (let count = cRepeat; 0 < --count; ) {
          Tabs_.duplicate(tabId)
        }
        resolve(1)
      })
    })
    notActive && selectTab(tabId, runtimeError_)
  },
  OnEdge ? (_tabs, resolve) => { resolve(0) } :
  /* kBgCmd.goBackFallback: */ (tabs: [Tab]): void | kBgCmd.goBackFallback => {
    tabs.length &&
    framesGoBack({ s: cRepeat, o: get_cOptions<C.goBackFallback, true>() }, null, tabs[0])
  },
  /* kBgCmd.goToTab: */ (resolve): void | kBgCmd.goToTab => {
    const count = cRepeat, absolute = !!get_cOptions<C.goToTab>().absolute
    const goToTab = (tabs: ShownTab[]): void => {
      const cur = selectFrom(tabs)
      let len = tabs.length
    let index = absolute ? count > 0 ? Math.min(len, count) - 1 : Math.max(0, len + count)
        : Math.abs(count) > len * 2 ? (count > 0 ? len - 1 : 0)
        : cur.index + count
    index = index >= 0 ? index % len : len + (index % len || -len)
    if (tabs[0].pinned && get_cOptions<C.goToTab>().noPinned && !cur.pinned && (count < 0 || absolute)) {
      let start = 1
      while (tabs[start].pinned) { start++ }
      len -= start
      if (absolute || Math.abs(count) > len * 2) {
        index = absolute ? Math.max(start, index) : index || start
      } else {
        index = (cur.index - start) + count
        index = index >= 0 ? index % len : len + (index % len || -len)
        index += start
      }
    }
      const toSelect: ShownTab = tabs[index], doesGo = !toSelect.active
      if (doesGo) { selectTab(toSelect.id) }
      resolve(doesGo)
    }
    if (absolute) {
      if (cRepeat === 1) {
        Q_(Tabs_.query, { currentWindow: true, index: 0 }).then((tabs): void => {
          tabs && tabs[0] && isNotHidden_(tabs[0]) ? goToTab(tabs)
          : onShownTabsIfRepeat_(false, 1, goToTab, [], resolve)
        })
      } else {
        onShownTabsIfRepeat_(false, 1, goToTab, [], resolve)
      }
    } else if (Math.abs(cRepeat) === 1) {
      Q_(getCurTab).then((curs): void => { onShownTabsIfRepeat_(false, 1, goToTab, curs || [], resolve) })
    } else {
      onShownTabsIfRepeat_(false, 1, goToTab, [], resolve)
    }
  },
  /* kBgCmd.goUp: */ (): void | kBgCmd.goUp => {
    if (get_cOptions<C.goUp>().type !== "frame" && cPort && cPort.s.frameId_) {
      set_cPort(framesForTab_.get(cPort.s.tabId_)?.top_ || cPort)
    }
    const arg: Req.fg<kFgReq.parseUpperUrl> & {u: "url"} = { H: kFgReq.parseUpperUrl, u: "" as "url",
      p: cRepeat,
      t: get_cOptions<C.goUp, true>().trailingSlash, r: get_cOptions<C.goUp, true>().trailing_slash,
      s: parseSedOptions_(get_cOptions<C.goUp, true>()),
      e: get_cOptions<C.goUp>().reloadOnRoot !== false
    }
    const p = requireURL_(arg)
    Promise.resolve(p || "url").then((): void => {
      if (typeof arg.e === "object") {
        getRunNextCmdBy(kRunOn.otherPromise)(arg.e.p != null || void 0)
      }
    })
  },
  /* kBgCmd.joinTabs: */ _AsBgC<BgCmdNoTab<kBgCmd.joinTabs>>(joinTabs),
  /* kBgCmd.mainFrame: */ _AsBgC<BgCmdNoTab<kBgCmd.mainFrame>>(mainFrame),
  /* kBgCmd.moveTab: */ (curOrTabs: Tab[] | [Tab], resolve): void | kBgCmd.moveTab => {
    const _rawGroup = !OnEdge && get_cOptions<kBgCmd.moveTab>().group
    const useGroup = _rawGroup !== "ignore" && _rawGroup !== false
    onShownTabsIfRepeat_(false, 1, (tabs): void => {
    const tab = selectFrom(tabs), pinned = tab.pinned
    const curIndex = tabs.indexOf(tab)
    let index = Math.max(0, Math.min(tabs.length - 1, curIndex + cRepeat))
    while (pinned !== tabs[index].pinned) { index -= cRepeat > 0 ? 1 : -1 }
    if (!OnEdge && index !== curIndex && useGroup) {
      let curGroup = getGroupId(tab), newGroup = getGroupId(tabs[index])
      if (newGroup !== curGroup && (Math.abs(cRepeat) === 1 || curGroup !== getGroupId(tabs[
            cRepeat > 0 ? index < tabs.length - 1 ? index + 1 : index : index && index - 1]))) {
        if (curGroup !== null) {
          index = curIndex
          newGroup = curGroup
        }
        while (index += cRepeat > 0 ? 1 : -1,
                0 <= index && index < tabs.length && getGroupId(tabs[index]) === newGroup) { /* empty */ }
        index -= cRepeat > 0 ? 1 : -1
      }
    }
      if (index !== curIndex || !tab.active) {
        Tabs_.move((tab.active ? tab : curOrTabs[0]).id, { index: (tabs as Tab[])[index].index }, R_(resolve))
      } else {
        resolve(0)
      }
    }, curOrTabs, resolve
    , !OnEdge && useGroup ? theOther => getGroupId(curOrTabs[0]) === getGroupId(theOther) : null)
  },
  /* kBgCmd.moveTabToNewWindow: */ _AsBgC<BgCmdNoTab<kBgCmd.moveTabToNewWindow>>(moveTabToNewWindow),
  /* kBgCmd.moveTabToNextWindow: */ _AsBgC<BgCmdActiveTab<kBgCmd.moveTabToNextWindow>>(moveTabToNextWindow),
  /* kBgCmd.openUrl: */ (): void | kBgCmd.openUrl => { openUrl() },
  /* kBgCmd.reloadTab: */ (tabs: Tab[] | [Tab], resolve: OnCmdResolved): void | kBgCmd.reloadTab => {
    onShownTabsIfRepeat_(!get_cOptions<C.reloadTab>().single, 0, reloadTab, tabs, resolve)
  },
  /* kBgCmd.removeRightTab: */ (curTabs: Tab[] | [Tab] | undefined, resolve): void | kBgCmd.removeRightTab => {
    onShownTabsIfRepeat_(false, 1, (tabs, [dest], r): void => { Tabs_.remove(tabs[dest].id, R_(r)) }, curTabs, resolve)
  },
  /* kBgCmd.removeTab: */ _AsBgC<BgCmdNoTab<kBgCmd.removeTab>>(removeTab),
  /* kBgCmd.removeTabsR: */ (resolve): void | kBgCmd.removeTabsR => {
    /** `direction` is treated as limited; limited by pinned */
    const direction = get_cOptions<C.removeTabsR>().other ? 0 : cRepeat
    getTabsIfRepeat_(direction, (tabs: Tab[] | undefined): void => {
      if (!tabs || tabs.length === 0) { return runtimeError_() }
    const activeTab = selectFrom(tabs)
    let i = tabs!.indexOf(activeTab), noPinned = false
    const filter = get_cOptions<C.removeTabsR, true>().filter
    if (direction > 0) {
      ++i
      tabs = tabs.slice(i, i + direction)
    } else {
      noPinned = i > 0 && tabs[0].pinned && !tabs[i - 1].pinned
      if (direction < 0) {
        tabs = tabs.slice(Math.max(i + direction, 0), i)
      } else {
        tabs.splice(i, 1)
      }
    }
    if (noPinned) {
      tabs = tabs.filter(tab => !tab.pinned)
    }
    if (filter) {
      const title = filter.includes("title") ? activeTab.title : "",
      full = filter.includes("hash"), activeTabUrl = getTabUrl(activeTab),
      onlyHost = filter.includes("host") ? BgUtils_.safeParseURL_(activeTabUrl) : null,
      urlToFilter = full ? activeTabUrl : onlyHost ? onlyHost.host : activeTabUrl.split("#", 1)[0]
      tabs = tabs.filter(tab => {
        const tabUrl = getTabUrl(tab), parsed = onlyHost ? BgUtils_.safeParseURL_(activeTabUrl) : null
        const url = parsed ? parsed.host : full ? tabUrl : tabUrl.split("#", 1)[0]
        return url === urlToFilter && (!title || tab.title === title)
      })
    }
    if (tabs.length > 0) {
      Tabs_.remove(tabs.map(tab => tab.id), R_(resolve))
    } else {
      resolve(0)
    }
    })
  },
  /* kBgCmd.reopenTab: */ (tabs: [Tab] | never[], resolve): void | kBgCmd.reopenTab => {
    if (tabs.length <= 0) { resolve(0);return }
    const tab = tabs[0], group = get_cOptions<C.reopenTab>().group !== false
    if (!OnChrome || Build.MinCVer >= BrowserVer.MinNoAbnormalIncognito
        || CurCVer_ >= BrowserVer.MinNoAbnormalIncognito
        || curIncognito_ === IncognitoType.ensuredFalse || CONST_.DisallowIncognito_
        || !isRefusingIncognito_(getTabUrl(tab))) {
      reopenTab_(tab, undefined, undefined, group)
    } else {
      Windows_.get(tab.windowId, (wnd): void => {
        if (wnd.incognito && !tab.incognito) {
          tab.openerTabId = tab.windowId = undefined as never
        }
        reopenTab_(tab, undefined, undefined, group)
      })
    }
  },
  /* kBgCmd.restoreTab: */ (resolve): void | kBgCmd.restoreTab => {
    const sessions = !OnEdge ? browserSessions_() : null
    if (!sessions) {
      resolve(0)
      return complainNoSession()
    }
    const onlyOne = !!get_cOptions<C.restoreTab>().one, limit = sessions.MAX_SESSION_RESULTS
    let count = Math.abs(cRepeat)
    if (count > limit) {
      if (onlyOne) {
        resolve(0); showHUD(trans_("indexOOR"))
        return
      }
      count = limit
    }
    if (!onlyOne && count < 2 && (cPort ? cPort.s.incognito_ : curIncognito_ === IncognitoType.true)
        && !get_cOptions<C.restoreTab>().incognito) {
      resolve(0)
      return showHUD(trans_("notRestoreIfIncog"))
    }
    if (onlyOne && count > 1) {
      sessions.getRecentlyClosed({ maxResults: count }, (list: chrome.sessions.Session[]): void => {
        if (count > list.length) {
          resolve(0)
          return showHUD(trans_("indexOOR"))
        }
        const session = list[count - 1], item = session && (session.tab || session.window)
        if (!item) {
          resolve(0)
        } else {
          sessions.restore(item.sessionId, getRunNextCmdBy(kRunOn.otherCb))
        }
      })
      return
    }
    sessions.restore(null, getRunNextCmdBy(kRunOn.otherCb))
    while (0 < --count) {
      sessions.restore(null, runtimeError_)
    }
  },
  /* kBgCmd.runKey: */ (): void | kBgCmd.runKey => {
    get_cOptions<C.runKey>().$seq == null ? runKeyWithCond()
    : runKeyInSeq(get_cOptions<C.runKey, true>().$seq!, cRepeat, get_cOptions<C.runKey, true>().$f)
  },
  /* kBgCmd.searchInAnother: */ (tabs: [Tab]): void | kBgCmd.searchInAnother => {
    let keyword = (get_cOptions<C.searchInAnother>().keyword || "") + ""
    const query = parseSearchUrl_({ u: getTabUrl(tabs[0]) })
    if (!query || !keyword) {
      if (!runNextCmd<C.searchInAnother>(0)) {
        showHUD(trans_(keyword ? "noQueryFound" : "noKw"))
      }
      return
    }
    let sed = parseSedOptions_(get_cOptions<C.searchInAnother, true>())
    query.u = substitute_(query.u, SedContext.NONE, sed)
    let url_f = createSearchUrl_(query.u.split(" "), keyword, Urls.WorkType.ActAnyway)
    let reuse = get_cOptions<C.searchInAnother, true>().reuse
    overrideCmdOptions<C.openUrl>({
      url_f, reuse: reuse != null ? reuse : ReuseType.current, opener: true, keyword: ""
    })
    openUrl(tabs)
  },
  /* kBgCmd.sendToExtension: */ (resolve): void | kBgCmd.sendToExtension => {
    let targetID = get_cOptions<C.sendToExtension>().id, data = get_cOptions<C.sendToExtension>().data
    if (targetID && typeof targetID === "string" && data !== void 0) {
      const now = Date.now()
      browser_.runtime.sendMessage(targetID, get_cOptions<C.sendToExtension>().raw ? data : {
        handler: "message", from: "Vimium C", count: cRepeat, keyCode: cKey, data
      }, (cb): void => {
        let err: any = runtimeError_()
        if (err) {
          console.log("Can not send message to the extension %o:", targetID, err)
          showHUD("Error: " + (err.message || err))
          resolve(0)
        } else if (typeof cb === "string" && Math.abs(Date.now() - now) < 1e3) {
          showHUD(cb)
        }
        err || resolve(cb !== false)
        return err
      })
    } else {
      showHUD('Require a string "id" and message "data"')
      resolve(0)
    }
  },
  /* kBgCmd.showHUD: */ (resolve): void | kBgCmd.showHUD => {
    let text = get_cOptions<C.showHUD>().text
    if (!text && get_cOptions<C.showHUD>().$f) {
      const fallbackContext = get_cOptions<C.showHUD, true>().$f
      text = fallbackContext && fallbackContext.t ? trans_(`${fallbackContext.t as 99}`) : ""
    }
    showHUD(text ? text + "" : trans_("needText"))
    resolve(!!text)
  },
  /* kBgCmd.toggleCS: */ (tabs: [Tab], resolve): void | kBgCmd.toggleCS => {
    OnChrome ? ContentSettings_.toggleCS_(get_cOptions<C.toggleCS, true>(), cRepeat, tabs, resolve)
        : (ContentSettings_.complain_ as (_: any) => any)(resolve(0))
  },
  /* kBgCmd.toggleMuteTab: */ _AsBgC<BgCmdNoTab<kBgCmd.toggleMuteTab>>(toggleMuteTab),
  /* kBgCmd.togglePinTab: */ (curs: Tab[] | [Tab], resolve: OnCmdResolved): void | kBgCmd.togglePinTab => {
    onShownTabsIfRepeat_(true, 0, togglePinTab, curs, resolve)
  },
  /* kBgCmd.toggleTabUrl: */ _AsBgC<BgCmdActiveTab<kBgCmd.toggleTabUrl>>(toggleTabUrl),
  /* kBgCmd.toggleVomnibarStyle: */ (tabs: [Tab], resolve): void | kBgCmd.toggleVomnibarStyle => {
    const tabId = tabs[0].id, toggled = ((get_cOptions<C.toggleVomnibarStyle>().style || "") + "").trim(),
    current = !!get_cOptions<C.toggleVomnibarStyle>().current
    if (!toggled) {
      showHUD(trans_("noStyleName"))
      resolve(0)
      return
    }
    for (const frame of framesForOmni_) {
      if (frame.s.tabId_ === tabId) {
        frame.postMessage({ N: kBgReq.omni_toggleStyle, t: toggled, c: current })
        setTimeout(resolve, 100, 1)
        return
      }
    }
    current || setOmniStyle_({ t: toggled, o: 1 })
    setTimeout(resolve, 100, 1)
  },
  /* kBgCmd.toggleZoom: */ _AsBgC<BgCmdNoTab<kBgCmd.toggleZoom>>(toggleZoom),
  /* kBgCmd.visitPreviousTab: */ (resolve: OnCmdResolved): void | kBgCmd.visitPreviousTab => {
    const acrossWindows = !!get_cOptions<C.visitPreviousTab>().acrossWindows
    const onlyActive = !!get_cOptions<C.visitPreviousTab>().onlyActive
    const cb = (tabs: Tab[]): void => {
      if (tabs.length < 2) {
        if (onlyActive) { showHUD("Only found one browser window") }
        resolve(0); return runtimeError_()
      }
      const curIdx = tabs.findIndex(i => i.id === curTabId_)
      if (curIdx >= 0) { tabs.splice(curIdx, 1) }
      const tabs2 = tabs.filter(i => recencyForTab_.has(i.id)).sort(TabRecency_.rCompare_)
      tabs = onlyActive && tabs2.length === 0 ? tabs.sort((a, b) => b.id - a.id) : tabs2
      const tab = tabs[cRepeat > 0 ? Math.min(cRepeat, tabs.length) - 1 : Math.max(0, tabs.length + cRepeat)]
      if (tab) {
        onlyActive ? Windows_.update(tab.windowId, { focused: true, }, R_(resolve)) : doActivate(tab.id)
      } else {
        resolve(0)
      }
    }
    const doActivate = (tabId: number): void => {
      selectTab(tabId, (tab): void => (tab && selectWndIfNeed(tab), R_(resolve)()))
    }
    if (cRepeat === 1 && !onlyActive && curTabId_ !== GlobalConsts.TabIdNone) {
      let indMax = 0, tabId = -1
      recencyForTab_.forEach((v, i): void => { if (v.i > indMax && i !== curTabId_) { indMax = v.i, tabId = i } })
      if (tabId >= 0) {
        void Q_(tabsGet, tabId).then((tab?: Tab): void => {
          tab && (acrossWindows || tab.windowId === curWndId_) && isNotHidden_(tab) ? doActivate(tab.id)
          : acrossWindows ? Tabs_.query(OnFirefox ? { hidden: false } : {}, cb) : getCurShownTabs_(cb)
        })
        return
      }
    }
    acrossWindows || onlyActive ? Tabs_.query(onlyActive ? { active: true } : OnFirefox ? { hidden: false } : {}, cb)
    : getCurShownTabs_(cb)
  },
  /* kBgCmd.closeDownloadBar: */ (resolve: OnCmdResolved): void | kBgCmd.closeDownloadBar => {
    const newWindow = get_cOptions<C.closeDownloadBar>().newWindow
    if (OnFirefox || newWindow === true || !OnChrome && !browser_.permissions) {
      bgC_[kBgCmd.moveTabToNewWindow](resolve)
      return
    }
    Q_(browser_.permissions.contains, { permissions: ["downloads.shelf", "downloads"] }).then((permitted): void => {
      if (permitted) {
        const toggleShelf = browser_.downloads.setShelfEnabled
        let err: string | undefined
        try {
          toggleShelf(false)
          setTimeout((): void => { toggleShelf(true); resolve(1) }, 256)
        } catch (e: any) { err = (e && e.message || e) + "" }
        showHUD(err ? "Can not close the shelf: " + err : "The download bar has been closed")
        err && resolve(0)
      } else if (newWindow === false && cPort) {
        showHUD("No permissions to close download bar")
        resolve(0)
      } else {
        bgC_[kBgCmd.moveTabToNewWindow](resolve)
      }
    })
  },
  /* kBgCmd.reset */ (resolve): void | kBgCmd.reset => {
    const ref = framesForTab_.get(cPort ? cPort.s.tabId_ : curTabId_)
    for (const frame of ref ? ref.ports_ : []) {
      portSendFgCmd(frame, kFgCmd.insertMode, false, { r: 1 }, 1)
    }
    ref && ref.cur_.postMessage({ N: kBgReq.suppressForAWhile, t: 150 })
    resolve(1)
  }
])
