## Tool to visualize addon-sdk module system overhead

I noticed that addon-sdk addons spend a lot of time `require()`ing files, and I wanted to see how much time we spent on what files, and who includes what.

Here's an example result:

```
3844.84ms 0.00ms total
[...]
├─ 134.52ms 3.52ms resource://gre/modules/commonjs/sdk/l10n/html.js
│  └─ 130.99ms 42.54ms resource://gre/modules/commonjs/sdk/remote/parent.js
│     ├─ 1.95ms 1.95ms resource://gre/modules/commonjs/sdk/remote/core.js
│     ├─ 30.97ms 15.08ms resource://gre/modules/commonjs/sdk/core/disposable.js
│     │  ├─ 13.21ms 8.48ms resource://gre/modules/commonjs/sdk/core/observer.js
│     │  │  ├─ 4.65ms 4.65ms resource://gre/modules/commonjs/sdk/core/reference.js
│     │  │  └─ 0.08ms 0.08ms resource://gre/modules/ShimWaiver.jsm
│     │  └─ 2.68ms 2.68ms resource://gre/modules/commonjs/sdk/lang/weak-set.js
│     ├─ 12.82ms 7.26ms resource://gre/modules/commonjs/sdk/event/target.js
│     │  ├─ 2.09ms 2.09ms resource://gre/modules/commonjs/sdk/event/core.js
│     │  └─ 3.46ms 3.32ms resource://gre/modules/commonjs/sdk/lang/functional/core.js
│     │     └─ 0.14ms 0.14ms resource://gre/modules/commonjs/sdk/lang/functional/helpers.js
│     ├─ 17.44ms 8.58ms resource://gre/modules/commonjs/sdk/remote/utils.js
│     │  ├─ 4.42ms 4.42ms resource://gre/modules/commonjs/sdk/util/list.js
│     │  └─ 4.44ms 4.44ms resource://gre/modules/commonjs/sdk/event/utils.js
│     ├─ 24.39ms 7.76ms resource://gre/modules/commonjs/sdk/tabs/utils.js
│     │  ├─ 16.55ms 4.49ms resource://gre/modules/commonjs/sdk/lang/functional.js
│     │  │  └─ 12.06ms 7.89ms resource://gre/modules/commonjs/sdk/lang/functional/concurrent.js
│     │  │     └─ 4.17ms 4.17ms resource://gre/modules/commonjs/sdk/timers.js
│     │  └─ 0.09ms 0.09ms resource://gre/modules/ShimWaiver.jsm
│     └─ 0.88ms 0.88ms resource://gre/modules/commonjs/framescript/FrameScriptManager.jsm
├─ 48.47ms 10.86ms resource://gre/modules/commonjs/sdk/preferences/native-options.js
│  ├─ 37.49ms 5.32ms resource://gre/modules/commonjs/sdk/l10n/prefs.js
│  │  └─ 32.16ms 3.89ms resource://gre/modules/commonjs/sdk/l10n/core.js
│  │     ├─ 2.21ms 2.21ms resource://gre/modules/commonjs/sdk/l10n/json/core.js
│  │     └─ 26.06ms 12.18ms resource://gre/modules/commonjs/sdk/l10n/properties/core.js
│  │        ├─ 13.39ms 5.68ms resource://gre/modules/commonjs/sdk/url/utils.js
│  │        │  └─ 7.71ms 6.08ms resource://gre/modules/commonjs/sdk/url.js
│  │        │     ├─ 1.58ms 1.50ms resource://gre/modules/commonjs/sdk/base64.js
│  │        │     │  └─ 0.08ms 0.08ms resource://gre/modules/Services.jsm
│  │        │     └─ 0.06ms 0.06ms resource://gre/modules/Services.jsm
│  │        ├─ 0.42ms 0.42ms resource://gre/modules/commonjs/sdk/l10n/plural-rules.js
│  │        └─ 0.08ms 0.08ms resource://gre/modules/Services.jsm
│  ├─ 0.06ms 0.06ms resource://gre/modules/Services.jsm
│  └─ 0.06ms 0.06ms resource://gre/modules/AddonManager.jsm
```

## How to use

First, clone this repository and execute `npm install` to install the dependencies.

Then, apply this patch to your Firefox:

