import { kPgReq } from "../background/page_messages"
import { $, OnEdge, browser_, OnFirefox, OnChrome, nextTick_, CurCVer_, IsEdg_, post_, pageLangs_ } from "./async_bg"
import { Option_, KnownOptionsDataset, oTrans_, bgSettings_, delayBinding } from "./options_base"
import { registerClass, createNewOption, TextOption_, BooleanOption_ } from "./options_defs"
import kBrowserPermission = chrome.permissions.kPermission

type AllowedApi = "contains" | "request" | "remove"

//#region Api wrapper
type PromisifyApi1<F> = F extends ((...args: [...infer A, (res: infer R, ex?: FakeArg) => void]) => void | 1)
    ? (...args: A) => Promise<ExtApiResult<R>> : never
type PromisifyApi<F extends Function> =
    F extends { (...args: infer A1): infer R1; (...args: infer A2): infer R2 }
    ? PromisifyApi1<(...args: A1) => R1> | PromisifyApi1<(...args: A2) => R2>
    : PromisifyApi1<F>
// When loading Vimium C on Chrome 60 startup using scripts/chrome2.sh, an options page may have no chrome.permissions
const _rawPermissionAPI = OnEdge ? null as never : browser_.permissions
const wrapApi = ((funcName: AllowedApi): Function => {
  if (!_rawPermissionAPI) {
    return function () {
      return post_(kPgReq.callApi, { module: "permissions", name: funcName, args: [].slice.call(arguments) })
    }
  }
  const func = _rawPermissionAPI[funcName as "contains"] as (args: unknown[]) => void | Promise<unknown>
  return function () {
    const arr: unknown[] = [].slice.call(arguments)
    if (!OnChrome) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      return (func.apply(_rawPermissionAPI, arr as any) as Promise<unknown>).then(i => [i, void 0]
          , err => [void 0, err as { message?: unknown}])
    }
    return new Promise<ExtApiResult<unknown>>((resolve): void => {
      arr.push((res: unknown): void => {
        const err = browser_.runtime.lastError as unknown
        resolve(err ? [void 0, err as { message?: unknown }] : [res, void 0])
        return err as void
      })
      void func.apply(_rawPermissionAPI, arr as any) // eslint-disable-line @typescript-eslint/no-unsafe-argument
    })
  }
}) as <T extends AllowedApi> (funcName: T) => PromisifyApi<typeof chrome.permissions[T]>
const browserPermissions_ = OnEdge ? null as never : {
  contains: wrapApi("contains"), request: wrapApi("request"), remove: wrapApi("remove")
}
const navPermissions_ = (Build.MV3 as BOOL) && OnChrome ? navigator.permissions! : null as never
//#endregion

type  BasePermissionItem<T extends string> = T extends kBrowserPermission | kNavPermissionName ? {
  readonly name_: T
  readonly type_: T extends kBrowserPermission ? 0 | 1 : 2
} : never
type PermissionItem = BasePermissionItem<kBrowserPermission | kNavPermissionName> & {
  previous_: 0 | 1 | 2
  element_: HTMLInputElement
}

const kShelf = "downloads.shelf", kNTP = "chrome://new-tab-page/*", kCrURL = "chrome://*/*"
const i18nItems = {
  "clipboard-read": "opt_clipboardRead",
  [kCrURL]: "opt_chromeUrl",
  [kNTP]: "opt_cNewtab",
  [kShelf]: "opt_closeShelf"
} as const
const placeholder = <true> !OnEdge && $<HTMLTemplateElement & EnsuredMountedHTMLElement>("#optionalPermissionsTemplate")
const template = <true> !OnEdge && placeholder.content.firstElementChild as HTMLElement
const container = <true> !OnEdge && placeholder.parentElement
const navPermissionTip = (Build.MV3 as BOOL) && OnChrome ? $<SafeHTMLElement>("#navPermissionTip") : null
const shownItems: PermissionItem[] = []
export const manifest = browser_.runtime.getManifest() as Readonly<chrome.runtime.Manifest>
let optional_permissions = (!OnEdge && manifest.optional_permissions || []) as readonly kBrowserPermission[]
const navNames: kNavPermissionName[] = (Build.MV3 as BOOL) && OnChrome ? [ "clipboard-read" ] : []

