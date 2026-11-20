#!/usr/bin/env python3
"""Footfall Boost sample-site generator.
usage: build.py sites/<slug>.json [--check] [--push]
"""
import json,sys,os,re,hashlib,subprocess,urllib.parse
from pathlib import Path
from jinja2 import Environment,FileSystemLoader,select_autoescape
ROOT=Path(__file__).resolve().parent.parent
GEN=ROOT/'gen'
BASE='https://footfallboost.com'
ORDERS=[
 ['menu','occasions','builder','gallery','steps','reviews','about','visit','faq','end'],
 ['occasions','menu','gallery','builder','reviews','about','steps','faq','visit','end'],
 ['menu','gallery','occasions','reviews','builder','about','steps','visit','faq','end'],
]
DEFAULTS=dict(
 cta1='Plan my order',cta2='See the menu',menu_title="What we bake",menu_lead="Everything is made fresh to order.",
 occ_title="Cakes for every celebration",occ_lead="Tell us the occasion and we will take care of the rest.",
 order_title="Plan your order",order_lead="Fill this in and it goes straight to WhatsApp, ready to send.",
 order_note="This is a draft. We confirm the final details with you on chat.",send_label="Send on WhatsApp",
 gal_title="Recent bakes",gal_lead="A look at what comes out of the kitchen.",
 rev_title="What customers say",rev_lead="Kind words from people who ordered.",
 about_title="Made with care",visit_lead="Order by chat, pick up or get it delivered nearby.",
 end_title="Ready to order?",end_text="Send us the date and the idea. We will reply with what is possible.",
 sizes=["Bento or small","Half kg","1 kg","1.5 kg","2 kg or more"],
 flavours=["Chocolate","Vanilla","Butterscotch","Red velvet","Fruit"],
 steps=[{"title":"Tell us the idea","desc":"Occasion, theme and date."},{"title":"Pick flavour and size","desc":"We suggest what works best."},{"title":"We confirm details","desc":"Design, delivery slot and advance."},{"title":"Baked fresh for you","desc":"Pickup or delivery on the day."}],
 faqs=[{"q":"How early should I order?","a":"2 to 3 days early is ideal. Message us for urgent dates."},{"q":"Can I customize the design?","a":"Yes. Share a picture or theme and we will match it as closely as possible."},{"q":"Do you deliver?","a":"We deliver nearby. Tell us your area when you order."}],
 hours=[["Mon","10 am – 8 pm"],["Tue","10 am – 8 pm"],["Wed","10 am – 8 pm"],["Thu","10 am – 8 pm"],["Fri","10 am – 8 pm"],["Sat","10 am – 8 pm"],["Sun","10 am – 8 pm"]],
 hero='stack',theme='sunny',
)
def uns(i,w=900): return f"https://images.unsplash.com/photo-{i}?auto=format&fit=crop&w={w}&q=70"
def img(slug,x):
    if x.startswith('http'): return x
    if re.fullmatch(r'[0-9]{10}-[0-9a-f]{12}|[0-9]{10,}-[0-9a-f-]+',x): return uns(x)
    return f"/s/{slug}/img/{x}"
def main():
    a=[x for x in sys.argv[1:] if not x.startswith('--')]
    cfg=json.loads(Path(a[0]).read_text())
    c={**DEFAULTS,**cfg}
    slug=c['slug']
    themes=json.loads((GEN/'themes.json').read_text())
    t=themes[c['theme']]
    imgs=[img(slug,x) for x in c['images']]
    og=c.get('og_image') or imgs[0]
    if og.startswith('/'): og=BASE+og
    wa=re.sub(r'\D','',c.get('wa','') or '')
    ig=c.get('ig','')
    ig_url=f"https://www.instagram.com/{ig}/"
    order_link=f"https://wa.me/{wa}" if wa else f"https://ig.me/m/{ig}"
    h=int(hashlib.md5(slug.encode()).hexdigest(),16)
    order=c.get('order') or ORDERS[h%3]
    about=c.get('about',[]); about=[about] if isinstance(about,str) else about
    title=f"{c['name']} · {c['title_tail']}" if c.get('title_tail') else c['name']
    ctx=dict(c,t=t,imgs=imgs,og_image=og,wa=wa,ig=ig,ig_url=ig_url,order_link=order_link,order=order,about=about,title=title,
        desc=c.get('desc') or c.get('sub',''),tags=c.get('tags',[]),
        live_text=urllib.parse.quote(f"Hi Abhay, I saw the sample website for {c['name']}"),
        menu=c.get('menu',[]),occasions=c.get('occasions',[]),reviews=c.get('reviews',[]),address=c.get('address',''))
    env=Environment(loader=FileSystemLoader(GEN/'templates'),autoescape=select_autoescape(['j2','html']))
    out=env.get_template(f"{c.get('category','bakery')}.html.j2").render(**ctx)
    d=ROOT/'s'/slug; d.mkdir(parents=True,exist_ok=True)
    (d/'index.html').write_text(out)
    print('built',d/'index.html',len(out),'bytes | theme',c['theme'],'hero',c['hero'],'order',h%3)
    if '--check' in sys.argv or '--push' in sys.argv:
        sys.path.insert(0,str(GEN)); import audit
        bad=audit.run(slug)
        print('mobile audit:','CLEAN' if not bad else bad)
        if bad and '--push' in sys.argv: sys.exit('fix audit issues before push')
    if '--push' in sys.argv:
        r=lambda *x:subprocess.run(x,cwd=ROOT,check=True)
        r('git','add','s/'+slug,'gen')
        subprocess.run(['git','commit','-q','-m',f"Add sample site: {c['name']}\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_01LTWcP5BKDAuoPy6f3ymbkm"],cwd=ROOT)
        r('git','push','-q','origin','HEAD:main')
        print('LINK',f"{BASE}/v/{slug}")
main()
