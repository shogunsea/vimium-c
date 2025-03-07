declare const enum kTip {
  /* 1: */ raw = 1,
  /* 4..9 */ didUnHoverLast = 4, noTargets, noPassKeys, normalMode, nTimes, passNext,
  /* 10..15 */ noLinksToGo, noFocused, focusedIsHidden, noInputToFocus, noUrlCopied, noTextCopied,
  /* 17: */ frameUnloaded = 17,
  /* 20..25 */ copiedIs = 20, omniFrameFail, tooManyLinks, wrapWhenFind, atStart, atEnd,
  /* 26..31 */ nMatches, oneMatch, someMatches, noMatches, modalHints, expectKeys,
  /* 39, 41, 43: */ findFrameFail = 39, noOldQuery = 41, selectLineBoundary = 43, // neither 41 nor 43 is in HintMode
  /* 46..47, 55 */ waitForEnter = 46, reDownloading, needSel = 55,
  /* 62..63 */ prev = 62, next,
  /* 68..70 */ START_FOR_OTHERS = 68, OFFSET_VISUAL_MODE = 67, visual, line, caret,
  /* 71: */ noLinks, exitForIME, linkRemoved, notImg,
  /* 75: */ hoverScrollable, ignorePassword, noNewToCopy, downloaded, paused,
  /* 80: */ onTopNormal, noMatchFor, inVisualMode, noUsableSel, loseSel,
  /* 85: */ isWithRel, forcedColors, editableSelector, removeCurScript, removeEventScript,
  /* 90: */ notANestedFrame, cssUrl, newClickableClasses, oldClickableClasses, clickableRoles,
  /* 95: */ invisibleHintText, notMatchedHintText, metaKeywordsForMobile, css0d01OrDPI, visibleElementsInScopeChildren,
  /* 100: */ voidJS, nonLocalhostRe, scrollable, buttonOrA, closableClasses,
  /* 105: */ highContrast_WOB, invisibleElements, imgExt, searchResults, excludeWhenGoNext,
  /* 110..113: */ kCommonEvents, logOmniFallback, logNotWorkOnSandboxed, logGrabFocus,
  INJECTED_CONTENT_END,
  /* 200: */ XHTML = 200,
  /** used by {@link ../Gulpfile.js} */ extendClick = 999,
}

interface BgCSSReq {
  /** style (aka. CSS) */ H: string | null;
}

interface BaseExecute<T, C extends keyof CmdOptions = keyof CmdOptions> extends BgCSSReq {
  /** command */ c: C;
  /** count */ n: number;
  /** args (aka. options) */ a: T | null;
}

interface ParsedSearch {
  /** keyword */ k: string;
  /** canSkip */ c?: boolean
  /** start */ s: number;
  /** url */ u: string;
  /** error */ e?: string | null;
}

declare const enum kAria { hidden = 0, disabled = 1, hasPopup = 2 }
declare const enum kHidden {
  None = 0, VisibilityHidden = 1, OverflowHidden = 2,
  BASE_ARIA = 16, AriaHidden = BASE_ARIA << kAria.hidden, AriaDisabled = BASE_ARIA << kAria.disabled,
}
// Note: `clickable` is not used in `focusInput`
interface CSSOptions {
  match?: "css-selector" | " " | 0 | null | undefined
  clickable?: "css-selector" | null | undefined
  clickableOnHost?: "css-selector" | null | undefined
  exclude?: "css-selector" | null | undefined
  excludeOnHost?: "host-re##css-selector;..." | null | undefined
  evenIf?: kHidden | null | undefined
  /* same as `.evenIf |= kHidden.OverflowHidden` */ scroll?: "force" | null | undefined
}
interface OtherFilterOptions {
  typeFilter?: /** 1 <<< {@link ../content/local_hints.ts#ClickType} */ number | null | undefined
  textFilter?: "regexp"; closedShadow?: boolean
}
interface OptionsToFindElement extends CSSOptions, OtherFilterOptions {
  direct?: boolean | "element,sel,focus,hover" | "element" | "selected" | "currentScrollable" | "DOMActivate"
      | "last-focused" | "recently-focused" | "focus" | "hovered" | "clicked" | "body"
  directOptions?: {
    search?: "view" | "doc" | "document"
    offset?: 0 | "cur" | "current" | "end" | "last"
    index?: "count" | number
  }
}

interface FindCSS {
  /** change-selection-color */ c: string;
  /** force-content-selectable */ s: string;
  /** hud-iframe */ i: string;
}

interface OptionsWithForce extends FgOptions {
  $forced?: true | 1;
}

declare const enum kBgReq {
  START = 0,
  init = START, reset, injectorRun, url, msg, eval,
  settingsUpdate, focusFrame, exitGrab, keyFSM, execute,
  showHUD, count, queryForRunKey, suppressForAWhile, refreshPort,
  OMNI_MIN = 42,
  omni_init = OMNI_MIN, omni_omni, omni_parsed, omni_returnFocus,
  omni_toggleStyle, omni_updateOptions, omni_refresh, omni_runTeeTask,
  END = "END", // without it, TypeScript will report errors for number indexes
}

