async function loadLighthouse() {
  const lighthouse = await import('lighthouse');
  return lighthouse;
}

async function loadChromeLauncher() {
  const chromeLauncher = await import('chrome-launcher');
  return chromeLauncher;
}

export async function runAudit(website: string) {
  try {
    const lighthouse = await loadLighthouse();
    const chromeLauncher = await loadChromeLauncher();

    const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
    const options = { logLevel: 'info' as 'info', output: 'json' as 'json', onlyCategories: ['accessibility'], port: chrome.port };
    const runnerResult = await lighthouse.default(website, options);

    if (runnerResult) {
      console.log('Report is done for', runnerResult.lhr.finalDisplayedUrl);
      await chrome.kill();
      return runnerResult.lhr.audits; // Return only audits
    } else {
      console.error('Lighthouse audit failed to produce a result.');
      await chrome.kill();
      return null;
    }
  } catch (e) {
    console.error('Error during Lighthouse audit:', e);
    return null;
  }
}