export class OptionalPermissionsOption_ extends Option_<"nextPatterns"> {
  override init_ (): void { delayBinding(this.element_, "change", this.onUpdated_) }
  override readValueFromElement_ (): string {
    return shownItems.map(i => i.element_.indeterminate ? "1" : i.element_.checked ? "2" : "0").join("")
  }
  override innerFetch_ (): string { return shownItems.map(i => i.previous_).join("") }
  override populateElement_ (value: string): void {
    for (let i = 0; i < shownItems.length; i++) {
      const shown = shownItems[i]
      shown.element_.checked = value[i] === "2"
      shown.element_.indeterminate = value[i] === "1"
      if (Build.MV3 && shown.type_ === 2 && value[i] !== "1") {
        (shown.element_.parentElement as HTMLElement).title = navPermissionTip!.innerText
        BooleanOption_.ToggleDisabled_(shown.element_, true)
      }
    }
  }
  override executeSave_ (wanted_value: string): Promise<string> {
    const new_browser_permissions: kBrowserPermission[] = [], new_origins: kBrowserPermission[] = []
    const new_nav_permissions: kNavPermissionName[] = []
    const changed: { [key in kBrowserPermission]?: PermissionItem } = {}
    let waiting = 1
    for (let _ind = 0; _ind < shownItems.length; _ind++) {
      const i = shownItems[_ind], previous = i.previous_
      const wanted = +wanted_value[_ind] as 0 | 1 | 2
      if (previous === wanted) { continue }
      const orig2: kBrowserPermission | "" = OnChrome && Build.OnBrowserNativePages && i.name_ === kNTP
          ? "chrome://newtab/*" : ""
      i.previous_ = wanted
      if (OnChrome && Build.OnBrowserNativePages && i.name_ === kCrURL) {
        if (<boolean> bgSettings_.get_("allBrowserUrls") !== (wanted === 2)) {
          waiting++
          void Promise.resolve(bgSettings_.get_("allBrowserUrls")).then((allBrowserUrls): void => {
            if (allBrowserUrls !== (wanted === 2)) {
              bgSettings_.set_("allBrowserUrls", wanted === 2).then(tryRefreshing)
            } else {
              tryRefreshing()
            }
          })
        }
      }
      if (i.type_ === 2) {
        if (!Build.MV3 || previous !== 1) { /* empty */ }
        else if (wanted === 2) {
          new_nav_permissions.push(i.name_)
        }
      } else if (wanted) {
        i.name_ === kShelf && new_browser_permissions.push("downloads");
        (i.type_ === 1 ? new_origins : new_browser_permissions).push(i.name_)
        orig2 && new_origins.push(orig2)
        changed[i.name_] = i
      } else {
        waiting++
        void browserPermissions_.remove(i.type_ === 1 ? { origins: orig2 ? [i.name_, orig2] : [i.name_] }
              : { permissions: i.name_ === kShelf ? ["downloads", i.name_] : [i.name_] }).then(([ok, err]): void => {
          const msg1 = "Can not remove the permission %o : ", msg2 = err && err.message || err;
          (err || !ok) && console.log(msg1, i.name_, msg2)
          const box = i.element_.parentElement as Element as EnsuredMountedHTMLElement
          TextOption_.showError_(err ? msg1.replace("%o", i.name_) + msg2 : "", void 0, box)
          tryRefreshing()
        })
      }
    }
    const cb = (arr: kBrowserPermission[], [ok, err]: ExtApiResult<boolean>): void => {
      (err || !ok) && console.log("Can not request permissions of %o :", arr, err && err.message || err)
      if (!ok) {
        for (const name of arr) {
          const item = changed[name]
          if (!item) { continue }
          item.previous_ = 0
          const box = item.element_.parentElement as Element as EnsuredMountedHTMLElement
          if (!err) { return TextOption_.showError_("", void 0, box)  }
          let msg = (err && err.message || JSON.stringify(err)) + ""
          if (name.startsWith("chrome://") && msg.includes("Only permissions specified in the manifest")) {
            if (name.startsWith("chrome:")) {
              msg = oTrans_("optNeedChromeUrlFirst")
              msg = IsEdg_ ? msg.replace("chrome:", "edge:") : msg
            }
          }
          msg = oTrans_("exc") + msg
          TextOption_.showError_(msg, void 0, box)
          nextTick_((): void => { box.title = msg })
        }
        void this.fetch_()
      }
      tryRefreshing()
    }
    const tryRefreshing = (): void => {
      waiting--
      if (waiting > 0) { return }
      void Promise.all(shownItems.map(doPermissionsContain_)).then((): void => {
        void this.fetch_()
      })
    }
    waiting += (new_browser_permissions.length && 1) + (new_origins.length && 1)
    new_browser_permissions.length &&
        browserPermissions_.request({ permissions: new_browser_permissions }).then(cb.bind(0, new_browser_permissions))
    new_origins.length && browserPermissions_.request({ origins: new_origins }).then(cb.bind(0, new_origins))
    if (new_nav_permissions.includes("clipboard-read")) {
        const clipboard = navigator.clipboard!
        waiting++
        clipboard.readText!().catch((): void => {}).then(tryRefreshing)
    }
    tryRefreshing()
    return Promise.resolve(wanted_value)
  }
}
OnEdge || registerClass("OptionalPermissions", OptionalPermissionsOption_)