```diff
changeset:   373286:2ddf1dd48b4f
tag:         tip
parent:      373277:5affc1cefcb7
user:        Markus Stange <mstange@themasta.com>
date:        Thu Oct 06 17:02:13 2016 -0400
summary:     Print timings for nsXPCComponents_Utils::Import and mozJSSubScriptLoader::LoadSubScript to stdout.

diff --git a/js/xpconnect/loader/mozJSSubScriptLoader.cpp b/js/xpconnect/loader/mozJSSubScriptLoader.cpp
--- a/js/xpconnect/loader/mozJSSubScriptLoader.cpp
+++ b/js/xpconnect/loader/mozJSSubScriptLoader.cpp
@@ -29,16 +29,17 @@
 #include "mozilla/dom/ToJSValue.h"
 #include "mozilla/HoldDropJSObjects.h"
 #include "mozilla/scache/StartupCache.h"
 #include "mozilla/scache/StartupCacheUtils.h"
 #include "mozilla/Unused.h"
 #include "nsContentUtils.h"
 #include "nsStringGlue.h"
 #include "nsCycleCollectionParticipant.h"
+#include "nsXULAppAPI.h"

 using namespace mozilla::scache;
 using namespace JS;
 using namespace xpc;
 using namespace mozilla;
 using namespace mozilla::dom;

 class MOZ_STACK_CLASS LoadSubScriptOptions : public OptionsBase {
@@ -511,31 +512,40 @@ mozJSSubScriptLoader::ReadScript(nsIURI*

 NS_IMETHODIMP
 mozJSSubScriptLoader::LoadSubScript(const nsAString& url,
                                     HandleValue target,
                                     const nsAString& charset,
                                     JSContext* cx,
                                     MutableHandleValue retval)
 {
+    if (XRE_IsParentProcess()) {
+        printf("mozJSSubScriptLoader::LoadSubScript begin %s\n", NS_ConvertUTF16toUTF8(url).get());
+    }
+    mozilla::TimeStamp before = mozilla::TimeStamp::Now();
     /*
      * Loads a local url and evals it into the current cx
      * Synchronous (an async version would be cool too.)
      *   url: The url to load.  Must be local so that it can be loaded
      *        synchronously.
      *   target_obj: Optional object to eval the script onto (defaults to context
      *               global)
      *   charset: Optional character set to use for reading
      *   returns: Whatever jsval the script pointed to by the url returns.
      * Should ONLY (O N L Y !) be called from JavaScript code.
      */
     LoadSubScriptOptions options(cx);
     options.charset = charset;
     options.target = target.isObject() ? &target.toObject() : nullptr;
-    return DoLoadSubScriptWithOptions(url, options, cx, retval);
+    nsresult rv = DoLoadSubScriptWithOptions(url, options, cx, retval);
+    if (XRE_IsParentProcess()) {
+        printf("mozJSSubScriptLoader::LoadSubScript end %s %f\n", NS_ConvertUTF16toUTF8(url).get(),
+               (mozilla::TimeStamp::Now() - before).ToMilliseconds());
+    }
+    return rv;
 }


 NS_IMETHODIMP
 mozJSSubScriptLoader::LoadSubScriptWithOptions(const nsAString& url,
                                                HandleValue optionsVal,
                                                JSContext* cx,
                                                MutableHandleValue retval)
diff --git a/js/xpconnect/src/XPCComponents.cpp b/js/xpconnect/src/XPCComponents.cpp
--- a/js/xpconnect/src/XPCComponents.cpp
+++ b/js/xpconnect/src/XPCComponents.cpp
@@ -31,16 +31,17 @@
 #include "nsIDOMFileList.h"
 #include "nsWindowMemoryReporter.h"
 #include "nsDOMClassInfo.h"
 #include "ShimInterfaceInfo.h"
 #include "nsIAddonInterposition.h"
 #include "nsISimpleEnumerator.h"
 #include "nsPIDOMWindow.h"
 #include "nsGlobalWindow.h"
+#include "nsXULAppAPI.h"

 using namespace mozilla;
 using namespace JS;
 using namespace js;
 using namespace xpc;
 using mozilla::dom::Exception;

 /***************************************************************************/
@@ -2489,21 +2490,30 @@ nsXPCComponents_Utils::SetSandboxMetadat

 NS_IMETHODIMP
 nsXPCComponents_Utils::Import(const nsACString& registryLocation,
                               HandleValue targetObj,
                               JSContext* cx,
                               uint8_t optionalArgc,
                               MutableHandleValue retval)
 {
+    if (XRE_IsParentProcess()) {
+        printf("nsXPCComponents_Utils::Import begin %s\n", PromiseFlatCString(registryLocation).get());
+    }
+    mozilla::TimeStamp before = mozilla::TimeStamp::Now();
     nsCOMPtr<xpcIJSModuleLoader> moduleloader =
         do_GetService(MOZJSCOMPONENTLOADER_CONTRACTID);
     if (!moduleloader)
         return NS_ERROR_FAILURE;
-    return moduleloader->Import(registryLocation, targetObj, cx, optionalArgc, retval);
+    nsresult rv = moduleloader->Import(registryLocation, targetObj, cx, optionalArgc, retval);
+    if (XRE_IsParentProcess()) {
+        printf("nsXPCComponents_Utils::Import end %s %f\n", PromiseFlatCString(registryLocation).get(),
+               (mozilla::TimeStamp::Now() - before).ToMilliseconds());
+    }
+    return rv;
 }

 NS_IMETHODIMP
 nsXPCComponents_Utils::IsModuleLoaded(const nsACString& registryLocation, bool* retval)
 {
     nsCOMPtr<xpcIJSModuleLoader> moduleloader =
         do_GetService(MOZJSCOMPONENTLOADER_CONTRACTID);
     if (!moduleloader)
```

Then recompile Firefox, and pipe its output into `node index.js`, for example like this:

```
mach run -P testpilot | node ~/code/module-profiling/index.js - > output.txt
```

Now `output.txt` will contain a tree and two tables.

You can also redirect the Firefox output into a file and then read that file:

```
mach run -P testpilot > require-timings.log
node index.js require-timings.log > output.txt
```
