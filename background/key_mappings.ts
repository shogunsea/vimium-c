import {
  bgIniting_, CONST_, os_, keyFSM_, keyToCommandMap_, mappedKeyRegistry_, mappedKeyTypes_, omniPayload_,
  OnChrome, OnEdge, OnFirefox, OnOther_, set_keyFSM_, set_keyToCommandMap_, set_mappedKeyRegistry_, set_mappedKeyTypes_,
  settingsCache_, updateHooks_, CurFFVer_
} from "./store"
import * as BgUtils_ from "./utils"
import * as settings_ from "./settings"
import * as Exclusions from "./exclusions"

declare const enum kCxt { fg = 0, bg = 1 }
type WiderOmit<T, K> = Pick<T, Exclude<keyof T, K>>
type RawCmdDesc<c extends kCName, e extends CmdNameIds[c] = CmdNameIds[c]> =
    e extends keyof CmdOptions ? [alias: e, bg: 0, repeat: 0 | 1
        , options?: CmdOptions[e] & CommandsNS.SharedPublicOptions]
    : e extends keyof BgCmdOptions ? [alias: e, bg: 1, repeat: 0 | 1
        , options?: e extends keyof StatefulBgCmdOptions
          ? StatefulBgCmdOptions[e] extends null ? never
            : Partial<WiderOmit<BgCmdOptions[e], StatefulBgCmdOptions[e]> & CommandsNS.SharedPublicOptions>
          : Partial<BgCmdOptions[e]> & CommandsNS.SharedPublicOptions
    ] : never
/** [ enum, is background, count limit, default options ] */
type NameMetaMap = {
  readonly [k in keyof CmdNameIds]: RawCmdDesc<k>
}
interface OtherCNamesForDebug { focusOptions: kBgCmd.openUrl }
type NameMetaMapEx = NameMetaMap & {
  readonly [k in keyof OtherCNamesForDebug]: OtherCNamesForDebug[k] extends keyof BgCmdOptions
      ? RawCmdDesc<kCName, OtherCNamesForDebug[k]> : never
}
type ValidMappingInstructions = "map" | "run" | "mapkey" | "mapKey" | "env" | "shortcut" | "command"
    | "unmap" | "unmap!" | "unmapAll" | "unmapall"

const keyRe_ = <RegExpG & RegExpSearchable<0>> /<(?!<)(?:.-){0,4}.\w*?(?::i)?>|./g /* need to support "<<left>" */
let builtinOffset_: number
let shortcutRegistry_: Map<StandardShortcutNames, CommandsNS.Item | null> | null | undefined
let envRegistry_: Map<string, CommandsNS.EnvItem | "__not_parsed__" | null> | null | undefined
let flagDoesCheck_ = true
let errors_: null | string[][] = null
let nonNumList_: Set<string> | null | undefined

export { keyRe_, envRegistry_, shortcutRegistry_, errors_ as keyMappingErrors_ }

export const stripKey_ = (key: string): string =>
    key.length > 1 ? key === "<escape>" ? kChar.esc : key.slice(1, -1) : key

const wrapKey_ = (key: string): string => key.length > 1 ? `<${key}>` : key

/** should never export it, to avoid `logError_` crashes */
const getOptions_ = (line: string, start: number): CommandsNS.RawOptions | "__not_parsed__" | null => {
  return line.length <= start ? null
      : line.includes(" $", start) || line.includes(" =", start)
      ? parseOptions_(line.slice(start + 1), line.includes(" $if={", start) ? 0 : 1)
      : line.slice(start + 1) as "__not_parsed__"
}

export const parseOptions_ = ((options_line: string, fakeVal?: 0 | 1 | 2): CommandsNS.RawOptions | string | null => {
  let opt: CommandsNS.RawOptions = BgUtils_.safeObj_(), hasOpt = 0
  for (let str of options_line.split(" ")) {
    const ind = str.indexOf("=")
    if ("$#/=_".includes(str[0])) {
      if (ind === 0 || str === "__proto__"
          || str[0] === "$" && !"$if=$key=$desc=$count=$then=$else=$retry=".includes(str.slice(0, ind + 1))) {
        (fakeVal === 0 || fakeVal === 1) && logError_("%s option key:", ind === 0 ? "Missing" : "Unsupported", str)
        continue
      } else if (str[0] === "#" || str.startsWith("//")) { // treat the following as comment
        break
      }
    }
    if (ind < 0) {
      opt[str] = true;
      hasOpt = 1
    } else {
      const val = str.slice(ind + 1)
      str = str.slice(0, ind);
      opt[str] = typeof fakeVal === "number" ? fakeVal === 2 ? val && parseVal_limited(val) : 1 : val && parseVal_(val)
      hasOpt = 1
    }
  }
  return hasOpt === 1 ? fakeVal === 1 ? options_line : opt : null
}) as {
  (options_line: string, fakeVal: 0 | 1): CommandsNS.RawOptions | "__not_parsed__" | null
  (options_line: string, lessException?: 2): CommandsNS.RawOptions | null
}

export const parseVal_ = (val: string): any => {
    try {
      return JSON.parse(val);
    } catch {}
    return val;
}

const parseVal_limited = (val: string): any => {
  let n: number | undefined
  return val === "false" ? false : val === "null" ? null : val === "true" ? true
      : (val >= "0" ? val < kChar.minNotNum : val[0] === "-") ? (n = parseFloat(val)) + "" === val ? n
        : !(<RegExpOne> /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]\d+)?$/).test(val) ? val : !isNaN(n) ? n : parseVal_(val)
      : '{["'.includes(val[0]) ? parseVal_(val) : val
}

export const normalizeCommand_ = (cmd: Writable<CommandsNS.BaseItem>, details?: CommandsNS.Description
      ): cmd is CommandsNS.NormalizedItem => {
    let options: CommandsNS.RawOptions | string | null = cmd.options_
    if (details === undefined) { details = availableCommands_[cmd.command_] }
    let opt: CommandsNS.Options | null
    opt = details.length < 4 ? null : BgUtils_.safer_(details[3]!);
    if (typeof options === "string") {
      options = parseOptions_(options)
    }
    if (options) {
      if ("$count" in options || "count" in options) {
        details[2] === 1 ? delete options.$count
        : options.$count = options.$count != null ? parseFloat(options.$count) || 1
              : (parseFloat(options.count || 1) || 1) * (opt && opt.$count || 1)
        delete options.count
      }
      if (options.$if) {
        if (doesMatchEnv_(options) === false) { return false }
        delete options.$if;
      }
      if (opt) {
        BgUtils_.extendIf_<CommandsNS.RawOptions, CommandsNS.RawOptions>(options, opt)
      }
      if (details[0] === kFgCmd.linkHints && !details[1]) {
        const lhOpt = options as Partial<HintsNS.Options> & CommandsNS.RawLinkHintsOptions
        let mode = lhOpt.mode, stdMode = lhOpt.m!
        const rawChars = lhOpt.characters
        const action = lhOpt.action
        const chars = !rawChars || typeof rawChars !== "string" ? null
            : BgUtils_.dedupChars_(settings_.updatePayload_<"c" | "n">("c", rawChars))
        if (chars && chars.length < GlobalConsts.MinHintCharSetSize) {
          cmd.alias_ = kBgCmd.showHUD
          cmd.background_ = 1
          cmd.options_ = BgUtils_.safer_<KnownOptions<kBgCmd.showHUD>>({
            text: "Too few characters for LinkHints", isError: true
          })
          cmd.repeat_ = 1
          return true
        }
        chars ? lhOpt.c = chars : "c" in lhOpt && delete lhOpt.c
        rawChars != null && delete lhOpt.characters
        "action" in lhOpt && delete lhOpt.action
        "mode" in lhOpt && delete lhOpt.mode
        mode = action ? hintModes_[action] : typeof mode === "number" ? mode : mode ? hintModes_[mode] : null
        mode = mode != null ? mode : Math.max(0, stdMode | 0)
        if (mode > HintMode.max_mouse_events) {
          mode = mode === HintMode.EDIT_TEXT ? lhOpt.url ? HintMode.EDIT_LINK_URL : mode
            : mode === HintMode.COPY_TEXT ? !lhOpt.url
              ? lhOpt.join != null ? HintMode.COPY_TEXT | HintMode.queue | HintMode.list : mode
              : lhOpt.join != null ? HintMode.COPY_URL | HintMode.queue | HintMode.list : HintMode.COPY_URL
            : mode > HintMode.min_disable_queue + HintMode.queue - 1 ? mode - HintMode.queue : mode;
        }
        if (lhOpt.xy !== void 0) { lhOpt.xy = BgUtils_.normalizeXY_(lhOpt.xy) }
        lhOpt.direct && (mode &= ~HintMode.queue)
        if (mode !== stdMode) {
          lhOpt.m = mode
        }
        if (mode > HintMode.min_disable_queue - 1) {
          cmd.repeat_ = 1
        }
      }
    } else {
      options = opt;
    }
    cmd.options_ = options
    return true
}

