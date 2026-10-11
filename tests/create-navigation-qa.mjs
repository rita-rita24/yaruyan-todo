// Navigation QA uses disposable storage and synthetic task data only.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

async function navigationQa() {
  const lines = [];
  const frame = () =>
    new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  const check = (ok, label) => lines.push(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  try {
    settings.sound = false;
    settings.celebration = false;
    tasks = normalizeTasks([{ id: 'sample', text: '今日の作業を確認する' }]);
    navigate('tasks');
    await frame();
    navigate('settings');
    await frame();
    check(
      window.scrollY === 0,
      `settings starts at document top (scrollY=${window.scrollY})`,
    );
    check(
      document.activeElement === qs('#page-settings h1'),
      'settings heading receives focus without scrolling past the navigation',
    );
    if (isCompactSidebarViewport()) {
      check(
        qs('.sidebar').getBoundingClientRect().top >= 0,
        'top navigation remains fully visible after switching to settings',
      );
      check(
        navButtons.every(
          (button) => getComputedStyle(button).justifyContent === 'center',
        ),
        'horizontal navigation contents are centered',
      );
      check(
        navButtons.every((button) => {
          const bounds = button.getBoundingClientRect();
          const icon = qs('.nav-icon', button).getBoundingClientRect();
          const label = qs('.nav-label', button).getBoundingClientRect();
          const contentCenter =
            (Math.min(icon.left, label.left) +
              Math.max(icon.right, label.right)) /
            2;
          return Math.abs(contentCenter - (bounds.left + bounds.right) / 2) < 1;
        }),
        'navigation icon and label are geometrically centered in each button',
      );
    } else {
      check(
        navButtons.every(
          (button) => getComputedStyle(button).justifyContent === 'flex-start',
        ),
        'desktop sidebar retains its left alignment',
      );
    }
    window.scrollTo({ top: 400, behavior: 'instant' });
    await frame();
    const savedScroll = window.scrollY;
    render();
    check(
      window.scrollY === savedScroll,
      'ordinary render preserves the current settings scroll position',
    );
    navigate('tasks');
    await frame();
    check(
      window.scrollY === 0,
      'returning to tasks resets the document scroll',
    );
    navigate('memo');
    await frame();
    check(window.scrollY === 0, 'switching to memo resets the document scroll');
    navigate('settings');
    await frame();
    check(
      window.scrollY === 0,
      'switching back to settings resets the document scroll',
    );
    check(
      document.documentElement.scrollWidth <= window.innerWidth,
      'navigation and settings do not overflow horizontally',
    );
  } catch (error) {
    lines.push(`ERROR ${error.stack}`);
  }
  const failures = lines.filter((line) => /^(FAIL|ERROR)/.test(line)).length;
  const output = document.createElement('pre');
  output.id = 'qa-results';
  output.textContent =
    lines.join('\n') +
    `\n${lines.filter((line) => line.startsWith('PASS')).length} PASSED / ${failures} FAILED`;
  document.body.replaceChildren(output);
  document.title = failures ? 'FAIL: navigation QA' : 'PASS: navigation QA';
}
const directory = mkdtempSync(join(tmpdir(), 'yaruyan-navigation-qa-'));
const original = readFileSync(
  new URL('../yaruyan-todo.html', import.meta.url),
  'utf8',
);
const namespace = `navigation-qa-${randomUUID()}`;
const isolated = original.replaceAll('yatta-spa-', `${namespace}-`);
const marker = '      navigate(getRouteFromHash());\n    })();';
if (!isolated.includes(marker))
  throw new Error('Initialization marker missing');
writeFileSync(
  join(directory, 'index.html'),
  isolated.replace(
    marker,
    `      navigate(getRouteFromHash());\nawait (${navigationQa})();\n    })();`,
  ),
);
writeFileSync(
  join(directory, 'app.html'),
  isolated.replaceAll(namespace, `${namespace}-preview`),
);
console.log(directory);
