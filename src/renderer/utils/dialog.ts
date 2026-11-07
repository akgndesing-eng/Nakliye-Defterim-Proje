// Universal non-blocking in-app Confirm & Alert modal dialogs for Electron, iOS WKWebView & Android WebView
// Avoids native window.confirm / window.alert which freeze Electron input focus on Windows and are suppressed in iOS WKWebView.

export function confirmDialog(message: string, title = 'İşlem Onayı'): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(10,16,14,0.72);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);';

    const card = document.createElement('div');
    card.className = 'nd-modal';
    card.style.cssText =
      'width:100%;max-width:400px;padding:22px;border-radius:16px;background:var(--surface);border:1px solid var(--border);color:var(--text);box-shadow:0 24px 52px rgba(0,0,0,0.55);';

    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <div style="width:34px;height:34px;border-radius:10px;background:rgba(184,82,86,0.16);border:1px solid rgba(184,82,86,0.35);color:var(--red);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16px;flex-shrink:0;">!</div>
        <h3 style="margin:0;font-size:15px;font-weight:800;color:var(--text);">${title}</h3>
      </div>
      <p style="margin:0 0 18px 0;font-size:13px;line-height:1.55;color:var(--text-muted);">${message}</p>
      <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;">
        <button type="button" id="nd-dlg-cancel" class="nd-btn-secondary" style="padding:8px 16px;font-size:12px;font-weight:700;border-radius:10px;">Vazgeç</button>
        <button type="button" id="nd-dlg-confirm" style="padding:8px 18px;font-size:12px;font-weight:800;border-radius:10px;background:var(--red);color:#ffffff;border:none;">Evet, Onayla</button>
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const cleanup = (result: boolean) => {
      try {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      } catch {}
      resolve(result);
    };

    const btnCancel = card.querySelector('#nd-dlg-cancel') as HTMLButtonElement | null;
    const btnConfirm = card.querySelector('#nd-dlg-confirm') as HTMLButtonElement | null;

    btnCancel?.addEventListener('click', () => cleanup(false));
    btnConfirm?.addEventListener('click', () => cleanup(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(false);
    });
  });
}

export function alertDialog(message: string, title = 'Bilgilendirme'): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(10,16,14,0.72);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);';

    const card = document.createElement('div');
    card.className = 'nd-modal';
    card.style.cssText =
      'width:100%;max-width:390px;padding:22px;border-radius:16px;background:var(--surface);border:1px solid var(--border);color:var(--text);box-shadow:0 24px 52px rgba(0,0,0,0.55);';

    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <div style="width:34px;height:34px;border-radius:10px;background:rgba(197,155,82,0.18);border:1px solid rgba(197,155,82,0.38);color:var(--amber);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16px;flex-shrink:0;">!</div>
        <h3 style="margin:0;font-size:15px;font-weight:800;color:var(--text);">${title}</h3>
      </div>
      <p style="margin:0 0 18px 0;font-size:13px;line-height:1.55;color:var(--text-muted);">${message}</p>
      <div style="display:flex;align-items:center;justify-content:flex-end;">
        <button type="button" id="nd-dlg-ok" class="nd-btn-primary" style="padding:8px 22px;font-size:12px;font-weight:800;border-radius:10px;">Tamam</button>
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const cleanup = () => {
      try {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      } catch {}
      resolve();
    };

    const btnOk = card.querySelector('#nd-dlg-ok') as HTMLButtonElement | null;
    btnOk?.addEventListener('click', cleanup);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup();
    });
  });
}