export const makeCommand_ = <T extends CommandsNS.RawOptions | "__not_parsed__" | null> (
    command: kCName, options: T, details?: CommandsNS.Description
    ): CommandsNS.Item | (CommandsNS.RawOptions | "__not_parsed__" extends T ? null : never) => {
  if (details === undefined) { details = availableCommands_[command] }
  const cmd: Writable<CommandsNS.BaseItem> = {
      alias_: details[0] as Exclude<typeof details[0], kFgCmd>,
      background_: details[1] as Exclude<typeof details[1], 0>,
      command_: command,
      options_: options || (details.length < 4 ? null : BgUtils_.safer_(details[3]!)),
      hasNext_: null,
      repeat_: details[2]
  }
  if (options && typeof options === "object") {
    if (!normalizeCommand_(cmd, details)) {
      return null as CommandsNS.RawOptions | string extends T ? null : never
    }
  }
  return cmd as CommandsNS.Item
}

export const normalizedOptions_ = (item: CommandsNS.ValidItem): CommandsNS.NormalizedItem["options_"] => {
  let opts = item.options_
  if (typeof opts === "string") {
    normalizeCommand_(item)
    opts = (item as CommandsNS.NormalizedItem).options_
  }
  return opts
}

const hasIfOption = (line: string, start: number): boolean => {
  let ind: number
  return line.length > start && (ind = line.indexOf(" $if={", start)) > 0
      && !(<RegExpOne> / (#|\/\/)/).test(line.slice(start, ind + 2))
}

const doesMatchEnv_ = (options: CommandsNS.RawOptions | string | null): boolean | null => {
    const condition = options && typeof options === "object" && options.$if
    return condition && typeof condition === "object" ? condition.sys && condition.sys !== CONST_.Platform_
        || !!condition.before && condition.before.replace("v", "") <= CONST_.VerCode_
        || !!condition.browser
          && !(condition.browser & (Build.BTypes && !(Build.BTypes & (Build.BTypes - 1))
                ? Build.BTypes : OnOther_)) ? true : false
        : null
}

const parseKeyMappings_ = (wholeMappings: string): void => {
    let lines: string[], mk = 0, _i = 0, key2: string | undefined
      , _len: number, details: CommandsNS.Description | undefined, tmpInt: number
      , registry = new Map<string, CommandsNS.Item>()
      , cmdMap: typeof shortcutRegistry_ = new Map(), envMap: typeof envRegistry_ = null
      , regItem: CommandsNS.Item | null, options: ReturnType<typeof getOptions_>
      , noCheck = false, builtinToAdd: string[] | null | 0 = null
      , mkReg = BgUtils_.safeObj_<string>();
    const colorRed = "color:red", shortcutLogPrefix = 'Shortcut %c"%s"';
    nonNumList_ = null
    lines = wholeMappings.replace(<RegExpSearchable<0>> /\\\\?\n/g, t => t.length === 3 ? "\\\n" : ""
               ).replace(<RegExpG> /[\t ]+/g, " ").split("\n");
    for (; _i < lines.length && (!lines[_i] || (key2 = lines[_i])[0] === kMappingsFlag.char0); _i++) {
      if (key2 && key2[1] === kMappingsFlag.char1) {
        key2 = key2.slice(2).trim()
        if (key2 === kMappingsFlag.noCheck) { noCheck = true }
      }
    }
    flagDoesCheck_ = !noCheck
    _i >= lines.length || lines[_i] !== "unmapAll" && lines[_i] !== "unmapall" || (builtinToAdd = 0, _i++)
    for (_len = lines.length; _i < _len; _i++) {
      const line = lines[_i].trim();
      if (line < kChar.minNotCommentHead) { continue; } // mask: /[!"#]/
      const _splitLine = line.split(" ", 3);
      const cmd = _splitLine[0] as ValidMappingInstructions | "__unknown__"
      const key = _splitLine.length > 1 ? _splitLine[1] : ""
      const val = _splitLine.length > 2 ? _splitLine[2] : ""
      const knownLen = cmd.length + key.length + val.length + 2
      let doesPass = noCheck
      switch (cmd) {
      case "map": case "run":
        const isRun = cmd === "run" && !(val in availableCommands_)
        details = undefined
        if (noCheck) { /* empty */
        } else if (!key || key.length > 8 && (key === "__proto__" || key.includes("<__proto__>"))) {
          logError_('Unsupported key sequence %c"%s"', colorRed, key || '""', `for "${val || ""}"`)
        } else if (registry.has(key) && !hasIfOption(line, knownLen)) {
          logError_('Key %c"%s"', colorRed, key, "has been mapped to", registry.get(key)!.command_)
        } else if (!val) {
          logError_((isRun ? "Lack target when running" : "Lack command when mapping") + ' %c"%s"', colorRed, key)
        } else if (!isRun && !(details = availableCommands_[val as kCName])) {
          logError_('Command %c"%s"', colorRed, val, "doesn't exist")
        } else if ((key >= "0" && key < kChar.minNotNum || key[0] === kChar.minus)
            && !(nonNumList_ && nonNumList_.has(key[0]))) {
          logError_('Invalid key: %c"%s"', colorRed, key
              , "- a first char can not be '-' or numbers, unless before is `unmap " + key[0] + "`")
        } else {
          doesPass = true
        }
        if (doesPass) {
          regItem = !isRun ? makeCommand_(val as Exclude<keyof typeof availableCommands_, "__proto__">
                , getOptions_(line, knownLen), details) : makeCommand_("runKey", getOptions_(` keys="${
                    val.replace(<RegExpG> /"|\\/g, "\\$&")}"` + line.slice(knownLen), 0), details)
          if (regItem) { // Object.keys before C38 still yields short keys first for \d+ keys, so here is safe enough
            registry.set(key, regItem)
          }
        }
        break
      case "unmapAll": case "unmapall":
        registry = new Map(), cmdMap = new Map(), envMap = null, nonNumList_ = null
        mkReg = BgUtils_.safeObj_<string>(), mk = builtinToAdd = 0
        if (errors_) {
          logError_("All key mappings is unmapped, but there %s been %c%d error%s%c before this instruction"
              , errors_.length > 1 ? "have" : "has"
              , colorRed, errors_.length, errors_.length > 1 ? "s" : "", "color:auto")
        }
        break
      case "mapKey": case "mapkey":
        if (noCheck) { key2 = stripKey_(key) }
        else if (!val || line.length > knownLen
            && !(<RegExpOne> /^(#|\/\/|\$if=\{)/).test(line.slice(knownLen).trimLeft())) {
          logError_("mapKey: need %s source and target keys:", val ? "only" : "both", line)
        } else if (key.length > 1 && !(<RegExpOne> /^<(?!<[^:]|__proto__>)([acms]-){0,4}.\w*(:[a-z])?>$/).test(key)) {
          logError_("mapKey: a source key should be a single key with an optional mode id:", line)
        } else if (val.length > 1 && !(<RegExpOne> /^<(?!<|__proto__>)([a-z]-){0,4}.\w*>$/).test(val)) {
          logError_("mapKey: a target key should be a single key:", line)
        } else if (key2 = stripKey_(key), key2 in mkReg && mkReg[key2] !== stripKey_(val)) {
          if (nonNumList_ && nonNumList_.has(key2[0]) && key2.slice(1) === ":" + GlobalConsts.NormalModeId) {
            if (doesMatchEnv_(getOptions_(line, knownLen)) !== false) {
              logError_("`mapKey %s` and `unmap %s...` can not be used at the same time", key, key2[0])
            }
          } else if (!hasIfOption(line, knownLen)) {
            logError_('The key %c"%s"', colorRed, key, "has been mapped to another key:"
                , mkReg[key2]!.length > 1 ? `<${mkReg[key2]!}>` : mkReg[key2]!)
          } else {
            doesPass = true
          }
        } else {
          doesPass = true
        }
        if (doesPass && doesMatchEnv_(getOptions_(line, knownLen)) !== false) {
          mkReg[key2!] = stripKey_(val)
          mk = 1;
        }
        break
      case "shortcut": case "command":
        if (noCheck) { /* empty */ }
        else if (!val) {
          logError_("Lack command name and options in shortcut:", line)
        } else if (!(key.startsWith(CNameLiterals.userCustomized) && key.length > 14)
            && (CONST_.GlobalCommands_ as Array<StandardShortcutNames | string>).indexOf(key) < 0) {
          logError_(shortcutLogPrefix, colorRed, key, "is not a valid name")
        } else if (cmdMap.has(key as StandardShortcutNames) && !hasIfOption(line, knownLen - 1 - val.length)) {
          logError_(shortcutLogPrefix, colorRed, key, "has been configured")
        } else {
          doesPass = true
        }
        if (doesPass) {
          options = getOptions_(line, knownLen - 1 - val.length)
          if (doesMatchEnv_(options) !== false) {
            key2 = /*#__NOINLINE__*/ setupShortcut_(cmdMap, key as StandardShortcutNames, options)
            key2 && logError_(shortcutLogPrefix, colorRed, key, key2)
          }
        }
        break
      case "env":
        if (noCheck) { /* empty */ }
        else if (!val) {
          logError_("Lack conditions in env declaration:", line)
        } else if (key === "__proto__") {
          logError_('Unsupported env name %c"%s"', colorRed, key)
        } else if (envMap && envMap.has(key) && !hasIfOption(line, knownLen - 1 - val.length)) {
          logError_('The environment name %c"%s"', colorRed, key, "has been used")
        } else {
          doesPass = true
        }
        if (doesPass) {
          options = getOptions_(line, knownLen - 1 - val.length)
          if (doesMatchEnv_(options) !== false) {
            (envMap || (envMap = new Map())).set(key, options)
          }
        }
        break
      case "unmap": case "unmap!":
        if (!key || val && !"#$".includes(val[0])) {
          logError_(`unmap: ${val ? "only " : ""}needs one mapped key:`, line)
        } else if (doesMatchEnv_(getOptions_(line, cmd.length + key.length + 1)) === false) { /* empty */
        } else if (tmpInt = -1, builtinToAdd !== 0
            && (tmpInt = (builtinToAdd || (builtinToAdd = defaultKeyMappings_.split(" "))).indexOf(key)) >= 0
            && !(tmpInt & 1) || registry.has(key)) {
          registry.delete(key)
          tmpInt < 0 || (builtinToAdd as Exclude<typeof builtinToAdd, 0 | null>)!.splice(tmpInt, 2)
        } else if (key.length === 1 && (key >= "0" && key < kChar.minNotNum || key[0] === kChar.minus)) {
          if (key2 = key + ":" + GlobalConsts.NormalModeId,
              key2 in mkReg && mkReg[key2] !== GlobalConsts.ForcedMapNum + key) {
            logError_("`unmap %s...` and `mapKey <%s>` can not be used at the same time", key, key2)
          } else if (nonNumList_ && nonNumList_.has(key)) {
            cmd !== "unmap!" && logError_('Number prefix: %c"%s"', colorRed, key, "has been unmapped")
          } else {
            (nonNumList_ || (nonNumList_ = new Set!())).add(key)
            mkReg[key2] = GlobalConsts.ForcedMapNum + key
            mk = 1
          }
        } else if (cmd !== "unmap!") {
          logError_('Unmap: %c"%s"', colorRed, key, "has not been mapped")
        }
        break
      default:
        logError_('Unknown mapping command: %c"%s"', colorRed, cmd satisfies "__unknown__", "in", line)
        break
      }
    }
    for (const shortcut of CONST_.GlobalCommands_) {
      if (!shortcut.startsWith("user") && !cmdMap.has(shortcut)) {
        if (regItem = makeCommand_(shortcut as Exclude<typeof shortcut, `user${string}`>, null)) {
          cmdMap.set(shortcut, regItem)
        }
      }
    }
    if (builtinToAdd !== 0) {
      builtinOffset_ = registry.size
      builtinToAdd || (builtinToAdd = defaultKeyMappings_.split(" "))
      for (_len = builtinToAdd.length, _i = 0; _i < _len; _i += 2) {
        registry.has(builtinToAdd[_i]) ||
        registry.set(builtinToAdd[_i], makeCommand_(builtinToAdd[_i + 1] as kCName, null))
      }
    }
    set_keyToCommandMap_(registry)
    shortcutRegistry_ = cmdMap
    envRegistry_ = envMap
    set_mappedKeyRegistry_(omniPayload_.m = mk ? mkReg : null)
}

const setupShortcut_ = (cmdMap: NonNullable<typeof shortcutRegistry_>, key: StandardShortcutNames
      , options: CommandsNS.RawCustomizedOptions | "__not_parsed__" | null): string => {
    options = options && typeof options === "string" ? parseOptions_(options) : options!
    let has_cmd: BOOL = 1
      , command: string = options && options.command || (has_cmd = 0, key.startsWith("user") ? "" : key)
      , regItem: CommandsNS.Item | null
      , ret: 0 | 1 | 2 = command ? 1 : 0;
    if (ret && (command in availableCommands_)) {
      has_cmd && delete options!.command
      if (regItem = makeCommand_(command as Exclude<keyof typeof availableCommands_, "__proto__">, options)) {
        cmdMap.set(key, regItem)
      }
      ret = 2;
    }
    return ret < 1 ? 'requires a "command" option' : ret > 1 ? "" : "gets an unknown command";
}

const collectMapKeyTypes_ = (mapKeys: SafeDict<string>): kMapKey => {
    let types = kMapKey.NONE
    for (const key in mapKeys) {
      const len = key.length
      if (len > 2 && key[len - 2] === ":") {
        types |= key[len - 1] === GlobalConsts.InsertModeId ? kMapKey.insertMode
            : key[len - 1] === GlobalConsts.NormalModeId ? kMapKey.normalMode : kMapKey.otherMode
      } else {
        let val = mapKeys[key]!, longVal = val.length > 1
        const plainAndWorkInInsert = longVal && (val === kChar.esc || val === "c-" + kChar.bracketLeft
            || val.startsWith("v-")
            || (val = val.slice(val.lastIndexOf("-") + 1)) < kChar.minNotF_num && val > kChar.maxNotF_num)
        types |= len > 1 || longVal ? plainAndWorkInInsert ? kMapKey.plain | kMapKey.plain_in_insert : kMapKey.plain
            : key.toUpperCase() !== key && val.toUpperCase() !== val ? kMapKey.char : kMapKey.plain
      }
    }
    return types
}

const populateKeyMap_ = (value: string | null): void => {
    const ref = new Map<string, ValidKeyAction | ChildKeyFSM>(),
    hasFoundChanges = value !== null, isOldWrong = errors_ !== null
    if (hasFoundChanges) {
      set_keyFSM_(errors_ = null)
      /*#__NOINLINE__*/ parseKeyMappings_(value)
    }
    const sortedKeys = BgUtils_.keys_(keyToCommandMap_),
    doesLog = hasFoundChanges && flagDoesCheck_
    if (hasFoundChanges) {
      set_mappedKeyTypes_((mappedKeyRegistry_ ? collectMapKeyTypes_(mappedKeyRegistry_) : kMapKey.NONE)
          | (sortedKeys.join().includes(":i>") ? kMapKey.directInsert : kMapKey.NONE))
    }
    let tmp: ChildKeyFSM | ValidChildKeyAction | undefined
    for (let index = 0; index < sortedKeys.length; index++) {
      const key = sortedKeys[index], arr = key.match(keyRe_)!, last = arr.length - 1
      const key1 = stripKey_(arr[0]), val1 = ref.get(key1) as KeyAction.cmd | ChildKeyFSM | undefined
      if (index >= builtinOffset_ && val1 !== undefined // a built-in mapping can only use up to 2 keys
          && (val1 === KeyAction.cmd || last === 0 || typeof val1[arr[1]] === "object")) {
            keyToCommandMap_.delete(key)
            continue;
      } else if (last === 0) {
        val1 !== undefined && doesLog && logInactive_(key, val1 as ReadonlyChildKeyFSM)
        ref.set(key1, KeyAction.cmd)
        continue;
      } else if (val1 === KeyAction.cmd) {
        doesLog && logInactive_(arr[0], key)
        continue
      }
      let ref2 = val1 satisfies ChildKeyFSM | undefined as ChildKeyFSM, j = 1
      val1 || ref.set(key1, ref2 = {})
      while ((tmp = ref2[stripKey_(arr[j])]) && tmp !== KeyAction.cmd && j < last) { j++; ref2 = tmp; }
      if (tmp === KeyAction.cmd) {
        doesLog && logInactive_(arr.slice(0, j + 1), key)
        continue;
      }
      tmp && doesLog && logInactive_(key, tmp)
      while (j < last) { ref2 = ref2[stripKey_(arr[j++])] = {} }
      ref2[stripKey_(arr[last])] = KeyAction.cmd
    }
    if (!nonNumList_) { /* empty */ }
    else if (!(Build.BTypes & BrowserType.Chrome) || Build.MinCVer >= BrowserVer.BuildMinForOf
        && Build.MinCVer >= BrowserVer.MinEnsuredES6$ForOf$Map$SetAnd$Symbol) {
      for (var nonNumItem of nonNumList_ as unknown as string[]) {
        const j = ref.get(nonNumItem); j && ref.set(GlobalConsts.ForcedMapNum + nonNumItem, j)
      }
    } else {
      nonNumList_.forEach((i): void => { const j = ref.get(i); j && ref.set(GlobalConsts.ForcedMapNum + i, j) })
    }
    ref.set("-", KeyAction.count)
    for (let num = 0; num <= 9; num++) { ref.set("" + num, KeyAction.count) }
    nonNumList_ = null
    if (!hasFoundChanges) { /* empty */ }
    else if (errors_) {
      if (errors_.length > 1) {
        console.group(errors_.length + " Errors in custom Key mappings:")
        errors_.map(line => console.log(...line))
        console.groupEnd()
      } else {
        console.log.apply(console, errors_[0])
      }
    } else if (isOldWrong) {
      console.log("The new key mappings have no errors");
    }
    const maybePassed = Exclusions.getAllPassed_()
    const func = (obj: ChildKeyFSM): void => {
      for (const key in obj) {
        const val = obj[key]!;
        if (val !== KeyAction.cmd) {
          key.startsWith("v-") || func(val)
        }
        else if (maybePassed !== true && ref.get(key) === KeyAction.cmd && !(maybePassed && maybePassed.has(key))
              && (key.length < 2 || !ref.has(key + ":" + GlobalConsts.InsertModeId))
            || key.startsWith("v-") && typeof ref.get(key) !== "object") {
          delete obj[key];
        }
      }
    };
    ref.forEach((val, key): void => {
      if (key.startsWith("v-")) {
        if (val === KeyAction.cmd) { ref.delete(key) }
      } else if (typeof val === "object") {
        func(val)
      }
    })
    const refSorted: EnsuredDict<ValidKeyAction | ChildKeyFSM> = {}, keys2 = BgUtils_.keys_(ref).sort()
    for (const key of keys2) {
      const val = ref.get(key)!, keys = typeof val === "object" ? Object.keys(val) : null
      refSorted[key] = keys && keys.length > 1 ? JSON.parse<typeof val>(JSON.stringify(val, keys.sort())) : val
    }
    set_keyFSM_(refSorted)
    if (value) {
      /*#__NOINLINE__*/ upgradeKeyMappings(value)
    }
}

const logInactive_ = (prefix: string | string[], suffix: string | ReadonlyChildKeyFSM): void => {
  const arr: string[] = [], toStr = (prefix: string, dict: ReadonlyChildKeyFSM): void => {
    for (let [k, v] of Object.entries!(dict)) {
      k = prefix + wrapKey_(k)
      v === KeyAction.cmd ? arr.push(k) : toStr(k, v as ReadonlyChildKeyFSM)
    }
  }
  prefix = typeof prefix !== "string" ? prefix.map(wrapKey_).join("") : prefix
  suffix = typeof suffix !== "string" ? (toStr("", suffix), arr.join(", ")) : suffix.slice(prefix.length)
  logError_('Inactive suffixes: %o under "%s"', suffix, prefix)
}

const logError_ = function (): void {
  (errors_ || (errors_ = [])).push([].slice.call(arguments, 0))
} as (firstMsg: string, ...args: any[]) => void

const AsC_ = (i: kCName): kCName => i
const defaultKeyMappings_: string =
  "? "     +AsC_("showHelp")            +" <a-c> "  +AsC_("previousTab")     +" <a-s-c> "+AsC_("nextTab")             +
  " d "    +AsC_("scrollPageDown")      +" <c-e> "  +AsC_("scrollDown")      +" f "      +AsC_("LinkHints.activate")  +
  " <f1> " +AsC_("simBackspace")        +" <s-f1> " +AsC_("switchFocus")     +" <f2> "   +AsC_("switchFocus")         +
  " <f8> " +AsC_("enterVisualMode")     +" G "      +AsC_("scrollToBottom")  +" gf "     +AsC_("nextFrame")           +
  " gg "   +AsC_("scrollToTop")         +" gi "     +AsC_("focusInput")      +" gn "     +AsC_("toggleVomnibarStyle") +
  " gs "   +AsC_("toggleViewSource")    +" gt "     +AsC_("nextTab")         +" gu "     +AsC_("goUp")                +
  " gF "   +AsC_("mainFrame")           +" gT "     +AsC_("previousTab")     +" gU "     +AsC_("goToRoot")            +
  " g0 "   +AsC_("firstTab")            +" g$ "     +AsC_("lastTab")         +" h "      +AsC_("scrollLeft")          +
  " H "    +AsC_("goBack")              +" i "      +AsC_("enterInsertMode") +" j "      +AsC_("scrollDown")          +
  " J "    +AsC_("previousTab")         +" K "      +AsC_("nextTab")         +" k "      +AsC_("scrollUp")            +
  " l "    +AsC_("scrollRight")         +" L "      +AsC_("goForward")       +" <a-m> "  +AsC_("toggleMuteTab")       +
  " N "    +AsC_("performBackwardsFind")+" n "      +AsC_("performFind")     +" <a-n> "  +AsC_("performAnotherFind")  +
  " o "    +AsC_("Vomnibar.activate")   +" <a-p> "  +AsC_("togglePinTab")    +" r "      +AsC_("reload")              +
  " R "    +AsC_("reloadGivenTab")      +" <a-r> "  +AsC_("reloadTab")       +" <a-s-r> "+AsC_("reopenTab")           +
  " t "    +AsC_("createTab")           +" <a-t> "  +AsC_("createTab")       +" u "      +AsC_("scrollPageUp")        +
  " V "    +AsC_("enterVisualLineMode") +" v "      +AsC_("enterVisualMode") +" <a-v> "  +AsC_("nextTab")             +
  " W "    +AsC_("moveTabToNextWindow") +" x "      +AsC_("removeTab")       +" X "      +AsC_("restoreTab")          +
  " yt "   +AsC_("duplicateTab")        +" yy "     +AsC_("copyCurrentUrl")  +" <c-y> "  +AsC_("scrollUp")            +
  " zH "   +AsC_("scrollToLeft")        +" zL "     +AsC_("scrollToRight")   +" / "      +AsC_("enterFindMode")       +
  " ` "    +AsC_("Marks.activate")      +" ^ "      +AsC_("visitPreviousTab")+" [[ "     +AsC_("goPrevious")          +
  " ]] "   +AsC_("goNext")              +" << "     +AsC_("moveTabLeft")     +" >> "     +AsC_("moveTabRight")        +
  " b "    +AsC_("Vomnibar.activateBookmarks")             + " ge "    + AsC_("Vomnibar.activateUrl")                 +
  " gE "   +AsC_("Vomnibar.activateUrlInNewTab")           + " m "     + AsC_("Marks.activateCreate")                 +
  " p "    +AsC_("openCopiedUrlInCurrentTab")              + " yf "    + AsC_("LinkHints.activateCopyLinkUrl")        +
  " B "    +AsC_("Vomnibar.activateBookmarksInNewTab")     + " F "     + AsC_("LinkHints.activateOpenInNewTab")       +
  " O "    +AsC_("Vomnibar.activateInNewTab")              + " P "     + AsC_("openCopiedUrlInNewTab")                +
  " T "    +AsC_("Vomnibar.activateTabs")                  + " <a-f> " + AsC_("LinkHints.activateWithQueue")          +
  " yv "   +AsC_("LinkHints.activateSelect")               + " yi "    + AsC_("LinkHints.activateCopyImage")          +
  (Build.NDEBUG ? "" : ` <a-s-f12> ${AsC_("debugBackground")} <s-f12> ${CNameLiterals.focusOptions}`)

export const availableCommands_: { readonly [key in kCName]: CommandsNS.Description } & SafeObject = {
  __proto__: null as never,
  "LinkHints.activate": [ kFgCmd.linkHints, kCxt.fg, 0, { m: HintMode.DEFAULT } ],
  "LinkHints.activateCopyImage": [ kFgCmd.linkHints, kCxt.fg, 0, { m: HintMode.COPY_IMAGE } ],
  "LinkHints.activateCopyLinkText": [ kFgCmd.linkHints, kCxt.fg, 0, { m: HintMode.COPY_TEXT } ],
  "LinkHints.activateCopyLinkUrl": [ kFgCmd.linkHints, kCxt.fg, 0, { m: HintMode.COPY_URL } ],
  "LinkHints.activateDownloadImage": [ kFgCmd.linkHints, kCxt.fg, 0, { m: HintMode.DOWNLOAD_MEDIA } ],
  "LinkHints.activateDownloadLink": [ kFgCmd.linkHints, kCxt.fg, 0, { m: HintMode.DOWNLOAD_LINK } ],
  "LinkHints.activateEdit": [ kFgCmd.linkHints, kCxt.fg, 1, { m: HintMode.FOCUS_EDITABLE } ],
  "LinkHints.activateFocus": [ kFgCmd.linkHints, kCxt.fg, 0, { m: HintMode.FOCUS } ],
  "LinkHints.activateHover": [ kFgCmd.linkHints, kCxt.fg, 0,
      OnFirefox ? { m: HintMode.HOVER } : { m: HintMode.HOVER, showUrl: 1 } ],
  "LinkHints.activateLeave": [ kFgCmd.linkHints, kCxt.fg, 0, { m: HintMode.UNHOVER } ],
  "LinkHints.activateMode": [ kFgCmd.linkHints, kCxt.fg, 0, { m: HintMode.DEFAULT } ],
  "LinkHints.activateModeToCopyImage": [ kFgCmd.linkHints, kCxt.fg, 0, { m: HintMode.COPY_IMAGE } ],
  "LinkHints.activateModeToCopyLinkText": [ kFgCmd.linkHints, kCxt.fg, 0, { m: HintMode.COPY_TEXT } ],
  "LinkHints.activateModeToCopyLinkUrl": [ kFgCmd.linkHints, kCxt.fg, 0, { m: HintMode.COPY_URL } ],
  "LinkHints.activateModeToDownloadImage": [ kFgCmd.linkHints, kCxt.fg, 0, { m: HintMode.DOWNLOAD_MEDIA } ],
  "LinkHints.activateModeToDownloadLink": [ kFgCmd.linkHints, kCxt.fg, 0, { m: HintMode.DOWNLOAD_LINK } ],
  "LinkHints.activateModeToEdit": [ kFgCmd.linkHints, kCxt.fg, 1, { m: HintMode.FOCUS_EDITABLE } ],
  "LinkHints.activateModeToFocus": [ kFgCmd.linkHints, kCxt.fg, 1, { m: HintMode.FOCUS } ],
  "LinkHints.activateModeToHover": [ kFgCmd.linkHints, kCxt.fg, 0,
      OnFirefox ? { m: HintMode.HOVER } : { m: HintMode.HOVER, showUrl: 1 } ],
  "LinkHints.activateModeToLeave": [ kFgCmd.linkHints, kCxt.fg, 0, { m: HintMode.UNHOVER } ],
  "LinkHints.activateModeToOpenImage": [ kFgCmd.linkHints, kCxt.fg, 0, { m: HintMode.OPEN_IMAGE } ],
  "LinkHints.activateModeToOpenIncognito": [ kFgCmd.linkHints, kCxt.fg, 0, { m: HintMode.OPEN_INCOGNITO_LINK } ],
  "LinkHints.activateModeToOpenInNewForegroundTab": [ kFgCmd.linkHints, kCxt.fg, 0, {m: HintMode.OPEN_IN_NEW_FG_TAB} ],
  "LinkHints.activateModeToOpenInNewTab": [ kFgCmd.linkHints, kCxt.fg, 0, { m: HintMode.OPEN_IN_NEW_BG_TAB } ],
  "LinkHints.activateModeToOpenVomnibar": [ kFgCmd.linkHints, kCxt.fg, 1, { m: HintMode.EDIT_TEXT } ],
  "LinkHints.activateModeToSearchLinkText": [ kFgCmd.linkHints, kCxt.fg, 0, { m: HintMode.SEARCH_TEXT } ],
  "LinkHints.activateModeToSelect": [ kFgCmd.linkHints, kCxt.fg, 0, { m: HintMode.ENTER_VISUAL_MODE } ],
  "LinkHints.activateModeToUnhover": [ kFgCmd.linkHints, kCxt.fg, 0, { m: HintMode.UNHOVER } ],
  "LinkHints.activateModeWithQueue": [ kFgCmd.linkHints, kCxt.fg, 0, { m: HintMode.OPEN_WITH_QUEUE } ],
  "LinkHints.activateOpenImage": [ kFgCmd.linkHints, kCxt.fg, 0, { m: HintMode.OPEN_IMAGE } ],
  "LinkHints.activateOpenIncognito": [ kFgCmd.linkHints, kCxt.fg, 0, { m: HintMode.OPEN_INCOGNITO_LINK } ],
  "LinkHints.activateOpenInNewForegroundTab": [ kFgCmd.linkHints, kCxt.fg, 0, {m: HintMode.OPEN_IN_NEW_FG_TAB} ],
  "LinkHints.activateOpenInNewTab": [ kFgCmd.linkHints, kCxt.fg, 0, { m: HintMode.OPEN_IN_NEW_BG_TAB } ],
  "LinkHints.activateOpenVomnibar": [ kFgCmd.linkHints, kCxt.fg, 1, { m: HintMode.EDIT_TEXT } ],
  "LinkHints.activateSearchLinkText": [ kFgCmd.linkHints, kCxt.fg, 0, { m: HintMode.SEARCH_TEXT } ],
  "LinkHints.activateSelect": [ kFgCmd.linkHints, kCxt.fg, 0, { m: HintMode.ENTER_VISUAL_MODE } ],
  "LinkHints.activateUnhover": [ kFgCmd.linkHints, kCxt.fg, 0, { m: HintMode.UNHOVER } ],
  "LinkHints.activateWithQueue": [ kFgCmd.linkHints, kCxt.fg, 0, { m: HintMode.OPEN_WITH_QUEUE } ],
  "LinkHints.click": [ kFgCmd.linkHints, kCxt.fg, 0, { direct: true, m: HintMode.DEFAULT } ],
  "LinkHints.unhoverLast": [ kFgCmd.insertMode, kCxt.fg, 1, { u: true } ],
  "Marks.activate": [ kBgCmd.marksActivate, kCxt.bg, 0 ],
  "Marks.activateCreate": [ kBgCmd.marksActivate, kCxt.bg, 0, { mode: "create" } ],
  "Marks.activateCreateMode": [ kBgCmd.marksActivate, kCxt.bg, 0, { mode: "create" } ],
  "Marks.activateGoto": [ kBgCmd.marksActivate, kCxt.bg, 0 ],
  "Marks.activateGotoMode": [ kBgCmd.marksActivate, kCxt.bg, 0 ],
  "Marks.clearGlobal": [ kBgCmd.clearMarks, kCxt.bg, 1 ],
  "Marks.clearLocal": [ kBgCmd.clearMarks, kCxt.bg, 1, { local: true } ],
  "Vomnibar.activate": [ kBgCmd.showVomnibar, kCxt.bg, 0 ],
  "Vomnibar.activateBookmarks": [ kBgCmd.showVomnibar, kCxt.bg, 1, { mode: "bookm" } ],
  "Vomnibar.activateBookmarksInNewTab": [ kBgCmd.showVomnibar, kCxt.bg, 1, { mode: "bookm", newtab: 1 } ],
  "Vomnibar.activateEditUrl": [ kBgCmd.showVomnibar, kCxt.bg, 0, { url: true } ],
  "Vomnibar.activateEditUrlInNewTab": [ kBgCmd.showVomnibar, kCxt.bg, 0, { url: true, newtab: 1 } ],
  "Vomnibar.activateHistory": [ kBgCmd.showVomnibar, kCxt.bg, 1, { mode: "history" } ],
  "Vomnibar.activateHistoryInNewTab": [ kBgCmd.showVomnibar, kCxt.bg, 1, { mode: "history", newtab: 1 } ],
  "Vomnibar.activateInNewTab": [ kBgCmd.showVomnibar, kCxt.bg, 0, { newtab: 1 } ],
  "Vomnibar.activateTabs": [ kBgCmd.showVomnibar, kCxt.bg, 1, { mode: "tab", newtab: 1 } ],
  "Vomnibar.activateTabSelection": [ kBgCmd.showVomnibar, kCxt.bg, 1, { mode: "tab", newtab: 1 } ],
  "Vomnibar.activateUrl": [ kBgCmd.showVomnibar, kCxt.bg, 0, { url: true } ],
  "Vomnibar.activateUrlInNewTab": [ kBgCmd.showVomnibar, kCxt.bg, 0, { url: true, newtab: 1 } ],
  addBookmark: [ kBgCmd.addBookmark, kCxt.bg, /* 20 in all_commands.ts */ 0 ],
  autoCopy: [ kFgCmd.autoOpen, kCxt.fg, 1, { copy: true } ],
  autoOpen: [ kFgCmd.autoOpen, kCxt.fg, 1, { o: 1 } ],
  blank: [ kBgCmd.blank, kCxt.bg, 0 ],
  clearCS: [ kBgCmd.clearCS, kCxt.bg, 1 ],
  clearContentSetting: [ kBgCmd.clearCS, kCxt.bg, 1 ],
  clearContentSettings: [ kBgCmd.clearCS, kCxt.bg, 1 ],
  clearFindHistory: [ kBgCmd.clearFindHistory, kCxt.bg, 1 ],
  closeDownloadBar: [ kBgCmd.closeDownloadBar, kCxt.bg, 1, { all: 1 } ],
  closeOtherTabs: [ kBgCmd.removeTabsR, kCxt.bg, 1, { other: true, mayConfirm: true } ],
  closeSomeOtherTabs: [ kBgCmd.removeTabsR, kCxt.bg, 0 ],
  closeTabsOnLeft: [ kBgCmd.removeTabsR, kCxt.bg, 0, { $count: -1e6, mayConfirm: true } ],
  closeTabsOnRight: [ kBgCmd.removeTabsR, kCxt.bg, 0, { $count: 1e6, mayConfirm: true } ],
  captureTab: [ kBgCmd.captureTab, kCxt.bg, 1 ],
  copyCurrentTitle: [ kBgCmd.copyWindowInfo, kCxt.bg, 1, { type: "title" } ],
  copyCurrentUrl: [ kBgCmd.copyWindowInfo, kCxt.bg, 1 ],
  copyWindowInfo: [ kBgCmd.copyWindowInfo, kCxt.bg, 0, { type: "window" } ],
  createTab: [ kBgCmd.createTab, kCxt.bg, 20 as 0 ],
  debugBackground: [ kBgCmd.openUrl, kCxt.bg, 1,
    {
      reuse: ReuseType.reuse,
      url: OnChrome ? "chrome://extensions/?id=$id"
          : OnFirefox ? Build.MinFFVer < FirefoxBrowserVer.MinAboutDebuggingRuntimeThisFirefox
            && CurFFVer_ < FirefoxBrowserVer.MinAboutDebuggingRuntimeThisFirefox ? "about:debugging#addons"
            : "about:debugging#/runtime/this-firefox" : CONST_.OptionsPage_,
      id_mask: "$id", url_mask: ""
    }],
  discardTab: [ kBgCmd.discardTab, kCxt.bg, /* 20 in all_commands.ts */ 0 ],
  dispatchEvent: [kBgCmd.dispatchEventCmd, kCxt.bg, /** only 1 / -1, in fact */ 0],
  duplicateTab: [ kBgCmd.duplicateTab, kCxt.bg, 20 as 0 ],
  editText: [ kFgCmd.editText, kCxt.fg, 0 ],
  enableCSTemp: [ kBgCmd.toggleCS, kCxt.bg, 0, { incognito: true } ],
  enableContentSettingTemp: [ kBgCmd.toggleCS, kCxt.bg, 0, { incognito: true } ],
  enterFindMode: [ kBgCmd.performFind, kCxt.bg, 1, {active: true, selected: true} ],
  enterInsertMode: [ kBgCmd.insertMode, kCxt.bg, 1, { insert: true } ],
  enterVisualLineMode: [ kBgCmd.visualMode, kCxt.bg, 1, { mode: "line" } ],
  enterVisualMode: [ kBgCmd.visualMode, kCxt.bg, 1 ],
  firstTab: [ kBgCmd.goToTab, kCxt.bg, 0, { absolute: true } ],
  focusInput: [ kFgCmd.focusInput, kCxt.fg, 0 ],
  focusOrLaunch: [ kBgCmd.openUrl, kCxt.bg, 1, { reuse: ReuseType.reuse } ],
  goBack: [ kFgCmd.framesGoBack, kCxt.fg, 0, { $count: -1 } ],
  goForward: [ kFgCmd.framesGoBack, kCxt.fg, 0 ],
  goNext: [ kBgCmd.goNext, kCxt.bg, 0, { sed: true } ],
  goPrevious: [ kBgCmd.goNext, kCxt.bg, 0, { sed: true, rel: "prev" } ],
  goToRoot: [ kBgCmd.goUp, kCxt.bg, 0, { } ],
  goUp: [ kBgCmd.goUp, kCxt.bg, 0, { $count: -1, type: "frame" } ],
  joinTabs: [ kBgCmd.joinTabs, kCxt.bg, 0 ],
  lastTab: [ kBgCmd.goToTab, kCxt.bg, 0, { $count: -1, absolute: true } ],
  mainFrame: [ kBgCmd.mainFrame, kCxt.bg, 1 ],
  moveTabLeft: [ kBgCmd.moveTab, kCxt.bg, 0, { $count: -1 } ],
  moveTabRight: [ kBgCmd.moveTab, kCxt.bg, 0 ],
  moveTabToIncognito: [ kBgCmd.moveTabToNewWindow, kCxt.bg, 1, { incognito: true } ],
  moveTabToNewWindow: [ kBgCmd.moveTabToNewWindow, kCxt.bg, /** 30 in tab_commands.ts */ 0 ],
  moveTabToNextWindow: [ kBgCmd.moveTabToNextWindow, kCxt.bg, 0 ],
  newTab: [ kBgCmd.createTab, kCxt.bg, 20 as 0 ],
  nextFrame: [ kBgCmd.nextFrame, kCxt.bg, 0 ],
  nextTab: [ kBgCmd.goToTab, kCxt.bg, 0 ],
  openBookmark: [ kBgCmd.openBookmark, kCxt.bg, 0 ],
  openCopiedUrlInCurrentTab: [ kBgCmd.openUrl, kCxt.bg, 1, { reuse: ReuseType.current, copied: true } ],
  openCopiedUrlInNewTab: [ kBgCmd.openUrl, kCxt.bg, 20 as 0, {copied: true} ],
  openUrl: [ kBgCmd.openUrl, kCxt.bg, 20 as 0 ],
  parentFrame: [ kBgCmd.parentFrame, kCxt.bg, 0 ],
  passNextKey: [ kFgCmd.passNextKey, kCxt.fg, 0 ],
  performAnotherFind: [ kBgCmd.performFind, kCxt.bg, 0, { index: "other" } ],
  performBackwardsFind: [ kBgCmd.performFind, kCxt.bg, 0, { $count: -1 } ],
  performFind: [ kBgCmd.performFind, kCxt.bg, 0 ],
  previousTab: [ kBgCmd.goToTab, kCxt.bg, 0, { $count: -1 } ],
  quickNext: [ kBgCmd.goToTab, kCxt.bg, 0 ],
  reload: [ kFgCmd.framesGoBack, kCxt.fg, 1, { r: 1 } ],
  reloadGivenTab: [ kBgCmd.reloadTab, kCxt.bg, 0, { single: true } ],
  reloadTab: [ kBgCmd.reloadTab, kCxt.bg, /** 20 in tab_commands.ts */ 0 ],
  removeRightTab: [ kBgCmd.removeRightTab, kCxt.bg, 0 ],
  removeTab: [ kBgCmd.removeTab, kCxt.bg, /** 20 in tab_commands.ts */ 0 ],
  reopenTab: [ kBgCmd.reopenTab, kCxt.bg, 1 ],
  reset: [kBgCmd.reset, kCxt.bg, 1],
  restoreGivenTab: [ kBgCmd.restoreTab, kCxt.bg, 0, { one: true } ],
  restoreTab: [ kBgCmd.restoreTab, kCxt.bg, 25 as 0 ],
  runKey: [ kBgCmd.runKey, kCxt.bg, 0 ],
  scrollDown: [ kFgCmd.scroll, kCxt.fg, 0 ],
  scrollFullPageDown: [ kFgCmd.scroll, kCxt.fg, 0, { view: 2 } ],
  scrollFullPageUp: [ kFgCmd.scroll, kCxt.fg, 0, { dir: -1, view: 2 } ],
  scrollLeft: [ kFgCmd.scroll, kCxt.fg, 0, { dir: -1, axis: "x" } ],
  scrollPageDown: [ kFgCmd.scroll, kCxt.fg, 0, { dir: 0.5, view: 2 } ],
  scrollPageUp: [ kFgCmd.scroll, kCxt.fg, 0, { dir: -0.5, view: 2 } ],
  scrollPxDown: [ kFgCmd.scroll, kCxt.fg, 0, { view: 1 } ],
  scrollPxLeft: [ kFgCmd.scroll, kCxt.fg, 0, { dir: -1, axis: "x", view: 1 } ],
  scrollPxRight: [ kFgCmd.scroll, kCxt.fg, 0, { axis: "x", view: 1 } ],
  scrollPxUp: [ kFgCmd.scroll, kCxt.fg, 0, { dir: -1, view: 1 } ],
  scrollRight: [ kFgCmd.scroll, kCxt.fg, 0, { axis: "x" } ],
  scrollSelect: [ kFgCmd.scrollSelect, kCxt.fg, 0 ],
  scrollTo: [ kFgCmd.scroll, kCxt.fg, 0, { dest: "min" } ],
  scrollToBottom: [ kFgCmd.scroll, kCxt.fg, 0, { dest: "max" } ],
  scrollToLeft: [ kFgCmd.scroll, kCxt.fg, 0, { axis: "x", dest: "min" } ],
  scrollToRight: [ kFgCmd.scroll, kCxt.fg, 0, { axis: "x", dest: "max" } ],
  scrollToTop: [ kFgCmd.scroll, kCxt.fg, 0, { dest: "min" } ],
  scrollUp: [ kFgCmd.scroll, kCxt.fg, 0, { dir: -1 } ],
  searchAs: [ kFgCmd.autoOpen, kCxt.fg, 1, { s: 1, copied: true, selected: true } ],
  searchInAnother: [ kBgCmd.searchInAnother, kCxt.bg, 1 ],
  sendToExtension: [ kBgCmd.sendToExtension, kCxt.bg, 0 ],
  showHelp: [ kBgCmd.showHelp, kCxt.bg, 1 ],
  showHUD: [ kBgCmd.showHUD, kCxt.bg, 1 ],
  showTip: [ kBgCmd.showHUD, kCxt.bg, 1 ],
  simBackspace: [ kFgCmd.focusInput, kCxt.fg, 1, { action: "backspace" } ],
  simulateBackspace: [ kFgCmd.focusInput, kCxt.fg, 1, { action: "backspace" } ],
  sortTabs: [ kBgCmd.joinTabs, kCxt.bg, 0, { sort: "recency", windows: "current" } ],
  switchFocus: [ kFgCmd.focusInput, kCxt.fg, 1, { action: "switch" } ],
  toggleCS: [ kBgCmd.toggleCS, kCxt.bg, 0 ],
  toggleContentSetting: [ kBgCmd.toggleCS, kCxt.bg, 0 ],
  toggleLinkHintCharacters: [ kBgCmd.toggle, kCxt.bg, 1, { key: "linkHintCharacters" } ],
  toggleMuteTab: [ kBgCmd.toggleMuteTab, kCxt.bg, 1 ],
  togglePinTab: [ kBgCmd.togglePinTab, kCxt.bg, /** 30 in all_commands.ts */ 0 ],
  toggleStyle: [ kFgCmd.toggleStyle, kCxt.fg, 1 ],
  toggleSwitchTemp: [ kBgCmd.toggle, kCxt.bg, 1 ],
  toggleViewSource: [ kBgCmd.toggleTabUrl, kCxt.bg, 1, { opener: true } ],
  toggleReaderMode: [ kBgCmd.toggleTabUrl, kCxt.bg, 1, { reader: true, reuse: ReuseType.current, opener: true } ],
  toggleVomnibarStyle: [ kBgCmd.toggleVomnibarStyle, kCxt.bg, 1, { style: "dark" } ],
  visitPreviousTab: [ kBgCmd.visitPreviousTab, kCxt.bg, 0 ],
  wait: [ kBgCmd.blank, kCxt.bg, 0, { wait: "count" } ],
  zoom: [ kBgCmd.toggleZoom, kCxt.bg, 0 ],
  zoomIn: [ kBgCmd.toggleZoom, kCxt.bg, 0 ],
  zoomOut: [ kBgCmd.toggleZoom, kCxt.bg, 0, { $count: -1 } ],
  zoomReset: [ kBgCmd.toggleZoom, kCxt.bg, 0, { reset: true } ]
} satisfies NameMetaMap & SafeObject

const hintModes_: SafeDict<HintMode> = {
    __proto__: null as never,
  newtab: HintMode.OPEN_IN_NEW_BG_TAB, queue: HintMode.OPEN_WITH_QUEUE, "cur-queue": HintMode.queue,
  "new-active": HintMode.OPEN_IN_NEW_FG_TAB, "newtab-active": HintMode.OPEN_IN_NEW_FG_TAB,
  hover: HintMode.HOVER, unhover: HintMode.UNHOVER, leave: HintMode.UNHOVER,
  focus: HintMode.FOCUS,
  "download-media": HintMode.DOWNLOAD_MEDIA, "download-image": HintMode.DOWNLOAD_MEDIA,
  image: HintMode.OPEN_IMAGE, "open-image": HintMode.OPEN_IMAGE, media: HintMode.OPEN_IMAGE,
  search: HintMode.SEARCH_TEXT, "search-text": HintMode.SEARCH_TEXT,
  copy: HintMode.COPY_TEXT, "copy-text": HintMode.COPY_TEXT,
  "copy-list": HintMode.COPY_TEXT | HintMode.list | HintMode.queue,
  "copy-url": HintMode.COPY_URL, "copy-url-list": HintMode.COPY_URL | HintMode.list | HintMode.queue,
  download: HintMode.DOWNLOAD_LINK, incognito: HintMode.OPEN_INCOGNITO_LINK,
  "copy-image": HintMode.COPY_IMAGE,
  "edit-url": HintMode.EDIT_LINK_URL, edit: HintMode.EDIT_TEXT, "edit-text": HintMode.EDIT_TEXT,
  input: HintMode.FOCUS_EDITABLE, "focus-input": HintMode.FOCUS_EDITABLE, editable: HintMode.FOCUS_EDITABLE,
  "focus-editable": HintMode.FOCUS_EDITABLE,
  visual: HintMode.ENTER_VISUAL_MODE, select: HintMode.ENTER_VISUAL_MODE
}

export const visualGranularities_: GranularityNames = [
    "character", "word", "", "lineboundary", "line",
    OnFirefox ? "line" as never : "sentence", OnFirefox ? "lineboundary" as never : "paragraphboundary",
    OnFirefox ? "line" as never : "paragraph", OnFirefox ? "lineboundary" as never : "documentboundary"]

export const visualKeys_: VisualModeNS.KeyMap = {
    l: VisualAction.char | VisualAction.inc, h: VisualAction.char | VisualAction.dec,
    j: VisualAction.line | VisualAction.inc, k: VisualAction.line | VisualAction.dec,
    $: VisualAction.lineBoundary | VisualAction.inc, 0: VisualAction.lineBoundary | VisualAction.dec,
    "}": VisualAction.paragraph | VisualAction.inc, "{": VisualAction.paragraph | VisualAction.dec,
    ")": VisualAction.sentence | VisualAction.inc, "(": VisualAction.sentence | VisualAction.dec,
    w: VisualAction.vimWord | VisualAction.inc, /* same as w */ W: VisualAction.vimWord | VisualAction.inc,
    e: VisualAction.word | VisualAction.inc, b: VisualAction.word | VisualAction.dec,
    /* same as b */ B: VisualAction.word | VisualAction.dec,
    G: VisualAction.documentBoundary | VisualAction.inc, gg: VisualAction.documentBoundary | VisualAction.dec,

    o: VisualAction.Reverse, a: VisualAction.NextKey, g: VisualAction.NextKey,
    aw: VisualAction.LexicalWord, as: VisualAction.LexicalSentence,
        ap: VisualAction.LexicalParagraph, "a}": VisualAction.LexicalParagraph,

    y: VisualAction.Yank, Y: VisualAction.YankLine, C: VisualAction.YankWithoutExit, "c-s-c": VisualAction.YankRichText,
    p: VisualAction.YankAndOpen, P: VisualAction.YankAndNewTab,

    n: VisualAction.FindNext, N: VisualAction.FindPrevious,
    f1: VisualAction.HighlightRange, "a-f1": VisualAction.HighlightRange,

    v: VisualAction.VisualMode, V: VisualAction.VisualLineMode, c: VisualAction.CaretMode,
    "/": VisualAction.EmbeddedFindMode,

    "c-e": VisualAction.ScrollDown, "c-y": VisualAction.ScrollUp,
    "c-down": VisualAction.ScrollDown, "c-up": VisualAction.ScrollUp
}

if (!Build.NDEBUG) {
  (availableCommands_ as unknown as Writable<NameMetaMapEx>).focusOptions = [
    kBgCmd.openUrl, kCxt.bg, 1, { reuse: ReuseType.reuse, url: "vimium://options" }
  ];
}

const upgradeKeyMappings = (value: string): void => {
  let newFlags = "", prefix = `${kMappingsFlag.char0}${kMappingsFlag.char1}`
  if (!errors_ && flagDoesCheck_) { newFlags = `${prefix}${kMappingsFlag.noCheck}\n` }
  if (newFlags) {
    const old = updateHooks_.keyMappings
    updateHooks_.keyMappings = undefined
    try {
      settings_.set_("keyMappings", newFlags + value)
    } catch {}
    updateHooks_.keyMappings = old
  }
}

if (bgIniting_ & BackendHandlersNS.kInitStat.settings) {
  populateKeyMap_(settingsCache_.keyMappings)
  if (!OnEdge && Build.OS & (1 << kOS.mac) && os_ === kOS.mac) {
    visualKeys_["m-s-c"] = VisualAction.YankRichText
  }
}

updateHooks_.keyMappings = (value: string | null): void => {
  const oldMappedKeys = mappedKeyRegistry_, oldFSM = keyFSM_
  populateKeyMap_(value)
  const f = JSON.stringify, curMapped = mappedKeyRegistry_,
  updatesInKeyFSM = !!oldFSM && f(keyFSM_) !== f(oldFSM),
  updatesInMappedKeys = oldMappedKeys ? !curMapped || f(oldMappedKeys) !== f(curMapped) : !!oldFSM && !!curMapped;
  (updatesInMappedKeys || updatesInKeyFSM) && settings_.broadcast_({
    N: kBgReq.keyFSM, m: mappedKeyRegistry_, t: mappedKeyTypes_, k: updatesInKeyFSM ? keyFSM_ : null
  });
  updatesInMappedKeys && settings_.broadcastOmni_({ N: kBgReq.omni_updateOptions, d: { m: mappedKeyRegistry_ } })
};