const initOptionalPermissions = (): void => {
  const fragment = document.createDocumentFragment()
  if (OnFirefox && Build.OS & (1 << kOS.unixLike) && bgSettings_.os_ === kOS.unixLike) {
    template.querySelector("input")!.classList.add("baseline")
  }
  for (const shownItem of shownItems) {
    const name = shownItem.name_
    const node = document.importNode(template, true) as EnsuredMountedHTMLElement
    const checkbox = node.querySelector("input")!
    const i18nKey = i18nItems[name as keyof typeof i18nItems]
    let i18nName = oTrans_(i18nKey || `opt_${name}`) || name
    let suffix = ""
    if (OnChrome && name.startsWith("chrome:")) {
      i18nName = IsEdg_ ? i18nName.replace("chrome:", "edge:") : i18nName
      suffix = oTrans_("optOfChromeUrl").replace(IsEdg_ ? "chrome" : "edge", "edge")
    }
    checkbox.value = name
    if (OnChrome && Build.OnBrowserNativePages && name === kNTP) {
      if (OnChrome && Build.MinCVer < BrowserVer.MinChromeURL$NewTabPage
          && CurCVer_ < BrowserVer.MinChromeURL$NewTabPage) {
        suffix = oTrans_("requireChromium", [BrowserVer.MinChromeURL$NewTabPage])
        checkbox.disabled = true
        checkbox.checked = false
        node.title = oTrans_("invalidOption", [oTrans_("beforeChromium", [BrowserVer.MinChromeURL$NewTabPage])])
      }
    }
    node.lastElementChild.textContent = i18nName + suffix
    if (optional_permissions.length === 1 || optional_permissions.length === 2 && pageLangs_ === "en") {
      node.classList.add("single")
    }
    fragment.appendChild(node)
    shownItem.element_ = checkbox
  }
  container.appendChild(fragment)
  delayBinding(container, "input", onInput, true)
}

