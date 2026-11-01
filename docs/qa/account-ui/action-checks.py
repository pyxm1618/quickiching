from playwright.sync_api import sync_playwright
from pathlib import Path
import json
root=Path('scratch/account-qa'); fixture=json.loads((root/'session.json').read_text())
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless=True)
 context=browser.new_context(viewport={'width':1536,'height':1024},bypass_csp=True)
 for raw in fixture['cookies']:
  name,value=raw.split(';')[0].split('=',1)
  if 'session_token' in name:context.add_cookies([{'name':name,'value':value,'url':'http://localhost:3049','httpOnly':True,'sameSite':'Lax'}])
 # Positive target verification: only the account created by the isolated seed.
 identity=context.request.get('http://localhost:3049/api/user/me').json()['user']
 assert identity['id']==fixture['userId'] and identity['email']=='account-fixture@example.com'
 ledger={'total':1,'approved':1,'deferred':0,'rejected':0,'unknown':0,'target':'isolated account-fixture@example.com only'}
 page=context.new_page();page.goto('http://localhost:3049/my-readings');page.locator('[data-user-nav-menu-button]:visible').click();page.get_by_role('menuitem',name='My Account',exact=True).click();page.get_by_text('account-fixture@example.com',exact=True).wait_for()
 page.get_by_role('button',name='Request Refund',exact=True).first.click();page.get_by_label('Reason',exact=True).fill('Isolated fixture request: failure path only.')
 with page.expect_response(lambda response:'/api/refunds' in response.url and response.request.method=='POST') as refund:
  page.get_by_role('button',name='Submit for Manual Review').click()
 assert refund.value.status==404 # Checkout deliberately disabled in this isolated dev server.
 page.get_by_role('alert').filter(has_text='Refund request could not be recorded').wait_for()
 page.get_by_role('button',name='Close',exact=True).click();page.locator('[data-user-nav-menu-button]:visible').click();page.get_by_role('menuitem',name='Settings',exact=True).click();page.get_by_role('button',name='Delete Account',exact=True).click();page.get_by_label('Type DELETE to confirm',exact=True).fill('DELETE')
 with page.expect_response(lambda response:'/api/account/delete' in response.url and response.request.method=='POST') as deleted:
  page.get_by_role('button',name='Permanently Delete Account').click()
 assert deleted.value.status==200
 page.wait_for_url('http://localhost:3049/')
 assert context.request.get('http://localhost:3049/api/user/me').json()=={'user':None}
 ledger['executed']=1
 (root/'actions-results.json').write_text(json.dumps({'fixture_only':True,'refund_failure_status':refund.value.status,'refund_success_not_tested_in_browser':True,'delete_actual_endpoint_status':deleted.value.status,'session_after_delete':None,'target_ledger':ledger},indent=2)+'\n')
 print('PASS: real local refund failure feedback, DELETE-gated real local deletion, session invalidated; one isolated fixture only.')
 browser.close()
