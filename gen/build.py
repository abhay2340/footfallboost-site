#!/usr/bin/env python3
"""Footfall Boost sample-site generator.
usage: build.py sites/<slug>.json [--check] [--push]
"""
import json,sys,re,hashlib,subprocess,urllib.parse
from pathlib import Path
from jinja2 import Environment,FileSystemLoader,select_autoescape
ROOT=Path(__file__).resolve().parent.parent
GEN=ROOT/'gen'
BASE='https://footfallboost.com'
ORDERS=[
 ['trust','ticker','menu','occasions','moods','builder','gifting','gallery','steps','festivals','reviews','about','tools','areas','insta','visit','faq','end'],
 ['ticker','occasions','menu','gallery','trust','builder','moods','reviews','gifting','about','steps','festivals','tools','faq','areas','visit','insta','end'],
 ['menu','trust','gallery','occasions','reviews','ticker','builder','moods','about','gifting','festivals','steps','insta','tools','areas','faq','visit','end'],
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
 hours=[],
 style='cute',lead_days=2,dock=True,features={},
 mood_title='Not sure what to order?',mood_lead='Pick a mood and we will suggest something.',
 gift_title='Gifting and hampers',gift_lead='Boxes and hampers made for gifting.',
 fest_title='Festive and special dates',fest_lead='Order early for these busy days.',areas_lead='Tell us your area and we will confirm delivery.',
)
LB=dict(menu='Menu',order='Order',order_now='Order now',order_this='Order this',
 tools_lead='Check if your date works, or let us remind you before the next celebration.',date_q='Pick the day you need the order.',date='Date you need it',
 areas='Where we deliver',insta_lead='Fresh bakes and behind the scenes at',f_occ='Occasion',f_item='What do you want',f_size='Size or quantity',f_chip='Flavour',
 area_ph='Where to deliver',note='Message on the cake or notes',note_ph='Name, age, theme, allergies',sum='Your order',
 steps='How ordering works',steps_lead='Simple and clear, from the first message to delivery.',rows=['Occasion','For','Size','Flavour','Date'],msg='I would like to order.')
def uns(i,w=900): return f"https://images.unsplash.com/photo-{i}?auto=format&fit=crop&w={w}&q=70"
def img(slug,x):
    if x.startswith('http'): return x
    if re.fullmatch(r'[0-9]{10,}-[0-9a-f-]+',x): return uns(x)
    return f"/s/{slug}/img/{x}"