declare const enum kFgReq {
  fromInjectedPages, blank, setSetting, findQuery, parseSearchUrl, parseUpperUrl,
  searchAs, gotoSession, openUrl, onFrameFocused, checkIfEnabled,
  nextFrame, exitGrab, execInChild, initHelp, css,
  vomnibar, omni, copy, key, nextKey,
  marks, focusOrLaunch, cmd, removeSug, openImage,
  evalJSFallback, gotoMainFrame, setOmniStyle, findFromVisual, framesGoBack,
  i18n, cssLearnt, visualMode, respondForRunKey, downloadLink, wait,
  optionToggled, keyFromOmni, pages, showUrl,
  omniCopy, didLocalMarkTask, recheckTee, afterTee, END,
  msg = 90, inject = 99,
  command = "command", id = "id", shortcut = "shortcut", focus = "focus", tip = "tip",
}

interface BgReq {
  [kBgReq.init]: {
    /** flags */ f: Frames.Flags;
    /** cache (aka. payload) */ c: SettingsNS.FrontendSettingCache;
    /** passKeys */ p: string | null;
    /** mappedKeys */ m: SafeDict<string> | null;
    /** keyFSM */ k: KeyFSM;
    /** mappedKeyTypes */ t: kMapKey;
  };
  [kBgReq.injectorRun]: {
    /** task */ t: InjectorTask;
  };
  [kBgReq.reset]: {
    /** passKeys */ p: string | null;
    /** flags: in .reset must exist */ f: Frames.Flags.blank | Frames.Flags.locked | Frames.Flags.lockedAndDisabled
  };
  [kBgReq.msg]: {
    /** mid */ m: number;
    /** response */ r: FgRes[keyof FgRes];
  };
  [kBgReq.keyFSM]: {
    /** mappedKeys */ m: SafeDict<string> | null;
    /** keyMap */ k: KeyFSM | null;
    /** mappedKeyTypes */ t: kMapKey;
  };
  [kBgReq.showHUD]: {
    /** kTip */ k?: kTip | 0
    /** text */ t?: string;
    /** long */ l?: BOOL
    /** duration */ d?: 0 | 1 | 2 | 0.0001
    /** findCSS */ f?: FindCSS
  } & Partial<BgCSSReq>;
  [kBgReq.focusFrame]: {
    /** mask */ m: FrameMaskType;
    /** key */ k: kKeyCode;
    // ensure .c, .S exist, for safer code
    /** command */ c: FgCmdAcrossFrames | 0;
    /** fallback options */ f: Req.FallbackOptions
  } & BgCSSReq & Partial<Pick<BaseExecute<FgOptions, FgCmdAcrossFrames>, "n" | "a">>;
  [kBgReq.execute]: BaseExecute<object> & Req.baseBg<kBgReq.execute>;
  [kBgReq.exitGrab]: Req.baseBg<kBgReq.exitGrab>;
  [kBgReq.settingsUpdate]: {
    /** delta */ d: Partial<SelectValueType<SettingsNS.FrontendSettingsSyncingItems>>;
  };
  [kBgReq.url]: {
    /** url */ u?: string;
    /** use vApi.u */ U: 0 | 1 | 2 | 3
  } & Req.baseFg<keyof FgReq>
  [kBgReq.eval]: {
    /** url */ u: string; // a javascript: URL
    /** only $then */ f?: Req.FallbackOptions | null
  }
  [kBgReq.count]: {
    /** cmd */ c: string | "";
    /** id */ i: number;
    /** message-in-confirmation-dialog */ m: string;
  };
  [kBgReq.queryForRunKey]: { n: number; c: CurrentEnvCache }
  [kBgReq.suppressForAWhile]: { /** timeout */ t: number }
  [kBgReq.refreshPort]: {}
}

interface BgVomnibarSpecialReq {
  [kBgReq.omni_omni]: {
    /** autoSelect */ a: boolean
    /** queryComponents */ c: CompletersNS.QComponent
    /** favIcon  */ i: 0 | 1 | 2
    /** list */ l: CompletersNS.Suggestion[];
    /** matchType */ m: CompletersNS.MatchType;
    /** real mode */ r: string
    /** sugTypes */ s: CompletersNS.SugType;
    /** total */ t: number;
  };
  [kBgReq.omni_returnFocus]: {
    /** lastKey */ l: kKeyCode;
  } & Req.baseBg<kBgReq.omni_returnFocus>;
  [kBgReq.omni_init]: {
    /** secret */ s: string
    /** payload */ l: SettingsNS.VomnibarPayload;
  };
  [kBgReq.omni_parsed]: {
    /** id */ i: number;
    /** search */ s: FgRes[kFgReq.parseSearchUrl];
  };
  [kBgReq.omni_toggleStyle]: {
    /** toggled */ t: string;
    /** current */ c: boolean;
  };
  [kBgReq.omni_updateOptions]: {
    /** delta */ d: Partial<SelectValueType<SettingsNS.AllVomnibarItems>>;
  };
  [kBgReq.omni_runTeeTask]: Pick<BaseTeeTask, "t" | "s">
  [kBgReq.omni_refresh]: { /** destroy */ d: boolean }
}
type ValidBgVomnibarReq = keyof BgVomnibarSpecialReq | kBgReq.injectorRun;
interface FullBgReq extends BgReq, BgVomnibarSpecialReq {}