const doPermissionsContain_ = (item: PermissionItem): Promise<void> => {
  const {type_: type, name_: name} = item
  return (type === 2 ? !Build.MV3 ? Promise.resolve([1, void 0] as const) : navPermissions_.query({ name })
        .then(res => [res.state === "prompt" ? 1 : res.state === "granted" ? 2 : 0, void 0] as const,
                err => [void 0, err as unknown] as const)
      : browserPermissions_.contains(type === 1 ? { origins: [name] }
          : { permissions: name === kShelf ? ["downloads", name] : [name] })).then(([result]): void => {
    if (OnChrome && Build.MinCVer < BrowserVer.MinCorrectExtPermissionsOnChromeURL$NewTabPage
        && CurCVer_ < BrowserVer.MinCorrectExtPermissionsOnChromeURL$NewTabPage
        && Build.OnBrowserNativePages && name === kNTP) {
      result = false
    }
    const val = !result ? 0 : item.type_ === 2 ? result as 0 | 1 | 2
        : !OnChrome || !Build.OnBrowserNativePages || name !== kCrURL
          || <boolean> bgSettings_.get_("allBrowserUrls") ? 2 : 1
    item.previous_ = val
  })
}

const onInput = (e: Event): void => {
  const el = e.target as HTMLInputElement
  const item = shownItems.find(i => i.element_ === el)
  if (!item) { return }
  const value = el.checked
  if (OnChrome && Build.OnBrowserNativePages && (item.name_ === kCrURL || item.name_ === kNTP)) {
    const isCurNTP = item.name_ === kNTP, theOtherName = isCurNTP ? kCrURL : kNTP
    const theOther = shownItems.find(i => i.name_ === theOtherName)
    if (theOther) {
      if (isCurNTP && value && !theOther.element_.checked) {
        theOther.element_.checked = false
        theOther.element_.indeterminate = true
      } else if (!isCurNTP && value && el.indeterminate) {
        el.indeterminate = false
      } else {
        theOther.element_.checked = value
        theOther.element_.indeterminate = false
      }
    }
  }
  if (Build.MV3 && OnChrome && item.type_ === 2) {
    el.checked || (el.indeterminate = true)
  }
}

if (!OnEdge) {
  const ignored: Array<kBrowserPermission | RegExpOne> = OnFirefox ? [kShelf] : ["downloads"]
  OnChrome || ignored.push(<RegExpOne> /^chrome:/, "contentSettings")
  OnChrome && IsEdg_ && Build.OnBrowserNativePages && ignored.push(kNTP)
  OnFirefox || ignored.push("cookies")
  if (Build.MV3 && (!OnChrome || Build.MinCVer >= BrowserVer.MinUsableMV3 || CurCVer_ > BrowserVer.MinUsableMV3 - 1)) {
    optional_permissions = optional_permissions.concat(manifest.optional_host_permissions)
  }
  optional_permissions = optional_permissions.filter(
      i => !ignored.some(j => typeof j === "string" ? i === j : j.test(i)))
}
if (OnEdge || !optional_permissions.length && !(Build.MV3 && OnChrome && navNames.length)) {
  nextTick_((): void => { $("#optionalPermissionsBox").style.display = "none" })
} else {
  if (Build.MV3 && OnChrome) {
    for (const name of navNames) {
      shownItems.push({ name_: name, type_: 2, previous_: 1, element_: null as never })
    }
  }
  for (const name of optional_permissions) {
    shownItems.push({ name_: name, type_: name.includes(":") ? 1 : 0, previous_: 0, element_: null as never })
  }
  Build.MV3 && navPermissionTip && nextTick_((): void => { navPermissionTip!.style.display = "" })
  nextTick_(initOptionalPermissions)
  void Promise.all(shownItems.map(doPermissionsContain_)).then((): void => {
    nextTick_((): void => {
      (container.dataset as KnownOptionsDataset).model = "OptionalPermissions"
      void createNewOption(container).fetch_()
    })
  })
}
