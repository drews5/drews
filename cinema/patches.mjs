// Downstream source patches applied to the pinned Nuvio Web checkout.
// Each patch asserts its anchor exists exactly once so an upstream bump fails
// loudly instead of silently shipping an unpatched build.
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const PUBLISHABLE_KEY='sb_publishable_1Clq8rlTVACkdcZuqr6_AD__xUUC_EN';

async function edit(source,file,edits){
 const path=join(source,file);
 let text=await readFile(path,'utf8');
 for(const [find,replace] of edits){
  const count=text.split(find).length-1;
  if(count!==1)throw Error(`Upstream changed: expected one match in ${file} for ${JSON.stringify(find.slice(0,80))}, found ${count}`);
  text=text.replace(find,()=>typeof replace==='function'?replace(find):replace);
 }
 await writeFile(path,text);
 return file;
}

export async function patchUpstream(source){
 const files=[];
 // Browsers get a responsive viewport and a runtime class used to scope the
 // Cinema design layer. Tizen and webOS keep the untouched TV layout.
 files.push(await edit(source,'index.html',[
  ['width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no','width=device-width, initial-scale=1.0, viewport-fit=cover'],
  ['<meta name="apple-mobile-web-app-capable" content="yes" />',`<meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="theme-color" content="#0b0b0c" />
    <script>
      (function markCinemaRuntime() {
        var root = document.documentElement;
        var ua = String(navigator.userAgent || "").toLowerCase();
        var tv = window.__NUVIO_PLATFORM__ === "tizen" || window.tizen || ua.indexOf("tizen") !== -1 ||
          ua.indexOf("webos") !== -1 || ua.indexOf("web0s") !== -1 || window.PalmSystem;
        if (tv) { root.classList.add("cinema-tv"); return; }
        root.classList.add("cinema-web");
        var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
        root.classList.add(coarse ? "cinema-touch" : "cinema-pointer");
      })();
    </script>`],
  ['</head>','<link rel="stylesheet" href="assets/cinema.css?v=dev" /></head>']
 ]));

 const props=await readFile(join(source,'local.example.properties'),'utf8');
 if(!/^NUVIO_SUPABASE_URL=/m.test(props)||!/^NUVIO_SUPABASE_ANON_KEY=/m.test(props))throw Error('Upstream authentication configuration changed');
 // Nuvio documents this publishable identifier for public clients: https://nuvio.tv/docs/server-api
 await writeFile(join(source,'local.properties'),props
  .replace(/^NUVIO_SUPABASE_URL=.*$/m,'NUVIO_SUPABASE_URL=https://api.nuvio.tv')
  .replace(/^NUVIO_SUPABASE_ANON_KEY=.*$/m,'NUVIO_SUPABASE_ANON_KEY='+PUBLISHABLE_KEY));

 // The official server advertises email_password_auth in /.well-known/nuvio.
 // Upstream hides it because TVs have no comfortable keyboard; browsers do.
 files.push(await edit(source,'js/data/local/serverConfigurationStore.js',[
  ['capabilities: { emailPasswordAuth: false, tvLogin: true, watchParty: true },',
   'capabilities: { emailPasswordAuth: isCinemaBrowserRuntime(), tvLogin: true, watchParty: true },'],
  ['function officialConfiguration() {',`function isCinemaBrowserRuntime() {
  return Boolean(globalThis.document?.documentElement?.classList?.contains("cinema-web"));
}

function officialConfiguration() {`]
 ]));

 const mount='js/ui/screens/account/authQrSignInScreenMethods-01-mount.js';
 files.push(await edit(source,mount,[
  ['<h1 class="qr-title">${I18n.t("auth.qr.title")}</h1>',
   '<h1 class="qr-title">${this.useEmailLogin && !this.isSignedIn ? I18n.t("auth.email.signIn") : I18n.t("auth.qr.title")}</h1>'],
  // Make the alternate sign-in method a visible control instead of only a
  // hidden server-menu entry, so phones can reach QR and email directly.
  ['      return `${refreshAction}${continueLabel}`;',
   `      const switchAction = !this.isSignedIn && this.supportsEmailAuth && this.supportsQrAuth
        ? \`<button type="button" class="qr-action-btn qr-action-btn-secondary cinema-login-switch focusable" data-action="\${this.useEmailLogin ? "login-qr" : "login-email"}">
            \${escapeHtml(I18n.t(this.useEmailLogin ? "server_options_login_with_qr" : "server_options_login_with_email"))}
          </button>\`
        : "";
      return \`\${refreshAction}\${switchAction}\${continueLabel}\`;`]
 ]));

 files.push(await edit(source,'js/ui/screens/account/authQrSignInScreenMethods-03-to-friendly-email-error.js',[
  ['if (this.useEmailLogin) return I18n.t("auth.email.hint");',
   'if (this.useEmailLogin) return this.serverConfiguration?.isCustom ? I18n.t("auth.email.hint") : I18n.t("auth.email.instruction");']
 ]));

 const qr='js/ui/screens/account/authQrSignInScreenMethods-02-bind-controls.js';
 const manualLine='manualText.innerText = manualUrl && (displayCode || code) ? I18n.t("auth.qr.manualInstruction", { url: manualUrl }) : "";';
 files.push(await edit(source,qr,[
  [manualLine,`${manualLine}
        // A phone cannot scan its own screen: offer the approval page directly.
        if (location.protocol === "https:" && /^https:\\/\\//i.test(content)) {
          const link = document.createElement("a");
          link.className = "cinema-pair-link";
          link.href = content;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = "Open sign-in on this device";
          manualText.append(link);
        }`],
  ['expiryNode.innerText = I18n.t("auth.qr.expires", {\n            duration: formatDuration(remaining)\n          });','expiryNode.textContent = "Expires in " + formatDuration(remaining);'],
  ['if (remaining <= 0) {\n          this.setStatus','if (remaining <= 0) {\n          this.clearQr();\n          this.setStatus']
 ]));

 // Hosted browser builds update on deployment; the TV installer prompt does not apply.
 files.push(await edit(source,'js/app.js',[
  ['async function checkForAppUpdateOnStartup() {','async function checkForAppUpdateOnStartup() {\n  if (!Platform.isTizen() && !Platform.isWebOS()) return;']
 ]));
 return files;
}
