"""Быстрая проверка интерфейса в настоящем браузере (необязательно для работы курса).

Нужны: Python 3.9+, `pip install playwright` и `python -m playwright install chromium`.
    python3 tools/ui-smoke.py            # режим сайта (http) и из папки (file://)
    python3 tools/ui-smoke.py --show     # то же, с видимым окном браузера

Проверяет: стартовую страницу, хранение в браузере, вход, решение задачи тренажёра,
загрузку учебных баз из schemas/index.js, песочницу с USE, таблицу результата (общий компонент),
схему на canvas, фильтр тренажёра по командам, сохранение после перезагрузки,
подсказки и экскурсии (каждый шаг находит свой элемент — на компьютере и на телефоне)
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

# Подсказки и экскурсии: на компьютере и на телефоне каждый шаг каждой экскурсии находит свой элемент,
# экскурсия проходится от начала до конца, работают меню «?», метки-подсказки и страница «О курсе».
async def guide(browser, url, tag, errors, phone):
    ctx = await browser.new_context(**({'viewport': {'width': 390, 'height': 800}, 'is_mobile': True, 'has_touch': True} if phone else {'viewport': {'width': 1440, 'height': 900}}))
    pg = await ctx.new_page()
    pg.on('pageerror', lambda e: errors.append(f'{tag}: {e}'))
    pg.on('console', lambda m: m.type == 'error' and errors.append(f'{tag}: {m.text}'))
    await pg.goto(url); await pg.wait_for_timeout(900)
    await pg.locator('.start-help').click(); await pg.wait_for_timeout(300)
    assert await pg.locator('.modal .help-about').count() == 1, f'{tag}: на странице входа не открылось окно «О курсе»'
    await pg.keyboard.press('Escape')
    await pg.get_by_text('Хранить в браузере').click(); await pg.wait_for_timeout(300)
    await pg.fill('input[placeholder^="Фамилия и имя"]', 'Проверка Подсказок')
    await pg.get_by_text('Создать и начать').click(); await pg.wait_for_timeout(1300)
    # первое знакомство: предложение на главной и точка на кнопке «?»
    assert await pg.locator('.guide-offer').count() == 1, f'{tag}: нет предложения экскурсии при первом входе'
    assert await pg.evaluate('Guide.isNew()'), f'{tag}: кнопка «?» не отмечена на новой странице'
    await pg.locator('.guide-offer .btn.primary').click(); await pg.wait_for_timeout(400)
    n = await pg.evaluate("Guide.usable('intro').length")
    assert await pg.evaluate('Guide.active()') == 'intro' and n >= 8, f'{tag}: знакомство не началось ({n} шагов)'
    for i in range(n):
        box = await pg.evaluate("""(() => { const p = document.querySelector('.guide-pop').getBoundingClientRect(); return p.left >= 0 && p.top >= 0 && p.right <= innerWidth + 1 && p.bottom <= innerHeight + 1; })()""")
        assert box, f'{tag}: пояснение шага {i + 1} выходит за экран'
        await pg.locator('.guide-pop .btn.primary').click(); await pg.wait_for_timeout(120)
    st = await pg.evaluate("({active: Guide.active(), seen: App.user.settings.guide.seen.intro, offer: document.querySelectorAll('.guide-offer').length, dot: Guide.isNew()})")
    assert st == {'active': None, 'seen': 1, 'offer': 0, 'dot': False}, f'{tag}: знакомство не завершилось: {st}'
    # две базы — чтобы на страницах были переключатели баз
    await pg.evaluate("(() => { const u = App.user; Packs.all().slice(0, 2).forEach(p => Packs.setActive(u, p.id, true)); App.save(); })()")
    task = await pg.evaluate("(App.trainerTasks().find(t => t.hint) || {}).id")
    lesson = await pg.evaluate("""(() => { for (const x of App.allLessons()) { const k = x.l.steps.findIndex(s => s.t === 'example'); if (k >= 0) return App.lessonHref(x.m, x.i, k); } return null; })()""")
    module = await pg.evaluate("(() => { const m = App.modules().find(m => m.homework && m.homework.length); return m ? App.modHref(m) : null; })()")
    pages = [('intro', '#/home'), ('module', module), ('lesson', lesson), ('task', '#/t/' + task), ('trainer', '#/trainer'), ('sandbox', '#/sandbox'),
             ('schema', '#/schema'), ('packs', '#/packs'), ('profile', '#/profile'), ('cheat', '#/cheat'), ('ach', '#/ach')]
    total = 0
    for tid, href in pages:
        assert href, f'{tag}: для экскурсии «{tid}» не нашлось страницы'
        await pg.goto(url + href); await pg.wait_for_timeout(700)
        if tid in ('task', 'sandbox'):   # результат запроса — тоже шаг экскурсии
            if tid == 'task': await pg.locator('textarea.ed-ta').first.fill('SELECT TOP (5) * FROM Clients;')
            await pg.locator('[data-guide="run"]').first.click(); await pg.wait_for_timeout(400)
        assert await pg.evaluate("(Guide.pageTour() || {}).id") == tid, f'{tag}: странице {href} назначена не та экскурсия'
        miss = await pg.evaluate(f"Guide.missing('{tid}')")
        assert not miss, f'{tag}: экскурсия «{tid}» ({href}) не находит элементы: {miss}'
        if tid in ('task', 'sandbox'):
            miss = await pg.evaluate("Guide.missing('grid')")
            assert not miss, f'{tag}: экскурсия «grid» на странице {href} не находит элементы: {miss}'
        ok = await pg.evaluate(f"Guide.start('{tid}')")
        k = await pg.evaluate(f"Guide.usable('{tid}').length")
        assert ok and k >= 1, f'{tag}: экскурсия «{tid}» не запустилась'
        for i in range(k):
            geo = await pg.evaluate("""(() => { const p = document.querySelector('.guide-pop').getBoundingClientRect(), h = document.querySelector('.guide-hole'), r = h.getBoundingClientRect();
              return { pop: p.left >= 0 && p.top >= 0 && p.right <= innerWidth + 1 && p.bottom <= innerHeight + 1, hole: h.style.display === 'none' || (r.bottom > 0 && r.top < innerHeight && r.width > 6 && r.height > 6) }; })()""")
            assert geo['pop'] and geo['hole'], f'{tag}: «{tid}», шаг {i + 1}: пояснение или подсветка вне экрана: {geo}'
            await pg.keyboard.press('ArrowRight'); await pg.wait_for_timeout(90)
        assert await pg.evaluate('Guide.active()') is None, f'{tag}: экскурсия «{tid}» не закрылась после последнего шага'
        total += k
    # меню «?», метки-подсказки, страница «О курсе»
    await pg.goto(url + '#/trainer'); await pg.wait_for_timeout(600)
    await pg.evaluate('Guide.menu()'); await pg.wait_for_timeout(300)
    assert await pg.locator('.modal .guide-menu .menu-item').count() >= 4, f'{tag}: в меню «Помощь» не хватает пунктов'
    await pg.locator('.modal .guide-menu .menu-item').nth(1).click(); await pg.wait_for_timeout(400)
    marks = await pg.locator('.guide-mark').count()
    assert marks >= 3, f'{tag}: метки-подсказки не появились ({marks})'
    await pg.locator('.guide-mark').nth(1).click(); await pg.wait_for_timeout(300)
    assert await pg.evaluate('Guide.active()') == 'trainer' and await pg.locator('.guide-mark').count() == 0, f'{tag}: нажатие на метку не открыло пояснение'
    await pg.keyboard.press('Escape')
    await pg.goto(url + '#/help'); await pg.wait_for_timeout(500)
    rows = await pg.locator('.help-row').count(); tours = await pg.evaluate('Guide.tours.length')
    assert rows >= tours and await pg.locator('.help-faq details').count() >= 5, f'{tag}: страница «О курсе» неполная ({rows} строк)'
    await pg.locator('button[data-tour="grid"]').click(); await pg.wait_for_timeout(1300)
    assert await pg.evaluate("[location.hash.indexOf('#/sandbox') === 0, Guide.active()]") == [True, 'grid'], f'{tag}: экскурсия по таблице не открылась со страницы «О курсе»'
    await pg.keyboard.press('Escape')
    over = await pg.evaluate('document.documentElement.scrollWidth - innerWidth')
    assert over <= 0, f'{tag}: горизонтальная прокрутка ({over}px)'
    print(f'  {tag}: знакомство — {n} шагов; экскурсий по страницам {len(pages)}, шагов пройдено {total}; меню «?», метки и «О курсе» работают')
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
            await guide(browser, ROOT.as_uri() + '/index.html', 'подсказки, компьютер', errors, False)
            await guide(browser, ROOT.as_uri() + '/index.html', 'подсказки, телефон', errors, True)
            await browser.close()
    finally:
        srv.terminate()
    if errors:
        print('Ошибки в консоли браузера:'); [print('  ' + e) for e in errors]; sys.exit(1)
    print('Интерфейс в порядке.')

asyncio.run(main())
