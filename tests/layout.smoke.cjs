const assert = require("node:assert/strict");
const net = require("node:net");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow } = require("electron");

const projectRoot = path.resolve(__dirname, "..");

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function waitForReady(port) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/ready`, { cache: "no-store" });
      if (response.ok) return;
    } catch {
      // The compiled server may need a few milliseconds to bind its port.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("local production server did not become ready");
}

async function setLocale(window, locale) {
  await window.webContents.executeJavaScript(`(() => {
    const input = document.querySelector('#locale-input');
    input.value = ${JSON.stringify(locale)};
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 300));
}

async function inspectLobby(window, locale) {
  return window.webContents.executeJavaScript(`(() => {
    const card = document.querySelector('.lobby-card');
    const ignoredClip = '.char-description, input, select, textarea, img';
    const all = [...(card?.querySelectorAll('*') ?? [])];
    const visible = all.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const horizontalOverflow = visible
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > window.innerWidth + 1;
      })
      .map((element) => element.id || element.className || element.tagName);
    const clippedText = visible
      .filter((element) => {
        if (element.matches(ignoredClip)) return false;
        const style = getComputedStyle(element);
        if (style.overflowX === 'hidden' && style.whiteSpace === 'nowrap') return false;
        return element.scrollWidth > element.clientWidth + 2;
      })
      .map((element) => element.id || element.className || element.tagName);
    const required = ['locale-input', 'arena-input', 'room-input', 'name-input', 'audio-toggle', 'practice-btn', 'join-btn'];
    const controls = Object.fromEntries(required.map((id) => {
      const element = document.getElementById(id);
      const rect = element?.getBoundingClientRect();
      return [id, {
        present: Boolean(element),
        width: rect ? Math.round(rect.width) : 0,
        right: rect ? Math.round(rect.right) : 0,
      }];
    }));
    const cardRect = card?.getBoundingClientRect();
    return {
      locale: document.documentElement.lang,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      cardWidth: cardRect ? Math.round(cardRect.width) : 0,
      cardHeight: cardRect ? Math.round(cardRect.height) : 0,
      cardCanScrollVertically: Boolean(card && card.scrollHeight > card.clientHeight),
      documentScrollWidth: document.documentElement.scrollWidth,
      horizontalOverflow,
      clippedText,
      controls,
    };
  })()`);
}

async function showResultFixture(window, locale) {
  const fixture = locale === "en"
    ? {
        kicker: "Round over",
        title: "Result B wins!",
        outcome: "You were eliminated.",
        reason: "Elimination reason: the dog caught the ball holder.",
        next: "Next: pass before turning, and save Blink for the dog's turn.",
      }
    : {
        kicker: "本局結束",
        title: "結果 B 獲勝！",
        outcome: "你已出局。",
        reason: "出局原因：被狗咬中持球者。",
        next: "下一步：先傳球再走位，把 Blink 留給狗轉向的瞬間。",
      };
  await window.webContents.executeJavaScript(`(() => {
    const values = ${JSON.stringify(fixture)};
    document.querySelector('#result-panel').hidden = false;
    document.querySelector('.result-kicker').textContent = values.kicker;
    document.querySelector('#result-title').textContent = values.title;
    document.querySelector('#result-outcome').textContent = values.outcome;
    document.querySelector('#result-reason').textContent = values.reason;
    document.querySelector('#result-next').textContent = values.next;
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 100));
}

async function hideResultFixture(window) {
  await window.webContents.executeJavaScript("document.querySelector('#result-panel').hidden = true");
}

async function exerciseAudioToggle(window) {
  return window.webContents.executeJavaScript(`(() => {
    const toggle = document.querySelector('#audio-toggle');
    const before = toggle?.getAttribute('aria-pressed');
    toggle?.click();
    const afterFirst = toggle?.getAttribute('aria-pressed');
    toggle?.click();
    const afterSecond = toggle?.getAttribute('aria-pressed');
    // Leave the test page muted so no music timer survives teardown.
    if (toggle?.getAttribute('aria-pressed') === 'true') toggle.click();
    return { present: Boolean(toggle), before, afterFirst, afterSecond };
  })()`);
}

async function main() {
  let serverModule = null;
  let window = null;
  await app.whenReady();

  try {
    const port = await getFreePort();
    process.env.NODE_ENV = "production";
    process.env.HOST = "127.0.0.1";
    process.env.PORT = String(port);
    process.env.CLIENT_DIST_PATH = path.join(projectRoot, "dist");
    serverModule = await import(
      pathToFileURL(path.join(projectRoot, "dist-server", "server", "index.js")).href,
    );
    await waitForReady(port);

    window = new BrowserWindow({
      width: 390,
      height: 844,
      show: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    await window.loadURL(`http://127.0.0.1:${port}/`);
    await window.webContents.executeJavaScript("document.fonts?.ready");
    await new Promise((resolve) => setTimeout(resolve, 300));

    const audioToggle = await exerciseAudioToggle(window);
    assert.equal(audioToggle.present, true, 'audio toggle is missing');
    assert.notEqual(audioToggle.before, audioToggle.afterFirst, 'audio toggle did not change state');
    assert.equal(audioToggle.before, audioToggle.afterSecond, 'audio toggle did not restore state');

    const reports = [];
    for (const locale of ["zh-Hant", "en"]) {
      await setLocale(window, locale);
      const report = await inspectLobby(window, locale);
      assert.equal(report.locale, locale);
      assert.ok(report.innerWidth <= 390, `unexpected viewport width for ${locale}`);
      assert.ok(report.cardWidth <= report.innerWidth, `lobby card overflows viewport for ${locale}`);
      assert.equal(report.horizontalOverflow.length, 0, `horizontal overflow for ${locale}`);
      assert.equal(
        report.clippedText.length,
        0,
        `clipped text for ${locale}: ${JSON.stringify(report.clippedText)}`,
      );
      for (const [id, control] of Object.entries(report.controls)) {
        assert.equal(control.present, true, `missing ${id} for ${locale}`);
        assert.ok(control.width > 0, `zero-width ${id} for ${locale}`);
        assert.ok(control.right <= report.innerWidth + 1, `${id} overflows viewport for ${locale}`);
      }
      await showResultFixture(window, locale);
      const resultReport = await inspectLobby(window, locale);
      assert.equal(resultReport.horizontalOverflow.length, 0, `result horizontal overflow for ${locale}`);
      assert.equal(resultReport.clippedText.length, 0, `result clipped text for ${locale}`);
      await hideResultFixture(window);
      reports.push({ lobby: report, result: resultReport });
    }

    process.stdout.write(`${JSON.stringify({ ok: true, viewport: "390x844", reports }, null, 2)}\n`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  } finally {
    if (window && !window.isDestroyed()) window.destroy();
    if (serverModule?.httpServer) {
      await new Promise((resolve) => serverModule.httpServer.close(resolve));
    }
    if (app.isReady()) app.quit();
  }
}

main().catch((error) => {
  console.error(error);
  app.exit(1);
});
