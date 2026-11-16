"""Быстрая проверка интерфейса в настоящем браузере (необязательно для работы курса).

Нужны: Python 3.9+, `pip install playwright` и `python -m playwright install chromium`.
    python3 tools/ui-smoke.py            # режим сайта (http) и из папки (file://)
    python3 tools/ui-smoke.py --show     # то же, с видимым окном браузера

Проверяет: стартовую страницу, хранение в браузере, вход, решение задачи тренажёра,
загрузку учебных баз из schemas/index.js, песочницу с USE, сохранение после перезагрузки
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
    xp = await pg.evaluate("App.user.xp")
    await pg.reload(); await pg.wait_for_timeout(1200)
    await pg.locator('.continue-btn').click(); await pg.wait_for_timeout(1000)
    xp2 = await pg.evaluate("App.user.xp")
    assert xp2 == xp and xp > 0, f'{tag}: прогресс не сохранился ({xp} → {xp2})'
    print(f'  {tag}: базы {", ".join(packs)}; задача засчитана; XP {xp} сохранился после перезагрузки')
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