def build(cfg):
    c={**DEFAULTS,**cfg}
    if not re.sub(r'\D','',c.get('wa','') or ''):
        c.setdefault('order_lead','') ; c['order_lead']=cfg.get('order_lead') or 'Fill this in, copy it, and send it to us on Instagram.'; c['send_label']=cfg.get('send_label') or 'Copy and open Instagram'
    slug=c['slug']
    styles=json.loads((GEN/'styles.json').read_text()); pals=json.loads((GEN/'palettes.json').read_text()); fonts=json.loads((GEN/'fonts.json').read_text())
    st={**styles[c['style']],**c.get('tweaks',{})}
    t={**pals[c.get('palette') or st['pal']],**c.get('colors',{})}
    fo=c.get('fonts') or {}
    hf=fo.get('h') or st['h']; bf=fo.get('b') or st['b']
    hero=c.get('hero') or st['hero']
    fam='&'.join('family='+fonts[f] for f in dict.fromkeys([hf,bf]))
    font_link=f'<link href="https://fonts.googleapis.com/css2?{fam}&display=swap" rel="stylesheet">'
    imgs=[img(slug,x) for x in c['images']]
    og=c.get('og_image') or imgs[0]
    if og.startswith('/'): og=BASE+og
    wa=re.sub(r'\D','',c.get('wa','') or '')
    ig=c.get('ig','')
    ig_url=f"https://www.instagram.com/{ig}/"
    order_link=f"https://wa.me/{wa}" if wa else f"https://ig.me/m/{ig}"
    h=int(hashlib.md5(slug.encode()).hexdigest(),16)
    menu=c.get('menu',[])
    diet=sorted({tg for ca in menu for it in ca['items'] for tg in it.get('tags',[])})
    hampers=[dict(g,img_url=img(slug,g['img']) if g.get('img') else '') for g in c.get('hampers',[])]
    ticker=c.get('ticker') or ([ca['cat'] for ca in menu]+[c['name']])
    about=c.get('about',[]); about=[about] if isinstance(about,str) else about
    data=dict(trust=bool(c.get('stats')),ticker=bool(ticker),menu=bool(menu),occasions=bool(c.get('occasions')),moods=bool(c.get('moods')),gifting=bool(hampers),gallery=len(imgs)>3,steps=bool(c['steps']),festivals=bool(c.get('festivals')),reviews=bool(c.get('reviews')),about=bool(about),areas=bool(c.get('areas')),insta=bool(ig),faq=bool(c['faqs']),builder=True,tools=True,visit=True,end=True)
    feats=c.get('features',{})
    order=[k for k in (c.get('order') or ORDERS[h%3]) if data.get(k) and feats.get(k,True)]
    title=f"{c['name']} · {c['title_tail']}" if c.get('title_tail') else c['name']
    ctx=dict(c,t=t,st=st,hf=hf,bf=bf,font_link=font_link,hero=hero,imgs=imgs,og_image=og,wa=wa,ig=ig,ig_url=ig_url,order_link=order_link,order=order,about=about,title=title,
        desc=c.get('desc') or c.get('sub',''),tags=c.get('tags',[]),diet_tags=diet,hampers=hampers,ticker=ticker,stats=c.get('stats',[]),moods=c.get('moods',[]),festivals=c.get('festivals',[]),areas=c.get('areas',[]),
        phone=re.sub(r'[^\d+]','',c.get('phone','') or ''),announce=c.get('announce','') if feats.get('announce',True) else '',dock=bool(c['dock']) and feats.get('dock',True),
        live_text=urllib.parse.quote(f"Hi Abhay, I saw your {c.get('kind','business')} demo website ({c['name']}) and I'd like one for my business." if c.get('demo') else f"Hi Abhay, I saw the sample website for {c['name']}"),
        lb={**LB,**c.get('labels',{})},demo=bool(c.get('demo')),
        menu=menu,occasions=c.get('occasions',[]),reviews=c.get('reviews',[]),address=c.get('address',''))
    env=Environment(loader=FileSystemLoader(GEN/'templates'),autoescape=select_autoescape(['j2','html']))
    out=env.get_template(f"{c.get('category','bakery')}.html.j2").render(**ctx)
    d=ROOT/'s'/slug; d.mkdir(parents=True,exist_ok=True)
    (d/'index.html').write_text(out)
    print('built',slug,len(out),'bytes | style',c['style'],'| palette',c.get('palette') or st['pal'],'| hero',hero,'|',hf,'+',bf,'\n  sections:',' '.join(order))
    return slug,c['name']
def load(paths):
    out=[]
    for p in paths:
        p=Path(p)
        files=sorted(p.glob('*.json')) if p.is_dir() else [p]
        for f in files:
            if f.name.startswith('_'): continue
            d=json.loads(f.read_text())
            out+= d if isinstance(d,list) else [d]
    return out
def main():
    paths=[x for x in sys.argv[1:] if not x.startswith('--')]
    cfgs=load(paths)
    if not cfgs: sys.exit('no configs found')
    done=[];failed=[]
    for cfg in cfgs:
        try: done.append(build(cfg))
        except Exception as e: failed.append((cfg.get('slug','?'),repr(e)))
    print(f'\nbuilt {len(done)} / {len(cfgs)}')
    for s,e in failed: print('  FAILED',s,e)
    if ('--check' in sys.argv or '--push' in sys.argv) and done:
        sys.path.insert(0,str(GEN)); import audit
        res=audit.run_many([s for s,_ in done])
        clean=[s for s,_ in done if not res.get(s)]
        for s,_ in done: print('  ',s,'CLEAN' if not res.get(s) else res[s])
    else: clean=[s for s,_ in done]
    if '--push' in sys.argv:
        ok=[(s,n) for s,n in done if s in clean]
        if not ok: sys.exit('nothing clean to push')
        r=lambda *x:subprocess.run(x,cwd=ROOT,check=True)
        for s,_ in ok: r('git','add','s/'+s)
        r('git','add','gen')
        names=', '.join(n for _,n in ok)
        subprocess.run(['git','commit','-q','-m',f"Add {len(ok)} sample sites: {names}\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_01LTWcP5BKDAuoPy6f3ymbkm"],cwd=ROOT)
        r('git','push','-q','origin','HEAD:main')
        print('\nPUSHED. Links (live in ~1 min):')
        camp=next((x.split('=',1)[1] for x in sys.argv if x.startswith('--campaign=')),'delhi-dm')
        src=next((x.split('=',1)[1] for x in sys.argv if x.startswith('--source=')),'instagram')
        for s,n in ok: print(f'  {n}: {BASE}/v/{s}?utm_source={src}&utm_campaign={camp}')
main()
