import subprocess,time,socket
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
JS=r'''()=>{const out=[];const vw=innerWidth;
const els=[...document.querySelectorAll('a,button,input,select,summary,label,textarea')].filter(e=>{const r=e.getBoundingClientRect();return r.width>8&&r.height>8});
for(const e of els){const cs=getComputedStyle(e);if(cs.visibility==='hidden'||cs.display==='none')continue;
 if(e.matches('input[type=radio],input[type=checkbox]'))continue;
 if(e.closest('#ffb-cta'))continue;
 e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();
 const x=Math.min(Math.max(r.left+r.width/2,1),vw-1),y=Math.min(Math.max(r.top+r.height/2,1),innerHeight-1);
 const t=document.elementFromPoint(x,y);
 if(t&&t!==e&&!e.contains(t)&&!t.contains(e)&&!t.closest('.fab,.sample,#ffb-cta')){out.push('COVERED '+(e.innerText||e.tagName).trim().split(String.fromCharCode(10)).join(' ').slice(0,30)+' by '+t.tagName+'.'+(t.className||''))}
 if(r.right>vw+1||r.left<-1)out.push('OFFSCREEN '+(e.innerText||e.tagName).trim().slice(0,30))}
if(document.documentElement.scrollWidth>vw+1)out.push('H-SCROLL '+document.documentElement.scrollWidth);
return [...new Set(out)]}'''
def run(slug,widths=(360,390)):
    s=socket.socket();s.bind(('',0));port=s.getsockname()[1];s.close()
    srv=subprocess.Popen(['python3','-m','http.server',str(port)],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
    res=[]
    try:
        with sync_playwright() as p:
            b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
            for w in widths:
                pg=b.new_page(viewport={'width':w,'height':800})
                pg.goto(f'http://localhost:{port}/s/{slug}/',wait_until='domcontentloaded');pg.add_style_tag(content='*{animation:none!important;transition:none!important;scroll-behavior:auto!important}');pg.wait_for_timeout(1200)
                res+=[f'{w}px {x}' for x in pg.evaluate(JS)]
                pg.evaluate('scrollTo(0,0)');pg.screenshot(path=f'/tmp/gen_{slug}_{w}.png')
                pg.close()
            b.close()
    finally: srv.terminate()
    return res

def run_many(slugs,widths=(360,390)):
    s=socket.socket();s.bind(('',0));port=s.getsockname()[1];s.close()
    srv=subprocess.Popen(['python3','-m','http.server',str(port)],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);time.sleep(1)
    res={}
    try:
        with sync_playwright() as p:
            b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
            for slug in slugs:
                res[slug]=[]
                for w in widths:
                    pg=b.new_page(viewport={'width':w,'height':800})
                    pg.goto(f'http://localhost:{port}/s/{slug}/',wait_until='domcontentloaded');pg.add_style_tag(content='*{animation:none!important;transition:none!important;scroll-behavior:auto!important}');pg.wait_for_timeout(1000)
                    res[slug]+=[f'{w}px {x}' for x in pg.evaluate(JS)]
                    pg.close()
            b.close()
    finally: srv.terminate()
    return res
