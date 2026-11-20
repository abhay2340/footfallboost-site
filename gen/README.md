# Sample site generator

New business = one JSON in `gen/sites/` (copy `_example.json`), then:

    python3 gen/build.py gen/sites/<slug>.json --check   # build + 360/390px mobile audit
    python3 gen/build.py gen/sites/<slug>.json --push    # build, audit, commit, push -> prints /v/<slug> link

Design: `style` = premium | retro | cute | minimal | aggressive | organic | pop | elegant.
Each style has default fonts, corners, borders, shadows, button shape and palette. Override any of it:
`palette` (noir retro pastel mono blaze sage sunny cherry lavender cocoa mint rose), `colors` {p,a,bg,...},
`fonts` {"h","b"} from gen/fonts.json, `hero` (stack split banner centered), `tweaks` {r,bd,sh,btnr,htt,...}.
Features: all optional via `"features":{"tools":false,"insta":false,"dock":false,"announce":false,...}`.
Sections: trust ticker menu occasions moods builder gifting gallery steps festivals reviews about tools areas insta visit faq end.
A section also drops out when its data is missing (e.g. no `moods`, no `hampers`). Menu items can have `tags` (adds a diet filter).
Section order auto-varies by slug; override with `"order":[...]`.
Images: file names in `s/<slug>/img/`, full URLs, or Unsplash ids (`1545696563-af8f6ec2295a`).
Set `wa` to the business WhatsApp (digits) or leave "" to use Instagram DM (`ig`).
Always includes: OG tags, noindex, Umami, Make-it-live banner (+91 9335694034), no prices, no email.
Templates live in `gen/templates/` (bakery now; add cafe, gym next).