declare const enum kTeeTask { CopyImage = 1, ShowImage = 2, Paste = 3, Download = 4, Copy = 5, DrawAndCopy = 9 }
interface BaseTeeTask {
  /** task enum */ t: kTeeTask
  /** serializable data */ s: any
  /** complicated data */ d?: object | null | undefined
  /** resolve */ r?: (succeed: boolean | string) => void
}
interface ImageToCopy { /** url for binary data */ u: string, /** text */ t: string, /** browser */ b?: BrowserType }
interface TeeTasks {
  [kTeeTask.Copy]: { s: string, d: null }
  [kTeeTask.Paste]: { s: null | /** permitted */ true, d: null }
  [kTeeTask.CopyImage]: { s: ImageToCopy, d: Blob }
  [kTeeTask.DrawAndCopy]: { s: ImageToCopy, d: Blob }
}

declare const enum kBgCmd {
  blank, goNext,
  // region: need cport
  insertMode, nextFrame, parentFrame,
  performFind, toggle, showHelp, dispatchEventCmd, showVomnibar, marksActivate, visualMode,
  MIN_NEED_CPORT = insertMode, MAX_NEED_CPORT = visualMode,
  // endregion: need cport
  addBookmark, autoOpenFallback,
  captureTab, clearCS, clearFindHistory, clearMarks, copyWindowInfo, createTab,
  discardTab, duplicateTab, goBackFallback, goToTab, goUp, joinTabs,
  mainFrame, moveTab, moveTabToNewWindow, moveTabToNextWindow, openUrl,
  reloadTab, removeRightTab, removeTab, removeTabsR, reopenTab, restoreTab, runKey,
  searchInAnother, sendToExtension, showHUD,
  toggleCS, toggleMuteTab, togglePinTab, toggleTabUrl, toggleVomnibarStyle, toggleZoom,
  visitPreviousTab, closeDownloadBar, reset, openBookmark,
  END, ENDS = "END",
}

declare const enum kFgCmd {
  callTee, findMode, linkHints, marks, scroll, visualMode, vomnibar, insertMode, toggle,
  passNextKey, goNext, autoOpen, focusInput, editText, scrollSelect, toggleStyle, dispatchEventCmd, showHelpDialog,
  framesGoBack, goToMark,
  END, ENDS = "END",
}

type FgCmdAcrossFrames = kFgCmd.linkHints | kFgCmd.scroll | kFgCmd.vomnibar | kFgCmd.goNext | kFgCmd.framesGoBack
    | kFgCmd.insertMode | kFgCmd.dispatchEventCmd | kFgCmd.goToMark

interface FgOptions extends SafeDict<any> {}
type SelectActions = "" | "all" | "all-input" | "all-line" | "start" | "end";

interface ParsedSedOpts {
  /** sed rules, split by spaces */ r: string | boolean | null | undefined
  /** keys */ k: string | null | undefined | object
}
type MixedSedOpts = string | boolean | ParsedSedOpts
interface UserSedOptions {
  sed?: MixedSedOpts | null
  /** only in LinkHints now */ sedIf?: "regexp-for-<a>.href" | null
  sedKeys?: string | null
  sedKey?: string | null
  /** cached parsing result */ $sed?: ParsedSedOpts | null
}

declare namespace HintsNS {
  interface Options extends OptionsToFindElement
      , UserSedOptions, OpenPageUrlOptions, Pick<OpenUrlOptions, "opener">
      , Req.FallbackOptions {
    /** mode */ m: HintMode
    /** hint characters */ c?: string
    action?: string;
    /** enable bubbles when hovering / unhovering */ bubbles?: boolean;
    caret?: boolean;
    download?: "" | "force"
    focus?: boolean | "css-selector"
    then?: object | string
    ordinal?: boolean
    useFilter?: boolean;
    url?: boolean;
    // access el.dataset[<json keys>] || el.attrs[key][json keys]
    // format: [<css selector>":"]<dataset-key or attr-name>[...("."<json key>)], like img:viewer.url
    access?: string
    dblclick?: boolean;
    interact?: true | "native" | false
    longPage?: boolean
    newtab?: null | /** only in editing mode */ boolean
        | "force" | "force-current" | "force-mode"
        | "last-window" | "window" | /** Firefox-only */ "no-prevent"
    reuse?: UserReuseType
    button?: "right";
    contextmenu?: boolean
    touch?: null | boolean | "auto";
    join?: FgReq[kFgReq.copy]["j"];
    decoded?: boolean;
    anyText?: boolean
    toggle?: {
      [selector: string]: string;
    };
    auto?: boolean;
    /** clickElement / pageLoad is enabled by default */
    autoReload?: "clickElement" | "click" | "cl" | "pageLoad" | "lo" | "delayedListen" | "delayed" | "de" | "all"
    ctrlShiftForWindow?: boolean | null;
    noCtrlPlusShift?: boolean;
    retainInput?: boolean
    swapCtrlAndShift?: boolean;
    showUrl?: boolean | BOOL
    activeOnCtrl?: boolean
    hideHud?: boolean;
    hideHUD?: boolean;
    autoUnhover?: boolean | "css-selector"
    reachable?: null | boolean // null means "in modes for mouse events and settings.mouseReachable"
    richText?: boolean | "safe" | "with-name" | "safe-with-name" | ""
    visual?: false;
    suppressInput?: boolean
    xy?: StdXY | [x: number | "count", y: number | "count", scale?: number]
        | `${number}, ${number}` | number | string | boolean | void
  }
  interface StdXY { x: number | "count", y: number | "count", n: number, s: number }
}

