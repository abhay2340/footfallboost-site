# Sample site generator

New business = one JSON in `gen/sites/` (copy `_example.json`), then:

    python3 gen/build.py gen/sites/<slug>.json --check   # build + 360/390px mobile audit
    python3 gen/build.py gen/sites/<slug>.json --push    # build, audit, commit, push -> prints /v/<slug> link

Pick per site: `theme` (sunny, cherry, lavender, cocoa, mint, rose), `hero` (stack, split, banner).
Section order auto-varies by slug; override with `"order":[...]`.
Images: file names in `s/<slug>/img/`, full URLs, or Unsplash ids (`1545696563-af8f6ec2295a`).
Set `wa` to the business WhatsApp (digits) or leave "" to use Instagram DM (`ig`).
Always includes: OG tags, noindex, Umami, Make-it-live banner (+91 9335694034), no prices, no email.
Templates live in `gen/templates/` (bakery now; add cafe, gym next).
