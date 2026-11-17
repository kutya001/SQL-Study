"""Быстрая проверка интерфейса в настоящем браузере (необязательно для работы курса).

Нужны: Python 3.9+, `pip install playwright` и `python -m playwright install chromium`.
    python3 tools/ui-smoke.py            # режим сайта (http) и из папки (file://)
    python3 tools/ui-smoke.py --show     # то же, с видимым окном браузера

Проверяет: стартовую страницу, хранение в браузере, вход, решение задачи тренажёра,
загрузку учебных баз из schemas/index.js, песочницу с USE, таблицу результата (общий компонент),
схему на canvas, фильтр тренажёра по командам, сохранение после перезагрузки
и отсутствие ошибок в консоли.
"""
import asyncio, os, subprocess, sys, tempfile, time, pathlib
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHOW = '--show' in sys.argv
PORT = 8765

async def scenario(browser, url, tag, errors):
    ctx = await browser.new_context(viewport={'width': 1300, 'height': 900})
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errors.append(f'{tag}: {e}'))
    pg.on('console', lambda m: m.type == 'error' and errors.append(f'{tag}: {m.text}'))
    await pg.goto(url); await pg.wait_for_timeout(800)
    await pg.get_by_text('Хранить в браузере', exact=True).click(); await pg.wait_for_timeout(400)
    await pg.fill('input[placeholder^="Фамилия и имя"]', 'Тестов Тест'); await pg.get_by_text('Создать и начать').click()
    await pg.wait_for_timeout(1500)
    packs = await pg.evaluate("Packs.all().map(p => p.id)")
    assert {'bank', 'shop', 'sewing', 'cargo'} <= set(packs), f'{tag}: не все базы загружены: {packs}'
    await pg.goto(url + '#/t/t1-01'); await pg.wait_for_timeout(500)
    sol = await pg.evaluate("App.trainerTasks().filter(t => t.id === 't1-01')[0].solution")
    await pg.locator('textarea.ed-ta').first.fill(sol); await pg.locator('.task-btns .btn.primary').first.click(); await pg.wait_for_timeout(500)
    fb = await pg.inner_text('.task-fb')
    assert 'Отлично' in fb or 'Верно' in fb, f'{tag}: задача не засчитана: {fb[:80]}'
    await pg.goto(url + '#/sandbox/sewing'); await pg.wait_for_timeout(500)
    await pg.locator('textarea.ed-ta').first.fill("USE Cargo;\nSELECT COUNT(*) AS N FROM Shipments;")
    await pg.locator('.task-btns .btn.primary').first.click(); await pg.wait_for_timeout(600)
    # таблица результата — общий компонент: сортировка из кода и фильтр по значению
    grid = await pg.evaluate("""(() => {
      const el = document.querySelector('.res-pane .dg'); if (!el || !el.dataGrid) return null;
      return { rows: el.dataGrid.view.length, head: el.querySelectorAll('th .th-f').length };
    })()""")
    assert grid and grid['rows'] == 1 and grid['head'] == 1, f'{tag}: таблица результата не на общем компоненте: {grid}'
    # схема базы рисуется на canvas
    await pg.goto(url + '#/schema/bank'); await pg.wait_for_timeout(900)
    erd = await pg.evaluate("""(() => {
      const c = document.querySelector('.erdc-canvas'); if (!c) return null;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, seen = new Set();
      for (let i = 0; i < d.length; i += 4 * 97) seen.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]);
      const r = c.getBoundingClientRect(), k = window.devicePixelRatio || 1;
      return { colors: seen.size, tables: window.__erdLast.nodes.length, links: window.__erdLast.edges.length,
        canvas: c.width + 'x' + c.height, screen: (r.width * k) + 'x' + (r.height * k),
        exact: Math.abs(c.width - r.width * k) <= 1 && Math.abs(c.height - r.height * k) <= 1 };
    })()""")
    assert erd and erd['colors'] > 12 and erd['tables'] == 9 and erd['links'] == 8, f'{tag}: схема не нарисована: {erd}'
    # холст схемы совпадает с экраном «пиксель в пиксель» — иначе браузер растягивает картинку и схема мутная
    assert erd['exact'], f'{tag}: размер холста схемы не равен размеру на экране (схема будет мутной): {erd}'
    # тренажёр: фильтр по командам
    await pg.goto(url + '#/trainer/0/bank'); await pg.wait_for_timeout(500)
    await pg.locator('.chip.cmd', has_text='HAVING').first.click(); await pg.wait_for_timeout(400)
    found = await pg.evaluate("App.user.settings.trainerCmds.join(',') + ':' + document.querySelectorAll('.tr-row').length")
    assert found.startswith('having:') and int(found.split(':')[1]) >= 1, f'{tag}: фильтр тренажёра по командам не работает: {found}'
    await pg.locator('.cmd-reset').click(); await pg.wait_for_timeout(300)
    # оформление: окно с палитрами, смена палитры и темы
    await pg.locator('.tb-pal').click(); await pg.wait_for_timeout(400)
    cards = await pg.locator('.modal .pal-card').count()
    assert cards == len(await pg.evaluate("App.PALETTES")) and cards >= 2, f'{tag}: в окне оформления не все палитры: {cards}'
    before = await pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()")
    await pg.locator('.modal .pal-card[data-palette="amber"]').click(); await pg.wait_for_timeout(500)
    await pg.locator('.modal .theme-seg .seg-btn[data-theme-val="dark"]').click(); await pg.wait_for_timeout(500)
    look = await pg.evaluate("""(() => {
      const d = document.documentElement;
      return { pal: d.getAttribute('data-palette'), theme: d.getAttribute('data-theme'), primary: getComputedStyle(d).getPropertyValue('--primary').trim(),
        saved: App.user.settings.palette + '/' + App.user.settings.theme, on: document.querySelector('.modal .pal-card.on').getAttribute('data-palette') };
    })()""")
    assert look['pal'] == 'amber' and look['theme'] == 'dark' and look['primary'] != before and look['saved'] == 'amber/dark' and look['on'] == 'amber', f'{tag}: палитра или тема не переключились: {look}'
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
    # у каждой палитры из списка есть свои цвета в стилях — и для светлой, и для тёмной темы
    uniq = await pg.evaluate("""(() => {
      const d = document.documentElement, keep = [d.getAttribute('data-theme'), d.getAttribute('data-palette')], out = {};
      for (const t of ['light', 'dark']) {
        d.setAttribute('data-theme', t);
        out[t] = new Set(App.PALETTES.map(p => { d.setAttribute('data-palette', p.id); const cs = getComputedStyle(d); return cs.getPropertyValue('--primary') + cs.getPropertyValue('--grad') + cs.getPropertyValue('--bg'); })).size;
      }
      d.setAttribute('data-theme', keep[0]); d.setAttribute('data-palette', keep[1]);
      return out;
    })()""")
    assert uniq['light'] == cards and uniq['dark'] == cards, f'{tag}: у части палитр нет своих цветов в css/app.css: {uniq}'
    xp = await pg.evaluate("App.user.xp")
    await pg.reload(); await pg.wait_for_timeout(1200)
    early = await pg.evaluate("document.documentElement.getAttribute('data-palette') + '/' + document.documentElement.getAttribute('data-theme')")
    assert early == 'amber/dark', f'{tag}: оформление не восстановилось после перезагрузки: {early}'
    await pg.locator('.continue-btn').click(); await pg.wait_for_timeout(1000)
    xp2 = await pg.evaluate("App.user.xp")
    assert xp2 == xp and xp > 0, f'{tag}: прогресс не сохранился ({xp} → {xp2})'
    print(f'  {tag}: базы {", ".join(packs)}; задача засчитана; таблица, схема, фильтр тренажёра и смена палитры работают; XP {xp} сохранился после перезагрузки')
    await ctx.close()

async def main():
    errors = []
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.2', '-d', str(ROOT)],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=not SHOW)
            await scenario(browser, f'http://127.0.0.2:{PORT}/', 'сайт (http)', errors)
            await scenario(browser, ROOT.as_uri() + '/index.html', 'из папки (file://)', errors)
            await browser.close()
    finally:
        srv.terminate()
    if errors:
        print('Ошибки в консоли браузера:'); [print('  ' + e) for e in errors]; sys.exit(1)
    print('Интерфейс в порядке.')

asyncio.run(main())