interface InsertModeOptions {
  /** stripped key */ k: string | null;
  /** passExitKey */ p: boolean;
  /** hud message */ h: string | null
}
interface ShowHelpDialogOptions {
  h?: null
  /** forced to show */ f?: false | null
  exitOnClick?: boolean | null
  commandNames?: boolean | null
}
interface TrailingSlashOptions {
  trailingSlash?: boolean | null
  /** (deprecated) */ trailing_slash?: boolean | null
}

declare const enum kScFlag { scBy = 0, INC = 1, TO = 2, toMin = 2, toMax = 3, _mask = "mask" }

interface CmdOptions {
  [kFgCmd.linkHints]: HintsNS.Options;
  [kFgCmd.marks]: {
    /** action */ a: kMarkAction.goto | kMarkAction.create
    /** not store a persistent mark for number keys */ n: boolean
    /** swap shiftKey */ s: boolean
    /** action title */ t: string
    /** extra options */ o: OpenPageUrlOptions & Req.FallbackOptions
  }
  [kFgCmd.scroll]: {
    /** continuous */ $c?: kKeyCode;
    axis?: "y" | "x";
    smooth?: boolean
    keepHover?: true | false | "auto" | "never" | /* or >= 20 */ 20
    acrossFrames?: true | false
    scrollable?: "host-re##css-selector;..."
    wait?: number | boolean | null
    minDuration?: number // default to 100 for 100 pixels
    dir?: 1 | -1 | 0.5 | -0.5;
    offset?: number
    /** inner flags */ f?: kScFlag & number
  } & Pick<CSSOptions, "evenIf" | "scroll"> & ({
    view?: 0 | /** means 0 */ undefined | 1 | "max" | /* all others are treated as "view" */ 2 | "view";
    dest?: undefined;
  } | {
    dest: "min" | "max";
    view?: undefined;
    sel?: "clear";
  }) & Req.FallbackOptions
  [kFgCmd.toggle]: {
    k: keyof SettingsNS.FrontendSettingsSyncingItems;
    n: string; // `"${SettingsNS.FrontendSettingsSyncingItems[keyof SettingsNS.FrontendSettingsSyncingItems][0]}"`
    v: SettingsNS.FrontendSettings[keyof SettingsNS.FrontendSettings] | null;
  };
  [kFgCmd.passNextKey]: {
    normal?: boolean | "force"; expect: "<any-key>"; consume?: boolean; ignoreCase?: boolean
  } & Req.FallbackOptions
  [kFgCmd.framesGoBack]: (Pick<OpenUrlOptions, "reuse" | "position"> & { r?: null }
      | { r: 1 } & ({ u: string; hard?: undefined } | { u?: undefined; hard?: boolean })) & Req.FallbackOptions
  [kFgCmd.goToMark]: {
    /** global */ g: boolean
    /** scroll */ s: MarksNS.ScrollInfo
    /** mark tip */ t: string
    /** fallback */ f: Req.FallbackOptions
    /** wait a while */ w: number
  }
  [kFgCmd.vomnibar]: {
    /* vomnibar */ v: string;
    /* vomnibar2 */ i: string | null;
    /** pageType */ t: VomnibarNS.PageType;
    /** trailingSlash */ s: boolean | null | undefined;
    /** <script> */ j: string;
    /** secret */ k: string
    /** exitOnClick */ e: boolean;
  } & Pick<VomnibarNS.GlobalOptions, "u" | "url">
  [kFgCmd.goNext]: {
    /** rel */ r: string;
    /** isNext */ n: boolean;
    /** patterns */ p: string[];
    /** length limit list */ l: number[];
    /** max of length limit list */ m: number;
    /** scroll into view */ v: boolean;
    /** avoid click */ a: boolean;
  } & EnsureExisting<CSSOptions> & Req.FallbackOptions;
  [kFgCmd.insertMode]: ({
    /** unhover last */ u?: boolean;
    /** reset all: 2=destroying */ r?: 0 | 1 | 2;
    /** insert mode */ i?: false;
  } | {
    /** unhover last */ u?: boolean;
    /** reset all: 2=destroying */ r: 0 | 1 | 2;
    /** insert mode */ i: boolean;
  } & InsertModeOptions) & Req.FallbackOptions & { /** enable bubbles when unhovering */ bubbles?: boolean }
  [kFgCmd.visualMode]: {
    /** mode */ m?: VisualModeNS.Mode.Visual | VisualModeNS.Mode.Line | VisualModeNS.Mode.Caret;
    /** find CSS */ f?: FindCSS | null
    /** kGranularity[] */ g?: GranularityNames | null;
    /** keyMaps */ k?: VisualModeNS.KeyMap | null;
    /** words */ w?: string;
    /** collapse to start */ s?: boolean | null
    /** richText */ t?: boolean
  } & OpenPageUrlOptions & Req.FallbackOptions
  [kFgCmd.showHelpDialog]: {
    /** html */ h: "html" | /** for Firefox */ { /** head->style */ h: string; /** body */ b: string };
    /** forced to show */ f?: boolean
    /** optionUrl */ o: string;
    /** exitOnClick */ e: boolean;
    /** advanced */ c: boolean;
  } & Partial<BgCSSReq> | ShowHelpDialogOptions
  [kFgCmd.findMode]: {
    /** count */ c: number;
    /** highlight multiple times in a single direction */ m: number
    /** leave find mode */ l: BOOL
    /** query */ q: string;
    /* return to view port */ r: boolean;
    /* auto use selected text */ s: boolean;
    /** findCSS */ f: FindCSS | null;
    /** use post mode on esc */ p: boolean;
    /** restart finding */ e: boolean;
    /** normalize text */ n: boolean
  } & Req.FallbackOptions
  [kFgCmd.autoOpen]: {
    /** for autoOpen */
    o?: 1;
    reuse?: UserReuseType;
    copy?: boolean;
    /** for autoCopy */
    text?: string
    url?: boolean | "raw"
    /** for searchAs */
    s?: 1;
    /** default to true */ selected?: boolean;
  } & {
    /** default to true */ copied?: boolean | "urls" | "any-urls";
  } & UserSedOptions & OpenPageUrlOptions & Req.FallbackOptions
  [kFgCmd.focusInput]: {
    act?: "" | "backspace" | "switch" | "last" | "last-visible";
    action?: "" | "backspace" | "switch" | "last" | "last-visible";
    verify?: boolean
    select?: SelectActions;
    keep?: boolean;
    passExitKey?: boolean;
    flash?: boolean;
    reachable?: boolean; // default to true
    prefer?: string;
  } & CSSOptions & Req.FallbackOptions
  [kFgCmd.editText]: {
    dom?: boolean;
    run: string;
  } & OptionsToFindElement & Req.FallbackOptions
  [kFgCmd.scrollSelect]: {
    position?: "begin" | "home" | "start" | "end" | "last"
    dir?: "down" | "next" | "prev" | "up" | 1 | -1
  } & Req.FallbackOptions;
  [kFgCmd.toggleStyle]: ({
    selector?: undefined
    id: string
    css?: string
  } | {
    selector: string
    id?: undefined
    css?: undefined
  }) & { disabled?: boolean } & Req.FallbackOptions
  [kFgCmd.dispatchEventCmd]: {
    /* error msg */ e?: string; /* .click */ c?: 1; /** as-trusted-keyboard-event */ t?: boolean
    class?: string
    type: string // if count < 0, then replace "down" with "up"
    key: string | `${string},${number}${string}` | [ key: `<${string}>` | string, keyCode: number, code?: string ]
    match?: string
    return?: boolean
    delay?: number
    esc?: true // if true, then call onEscDown({ repeat: count > 1 })
    click?: true // if true, call `activeElement.click()` directly
    init?: Dict<any>
    xy?: null | HintsNS.Options["xy"]
    trust?: boolean; trusted?: boolean; isTrusted?: boolean | "force"
  } & OptionsToFindElement & Req.FallbackOptions & EventInit
  [kFgCmd.callTee]: {
    /** url */ u: string
    /** className */ c: string
    /** allow */ a: string
    /** timeout */ t: number
    /** current frame's ID */ i: number
  }
}

