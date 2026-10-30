from playwright.sync_api import sync_playwright
from pathlib import Path
from urllib.parse import unquote
import json
root=Path('scratch/account-qa')
fixture=json.loads((root/'session.json').read_text())
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless=True)
 context=browser.new_context(viewport={'width':1536,'height':1024},device_scale_factor=1,bypass_csp=True)
 cookies=[]
 for raw in fixture['cookies']:
  pair=raw.split(';')[0]; name,value=pair.split('=',1)
  if 'session_token' in name: cookies.append({'name':name,'value':value,'url':'http://localhost:3049','httpOnly':True,'sameSite':'Lax'})
 context.add_cookies(cookies)
 page=context.new_page(); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://localhost:3049/my-readings');page.wait_for_load_state('networkidle');page.evaluate('document.fonts.ready')
 assert page.locator('.qic-my-reading').count()==16
 assert page.locator('.qic-my-reading').first.inner_text().startswith('Should I change jobs this year?')
 assert page.get_by_text('Untitled Reading',exact=True).count()==1
 # Drag visible scrollbar and verify title stays fixed.
 page.wait_for_function('Number(document.querySelector(".qic-my-readings-region [role=scrollbar]").getAttribute("aria-valuemax"))>0')
 title_before=page.locator('.qic-account-heading').bounding_box()
 rail=page.locator('.qic-my-readings-region .qic-account-scroll-rail').bounding_box()
 thumb=page.locator('.qic-my-readings-region .qic-account-scroll-thumb').bounding_box()
 page.mouse.move(thumb['x']+5,thumb['y']+8);page.mouse.down();page.mouse.move(rail['x']+5,rail['y']+rail['height']-8,steps=12);page.mouse.up()
 assert page.locator('.qic-my-readings-scroll').evaluate('(e)=>e.scrollTop')>0
 assert page.locator('.qic-account-heading').bounding_box()==title_before
 page.locator('.qic-my-readings-scroll').evaluate('(e)=>e.scrollTop=0');page.wait_for_timeout(100)
 page.screenshot(path=str(root/'my-readings-desktop.png'))
 page.locator('[data-user-nav-menu-button]:visible').first.click()
 menu=page.locator('[data-user-nav-dropdown]'); assert menu.get_by_role('menuitem').all_text_contents()==['My Readings','My Account','Settings']
 page.screenshot(path=str(root/'user-menu-desktop.png'))
 menu.get_by_role('menuitem',name='My Account',exact=True).click();page.get_by_text('account-fixture@example.com',exact=True).wait_for();page.wait_for_timeout(500)
 assert not menu.is_visible(); assert page.locator('dialog[open]').count()==1
 assert page.url.endswith('/my-readings')
 assert page.locator('body').evaluate('(e)=>getComputedStyle(e).overflow')=='hidden'
 account_box=page.locator('dialog').bounding_box(); page.screenshot(path=str(root/'account-desktop.png'))
 before=page.locator('.qic-account-identity').bounding_box()
 page.locator('.qic-account-purchase-scroll').evaluate('(e)=>e.scrollTop=e.scrollHeight')
 assert page.locator('.qic-account-identity').bounding_box()==before
 page.locator('.qic-account-purchase-scroll').evaluate('(e)=>e.scrollTop=0')
 page.get_by_role('button',name='Request Refund',exact=True).first.click()
 assert page.get_by_role('button',name='Submit for Manual Review').is_disabled()
 page.screenshot(path=str(root/'refund-disabled-desktop.png'))
 assert page.locator('dialog').bounding_box()==account_box
 page.get_by_label('Reason',exact=True).fill('  '); assert page.get_by_role('button',name='Submit for Manual Review').is_disabled()
 page.get_by_label('Reason',exact=True).fill('Isolated UI test; no provider refund requested.')
 assert page.get_by_role('button',name='Submit for Manual Review').is_enabled()
 page.get_by_role('button',name='← Back to My Account').click()
 page.get_by_role('button',name='Close',exact=True).click()
 assert page.url.endswith('/my-readings');assert page.locator('dialog[open]').count()==0
 page.locator('[data-user-nav-menu-button]:visible').first.click();page.get_by_role('menuitem',name='Settings',exact=True).click()
 page.get_by_role('heading',name='Settings',exact=True).wait_for();settings_box=page.locator('dialog').bounding_box()
 page.screenshot(path=str(root/'settings-desktop.png'))
 # All tab stops remain in the single native dialog.
 for _ in range(12):
  page.keyboard.press('Tab');assert page.evaluate('document.querySelector("dialog").contains(document.activeElement)')
 page.get_by_role('button',name='Delete Account',exact=True).click()
 assert page.locator('dialog[open]').count()==1
 assert page.locator('dialog').bounding_box()==settings_box
 confirm=page.get_by_label('Type DELETE to confirm',exact=True);delete=page.get_by_role('button',name='Permanently Delete Account',exact=True)
 for invalid in ['', 'delete', 'DELETE ', ' DELETE']:
  confirm.fill(invalid);assert delete.is_disabled()
 confirm.fill('DELETE');assert delete.is_enabled();confirm.fill('')
 assert page.get_by_role('button',name='Permanently Delete Account').bounding_box()['y']+page.get_by_role('button',name='Permanently Delete Account').bounding_box()['height'] < settings_box['y']+settings_box['height']
 page.screenshot(path=str(root/'delete-disabled-desktop.png'))
 page.get_by_role('button',name='← Back to Settings').click();assert page.get_by_role('button',name='Sign Out',exact=True).count()==1
 page.keyboard.press('Escape');assert page.locator('dialog[open]').count()==0
 # Mobile drawer opens Settings after closing, preserving modal body lock.
 page.set_viewport_size({'width':390,'height':844})
 page.locator('button[id^="drawer-trig-"]').click()
 page.locator('.qic-account-mobile-menu').get_by_role('button',name='Settings',exact=True).click()
 page.get_by_role('heading',name='Settings',exact=True).wait_for()
 assert page.locator('body').evaluate('(e)=>getComputedStyle(e).overflow')=='hidden'
 page.get_by_role('button',name='Delete Account',exact=True).click()
 page.get_by_label('Type DELETE to confirm',exact=True).fill('DELETE')
 assert page.get_by_role('button',name='Permanently Delete Account').is_enabled()
 page.screenshot(path=str(root/'settings-delete-mobile.png'))
 page.get_by_role('button',name='Close',exact=True).click()
 assert page.locator('body').evaluate('(e)=>getComputedStyle(e).overflow')!='hidden'
 page.set_viewport_size({'width':1536,'height':1024})
 # Existing account URL must open the same modal, with current home behind it.
 page.goto('http://localhost:3049/account');page.get_by_text('account-fixture@example.com',exact=True).wait_for();assert page.url=='http://localhost:3049/'
 page.get_by_role('button',name='Close',exact=True).click()
 # Result navigation uses the existing real loader route.
 page.goto('http://localhost:3049/my-readings');page.locator('.qic-my-reading').first.click();page.wait_for_load_state('networkidle')
 assert '/readings/three-coin/result?session=' in page.url
 assert page.locator('body').inner_text().find('Should I change jobs this year?')>=0
 # Mobile accessibility uses existing responsive base, no new mobile design.
 page.set_viewport_size({'width':390,'height':844});page.goto('http://localhost:3049/account');page.get_by_text('account-fixture@example.com',exact=True).wait_for()
 assert page.locator('dialog').bounding_box()['width']<=390
 assert page.locator('body').evaluate('(e)=>e.scrollWidth')<=390
 page.screenshot(path=str(root/'account-mobile.png'));page.get_by_role('button',name='Close',exact=True).click()
 (root/'browser-results.json').write_text(json.dumps({'fixture_only':True,'checks':'scrollbar drag, native dialog keyboard focus loop, mobile drawer handoff, menu, 16 valid readings, untitled fallback, internal scroll, same-size subviews, exact DELETE gate, trimmed reason gate, context restore, legacy route, real result link, mobile fit','page_errors':errors},indent=2))
 print(json.dumps({'page_errors':errors,'result':'PASS','screenshots':9}));browser.close()