declare const enum kMarkAction {
  goto = 0,
  create = 1,
  clear = 2,
  _mask = "mask",
}

declare const enum SedContext {
  NONE = 0,
  /** `c` */ copy = 1 << 2,
  /** `g` */ gotoUpperUrl = 1 << 6,
  /** `i` */ image = 1 << 8,
  /** `m` */ multiline = 1 << 12,
  /** `n` */ goNext = 1 << 13,
  /** `o` */ omni = 1 << 14,
  /** `p` */ paste = 1 << 15,
  /** `r` */ goToRoot = 1 << 17,
  /** `t` */ pageText = 1 << 19,
  /** `u` */ pageURL = 1 << 20,
  NO_STATIC = 1 << 30,
}

interface ParsedUpperUrl { /** url */ u: string; /** path */ p: string | null }

interface FgRes {
  [kFgReq.findQuery]: string;
  [kFgReq.parseSearchUrl]: ParsedSearch | null;
  [kFgReq.execInChild]: boolean;
  [kFgReq.i18n]: /** rawMessages */ string[]
  [kFgReq.wait]: TimerType.fake
  [kFgReq.pages]: { /** id of query array */ i: number; /** answers */ a: unknown[] } | false
  [kFgReq.recheckTee]: /** has the TEE task been used */ boolean
  [kFgReq.afterTee]: FrameMaskType
  [kFgReq.blank]: 0
}
interface FgReqWithRes {
  [kFgReq.findQuery]: /** index */ number
  [kFgReq.parseSearchUrl]: {
    /** url */ u: string;
    /** upper */ p?: undefined;
    /** suggestionId */ i?: undefined
  } | Omit<FgReq[kFgReq.parseUpperUrl], "e">
  [kFgReq.execInChild]: {
    /** target frameId */ f?: number;
    /** url */ u: string;
    /** lastKey */ k: kKeyCode;
    /** ensured args */ a: FgOptions;
  } & Omit<BaseExecute<FgOptions, FgCmdAcrossFrames>, "H">;
  [kFgReq.i18n]: 0
  [kFgReq.wait]: number
  [kFgReq.pages]: FgReq[kFgReq.pages]
  [kFgReq.recheckTee]: 0
  [kFgReq.afterTee]: /** iframe id; non-positive means on error */ number
  [kFgReq.blank]: 0
}

interface FgReq {
  [kFgReq.fromInjectedPages]: {
    handler: kFgReq & string | 42
    /* for kFgReq.tip */ tip?: string
  };
  [kFgReq.setSetting]: SetSettingReq<keyof SettingsNS.FrontUpdateAllowedSettings>;
  [kFgReq.parseSearchUrl]: {
    /** suggestionId */ i: number
    /** url */ u: string;
  };
  [kFgReq.parseUpperUrl]: {
    /** url */ u: string;
    /** upper */ p: number;
    /** appended */ a?: string;
    /** force */ f?: BOOL;
    /** suggestionId */ i?: undefined
    /** trailingSlash */ t: boolean | null | undefined;
    /** (deprecated) trailingSlash (old) */ r?: boolean | null | undefined;
    /** sed : not for kFgReq.parseSearchUrl */ s?: MixedSedOpts | null;
    /** reloadOnRoot / result */ e?: boolean | ParsedUpperUrl
  };
  [kFgReq.findQuery]: {
    /** query */ q: string;
    /** index */ i?: undefined;
  };
  [kFgReq.gotoSession]: {
    /** sessionId */ s: CompletersNS.SessionId
    /** active: default to true  */ a?: boolean;
  };
  [kFgReq.openUrl]: {
    // note: need to sync members to ReqH::openUrl in main.ts
    /** url */ u?: string;
    /** options */ o?: ParsedOpenPageUrlOptions | null
    /** command options with "$" */ n?: CmdOptions[kFgCmd.autoOpen]
    /** formatted-by-<a>.href */ f?: boolean;
    /** copied */ c?: boolean | "urls" | "any-urls";
    /** https */ h?: boolean | null;
    /** a fallback of reuse, in case of `! .o.reuse` */ r?: ReuseType
    /** linkhints .newtab */ t?: HintsNS.Options["newtab"]
  } & Partial<WithHintModeOptions>
  [kFgReq.searchAs]: {
    /** url */ u: string;
    /** selected text */ t: string;
    /** options for openUrl */ o?: ParsedOpenPageUrlOptions | null
    /** command options with "$" */ n: CmdOptions[kFgCmd.autoOpen]
    /** copied */ c: boolean | "urls" | "any-urls" | undefined;
  };
  [kFgReq.onFrameFocused]: {};
  [kFgReq.checkIfEnabled]: {
    /** url */ u: string;
  };
  [kFgReq.nextFrame]: {
    /** type */ t?: Frames.NextType;
    /** key */ k: kKeyCode;
    /** fallback options */ f?: Req.FallbackOptions;
    /** focus at once, because on-omni-exit */ o?: boolean
  };
  [kFgReq.exitGrab]: {};
  [kFgReq.execInChild]: FgReqWithRes[kFgReq.execInChild]
  [kFgReq.initHelp]: {
    /** forced to show */ f?: boolean
    /** wantTop */ w?: boolean;
    /** args */ a?: ShowHelpDialogOptions
  };
  [kFgReq.css]: {};
  [kFgReq.vomnibar]: ({
    /** url */ u: string
    /** newtab */ t?: HintsNS.Options["newtab"]
    /** forwarded options */ f: object | string | null | undefined
    /** only use .keyword and sed */ o: Pick<ParsedOpenPageUrlOptions, "k" | "s">
    /** redo */ r?: undefined;
  } & WithHintModeOptions | {
    /** url */ u?: undefined
    /** redo */ r: boolean;
  }) & {
    /** inner */ i?: boolean;
  };
  [kFgReq.omni]: {
    /** query */ q: string;
    /** favIcon */ i?: 0 | 1 | 2;
  } & CompletersNS.Options;
  [kFgReq.copy]: ({
    /** data */ s: string | any[];
    /** [].join($j) */ j?: string | boolean | null
    u?: undefined | ""
    i?: undefined
  } & Partial<WithHintModeOptions> | {
    /** url */ u: "url";
    /** data */ s?: undefined
    j?: undefined | null
    i?: undefined
  } | {
    /** data: image URL */ i: "data:" | ""
    /** source URL */ u: string
    j?: undefined
    /** richText */ r: HintsNS.Options["richText"]
  }) & {
    /** sed and keyword */ o?: ParsedOpenPageUrlOptions;
    /** decode by default */ d?: boolean;
  };
  [kFgReq.key]: {
    /* keySequence */ k: string;
    /** lastKey */ l: kKeyCode;
  } & Pick<FgReq[kFgReq.respondForRunKey], "e">
  [kFgReq.nextKey]: {
    /* keySequence */ k: string
    /** $then/$else info */ f?: {
      /** context: counter and last tip */ c: Req.FallbackOptions["$f"];
      /** maxRetried */ r: number | null | undefined
      /** kTip | 0 | 2: tip; false: tab will be updated */ u: kTip | false;
      /** wait for a while; 0 means no waiting */ w?: number | null
    }
  };
  [kFgReq.marks]: { c: kMarkAction.clear, f: Req.FallbackOptions | null; /** url */ u: string; } | ({
      /** all command options */ c: CmdOptions[kFgCmd.marks]
      /** forced (aka. not find another port any more) */ f?: boolean
      /** last key */ k: kKeyCode
  } & MarksNS.FgQuery)
  [kFgReq.didLocalMarkTask]: { c: CmdOptions[kFgCmd.marks]; /** index */ i: number; /** no old */ n: boolean }
  /**
   * .url is guaranteed to be well formatted by frontend
   */
  [kFgReq.focusOrLaunch]: MarksNS.FocusOrLaunch;
  [kFgReq.cmd]: Pick<BgReq[kBgReq.count], "c" | "i"> & {
    /** count */ n: number;
    /** confirmation-response: 0=fail, 1=cancel, 2=force1, 3=confirm */ r: 0 | 1 | 2 | 3
  };
  [kFgReq.removeSug]: {
    /** type */ t: "tab" | "history";
    /** sessionId / tabId */ s?: CompletersNS.SessionId | null
    /** url */ u: string
  } | { t: "e" }
  [kFgReq.openImage]: {
    /** file */ f: string | null;
    /** url */ u: string;
    /** other options */ t?: string;
    /** options for openUrl */ o?: ParsedOpenPageUrlOptions
    /** auto: default to true */ a?: boolean;
  } & WithHintModeOptions
  [kFgReq.evalJSFallback]: {
    u: string
  }
  [kFgReq.gotoMainFrame]: {
    /** command */ c: FgCmdAcrossFrames;
    /** focusMainFrame and showFrameBorder */ f: BOOL;
    /** count */ n: number;
    /** options */ a: OptionsWithForce;
  };
  [kFgReq.setOmniStyle]: {
    /** toggled */ t: string;
    /** enable */ e?: boolean; /* if null, then toggle .t */
    /** override-system-settings */ o?: 1; // `o === 1` and `b === false` should never be true in the meanwhile
    /** broadcast, default to true */ b?: boolean;
  };
  [kFgReq.findFromVisual]: {};
  [kFgReq.framesGoBack]: {
    /** step */ s: number
    /** only use o.position */ o: PickIn<Extract<CmdOptions[kFgCmd.framesGoBack], {r?: null}>
        , keyof OpenUrlOptions | keyof Req.FallbackOptions>
  }
  [kFgReq.cssLearnt]: {};
  [kFgReq.visualMode]: {
    /** caret mode */ c?: boolean
    /** forwarded options */ f: object | string | null | undefined
  };
  [kFgReq.respondForRunKey]: {
    r: BgReq[kBgReq.queryForRunKey]
    /** active element */ e: [tag: string, id: string, className: string | null] | null
  }
  [kFgReq.downloadLink]: {
    /** url */ u: string
    /** filename */ f: string | null
    /** referer */ r: string | 0
    /** other options */ o: ParsedOpenPageUrlOptions | null
  } & WithHintModeOptions
  [kFgReq.optionToggled]: { k: string, v: unknown }
  [kFgReq.keyFromOmni]: { /* keySequence */ k: string; /** lastKey */ l: kKeyCode;
  } & Pick<FgReq[kFgReq.respondForRunKey], "e">
  [kFgReq.pages]: { /** id of query array */ i: number; /** queries */ q: unknown[] }
  [kFgReq.showUrl]: { u: string }
  [kFgReq.omniCopy]: { /** title */ t: string, /** url */ u: string }
}

interface CurrentEnvCache {} // eslint-disable-line @typescript-eslint/no-empty-interface

interface WithHintModeOptions { /** hint mode "w/ or w/o" queue info */ m: HintMode }

interface OpenUrlOptions extends UserSedOptions {
  group?: true | null | false
  incognito?: boolean | /** even when url is like chrome-extension:// */ "force" | "reverse" | "keep" | "same" | null
  opener?: boolean | null
  pinned?: boolean | null
  position?: null | "next" | "prev" | "previous" | "left" | "right" | "start" | "begin" | "end" | "before" | "after"
      | "default"
  reuse?: UserReuseType | null
  window?: boolean | "popup" | "normal" | null
}

interface OpenPageUrlOptions extends OpenUrlOptions {
  keyword?: string | null; replace?: string | ValidUrlMatchers | null
  testUrl?: /** use `! .keyword` */ null | boolean | "whole" | "whole-string"
  decoded?: boolean | null; /** alias of "decoded" */ decode?: boolean | null
}
interface _ParsedOpenPageUrlOptionNames {
  g: "group"; i: "incognito"; k: "keyword"; m: "replace"
  o: "opener"; p: "position"; r: "reuse"; t: "testUrl"; w: "window"
}
type BaseParsedOpenPageUrlOptions = {
  [k in keyof _ParsedOpenPageUrlOptionNames]?: _ParsedOpenPageUrlOptionNames[k] extends keyof OpenPageUrlOptions
    ? OpenPageUrlOptions[_ParsedOpenPageUrlOptionNames[k]] : never
}
type SimpleParsedOpenUrlOptions = Pick<BaseParsedOpenPageUrlOptions, "g" | "i" | "m" | "o" | "p" | "r" | "w">
interface ParsedOpenPageUrlOptions extends BaseParsedOpenPageUrlOptions {
  /** sed */ s?: ParsedSedOpts | null
  /** decoded */ d?: boolean | null
}

declare namespace Req {
  interface baseBg<K extends kBgReq> {
    /** name */ N: K;
  }
  type bg<K extends kBgReq> =
    K extends keyof BgReq ? BgReq[K] & baseBg<K> :
    K extends keyof BgVomnibarSpecialReq ? BgVomnibarSpecialReq[K] & baseBg<K> :
    never;
  type queryUrl<K extends kFgReq> = K extends keyof FgReq ? "u" extends keyof FgReq[K]
      ? Omit<FgReq[K], "u"> & BgReq[kBgReq.url] & Req.baseFg<K> : never : never
  type bgUrl<K extends kFgReq> = queryUrl<K> & baseBg<kBgReq.url>
  interface baseTee<K extends kTeeTask> extends Omit<BaseTeeTask, "t" | "s" | "d"> { t: K }
  type tee<K extends keyof TeeTasks> = Pick<TeeTasks[K], "s"> & PartialOf<TeeTasks[K], "d"> & baseTee<K>
  interface baseFg<K extends kFgReq> {
    /** handler */ H: K;
  }
  type fg<K extends keyof FgReq> = FgReq[K] & baseFg<K>;

  interface fgWithRes<K extends keyof FgRes> extends baseFg<kFgReq.msg> {
    /** msgId */ i: number;
    /** message */ readonly c: K;
    /** argument */ readonly a: FgReqWithRes[K];
  }
  interface res<K extends keyof FgRes> extends bg<kBgReq.msg> {
    readonly r: FgRes[K];
  }

  interface FgCmd<O extends keyof CmdOptions> extends BaseExecute<CmdOptions[O], O>, baseBg<kBgReq.execute> {}
  interface FallbackOptions {
    /** key sequence if succeed */ $then?: string | null
    /** key sequence if fail */ $else?: string | null
    /** [1..20] */ $retry?: number | null
    /** fallback context */ $f?: {
      /** curRetried */ i: number
      /** lastTip */ t: kTip | 0
    } | null
  }
}

interface SetSettingReq<T extends keyof SettingsNS.FrontUpdateAllowedSettings> extends Req.baseFg<kFgReq.setSetting> {
  /** key */ k: SettingsNS.FrontUpdateAllowedSettings[T];
  /** value */ v: T extends keyof SettingsNS.BaseBackendSettings ? SettingsNS.BaseBackendSettings[T] : never;
}

interface ExternalMsgs {
  [kFgReq.id]: {
    req: {
      handler: kFgReq.id;
    };
    res: {
      name: string;
      host: string;
      injector: string;
      shortcuts: boolean;
      version: string;
    };
  };
  [kFgReq.inject]: {
    req: {
      handler: kFgReq.inject;
      scripts?: boolean;
    };
    res: {
      version: string;
      host: string;
      /** the blow are only for inner usages  */
      /** scripts */ s: string[] | null;
      /** versionHash */ h: string;
    };
  };
  [kFgReq.command]: {
    req: {
      handler: kFgReq.command;
      command?: string;
      options?: object | null;
      count?: number;
      key?: kKeyCode;
    };
    res: void;
  };
  [kFgReq.shortcut]: {
    req: {
      handler: kFgReq.shortcut;
      shortcut?: string;
    };
    res: void;
  };
}

interface BgExports {
  onPagesReq? (req: FgReqWithRes[kFgReq.pages]): Promise<FgRes[kFgReq.pages]>
}
