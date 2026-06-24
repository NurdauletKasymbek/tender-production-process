# -*- coding: utf-8 -*-
"""
SERT каталог PDF → тауарлар (фото + баға + сипаттама).
Макеттер: «жолақ» (тақырып фотоның үстінде) және «2x2 тор».
Суреттерді жол/бағанға кластерлеп, тоқендерді ұяшыққа дұрыс байлаймыз.
Нәтиже: _catalog_extract/images/* + manifest.json
"""
import fitz, re, json, os, hashlib, math, io
from collections import defaultdict
from PIL import Image

def jpeg_from_png(raw):
    """PNG байттарын → оптимизацияланған JPEG (ақ фон, макс 1000px, q82)."""
    im=Image.open(io.BytesIO(raw))
    if im.mode in ('RGBA','LA','P'):
        im=im.convert('RGBA')
        bg=Image.new('RGB', im.size, (255,255,255))
        bg.paste(im, mask=im.split()[-1]); im=bg
    else:
        im=im.convert('RGB')
    w,h=im.size; m=max(w,h)
    if m>1000:
        s=1000/m; im=im.resize((int(w*s),int(h*s)), Image.LANCZOS)
    out=io.BytesIO(); im.save(out,'JPEG',quality=82,optimize=True)
    return out.getvalue()

def extract_clean(doc, xref):
    """Ендірілген суретті SMask мөлдірлігімен бірге ақ фонға → таза JPEG.
    Көрші элемент сынықтары жоқ (e-commerce стилі)."""
    info=doc.extract_image(xref)
    base=fitz.Pixmap(doc, xref)
    if base.n - base.alpha >= 4:           # CMYK → RGB
        base=fitz.Pixmap(fitz.csRGB, base)
    sm=info.get('smask')
    if sm:
        try:
            mask=fitz.Pixmap(doc, sm)
            base=fitz.Pixmap(base, mask)   # альфа қосу
        except Exception:
            pass
    return jpeg_from_png(base.tobytes('png'))

PDF = r'C:\Users\User\Downloads\КАТАЛОГ+ПРАЙС (2).pdf'
OUT = r'C:\Projects\tender-mvp\_catalog_extract'
IMGDIR = os.path.join(OUT, 'images')
os.makedirs(IMGDIR, exist_ok=True)

PAGE_CAT = {
    3:'Парты',4:'Парты',5:'Парты',
    7:'Офисные кресла',8:'Офисные кресла',9:'Офисные кресла',10:'Офисные кресла',
    11:'Офисные кресла',12:'Офисные кресла',13:'Офисные кресла',14:'Офисные кресла',
    16:'Стулья',17:'Стулья',18:'Стулья',19:'Стулья',20:'Стулья',21:'Стулья',
    23:'Мягкая мебель',24:'Мягкая мебель',25:'Модульные диваны',
    26:'Пуфы и банкетки',27:'Пуфы и банкетки',28:'Диваны для залов ожидания',
    29:'Театральные кресла',33:'Парты для спецкабинетов',
    34:'Шкафы',35:'Шкафы',36:'Столы для учителей',37:'Компьютерные столы',
    38:'Мебель для детских садов',39:'Мебель для детских садов',40:'Мебель для детских садов',
    41:'Шкафы',42:'Стеллажи для библиотеки',43:'Стеллажи для библиотеки',
    44:'Металлические шкафы',45:'Металлические шкафы',46:'Металлические шкафы',
    47:'Кровати для общежития',
}
NOUN = {
    'Парты':'Парта','Парты для спецкабинетов':'Парта','Офисные кресла':'Кресло',
    'Стулья':'Стул','Мягкая мебель':'Диван','Модульные диваны':'Диван',
    'Пуфы и банкетки':'Пуф','Диваны для залов ожидания':'Диван','Театральные кресла':'Кресло',
    'Шкафы':'Шкаф','Столы для учителей':'Стол','Компьютерные столы':'Стол',
    'Мебель для детских садов':'Мебель','Стеллажи для библиотеки':'Стеллаж',
    'Металлические шкафы':'Шкаф','Кровати для общежития':'Кровать',
}
BOIL = ['ПРОИЗВОДСТВ','ЛИСТ','АДРЕС','TEL','@SERT','ИНДУСТР','ОҢТҮСТІК','ДЛЯ УТОЧНЕН',
        'НАЖМИТЕ','Н А Ж','МАТЕРИАЛ','РАЗМЕР','ЦВЕТ','ПО ЗАПРОСУ','DISCOUNT','OFF',
        'КАТАЛОГ','ЗАКУП','ПОРТАЛ','МАРКЕТ','НОВОЕ','ПОСТУПЛЕНИЕ','ЦЕНА','КОМПАНИЯ',
        'SERT','0525','775','КЛИЕНТА']
MAT_RE = re.compile(r'(ЭКОКОЖА|ТКАНЬ|ПЛАСТИК|МЕТАЛЛ|Л[СД][СД]П|ЛДСП|ВЕЛЮР|ОКСФОРД|ДЕРЕВО)', re.I)
SIZE_RE = re.compile(r'\d{2,4}\s*[ХXхx/]')
PRICE_RE = re.compile(r'(\d[\d\s]{2,})\s*₸')

def collapse(s): return re.sub(r'\s+',' ',s).strip()
def is_boiler(t):
    u=t.upper(); return any(b in u for b in BOIL)
def clean_spec(t):
    t=collapse(t)
    t=re.sub(r'(\d)\s+ММ', r'\1ММ', t)
    t=re.sub(r'\s*[ХхXx]\s*', 'Х', t)
    t=re.sub(r'\s*/\s*', '/', t)
    t=re.sub(r'\s+,', ',', t)
    t=t.replace('ЛСДП','ЛДСП')
    return t
def clean_model(t):
    t=collapse(re.sub(r'^MODEL\s*','',t,flags=re.I))
    t=re.sub(r'\s*([+\-])\s*', r'\1', t)   # "В -80+03" → "В-80+03"
    return t.strip()

def line_items(page):
    d=page.get_text('dict'); items=[]
    for blk in d['blocks']:
        if blk.get('type')!=0: continue
        for ln in blk['lines']:
            txt=collapse(' '.join(sp['text'] for sp in ln['spans']))
            if not txt: continue
            x0,y0,x1,y1=ln['bbox']
            items.append({'t':txt,'cx':(x0+x1)/2,'cy':(y0+y1)/2})
    return items

def heading_words(page):
    """Беттің ірі қаріпті тақырып сөздері (модельден шығару үшін)."""
    d=page.get_text('dict'); spans=[]
    for blk in d['blocks']:
        if blk.get('type')!=0: continue
        for ln in blk['lines']:
            for sp in ln['spans']:
                if sp['text'].strip(): spans.append((sp['size'],sp['text']))
    if not spans: return set()
    mx=max(s for s,_ in spans)
    words=set()
    for s,t in spans:
        if s>=mx*0.82:
            for w in re.split(r'\s+', t.upper()):
                w=w.strip()
                if len(w)>=4: words.add(w)
    return words

def looks_heading(t, hw):
    u=t.upper()
    if re.match(r'^PRODUCT', u): return True
    # ірі қаріпті тақырыппен қабысатын сөздер
    toks=[w for w in re.split(r'\s+',u) if len(w)>=4]
    if toks and all(w in hw for w in toks): return True
    # бір ұзын БАС ӘРІПТІ сөз (УЧЕНИЧЕСКАЯ, МЕТАЛЛИЧЕСКИЕ, ШКОЛЬНАЯ...)
    if re.fullmatch(r'[А-ЯЁ]{9,}', u): return True
    # екі+ сөзден тұратын толық БАС ӘРІПТІ тіркес (тақырып)
    if ' ' in t and u==t and re.fullmatch(r'[А-ЯЁ ]+', u): return True
    return False

def big_images(page):
    W,H=page.rect.width,page.rect.height; A=W*H
    res=[]; seen=set()
    for im in page.get_image_info(xrefs=True):
        b=im['bbox']; w=b[2]-b[0]; h=b[3]-b[1]; xref=im.get('xref',0)
        if w<100 or h<100: continue
        if w*h>0.5*A: continue
        if b[0]>W*0.78 and b[1]<H*0.2: continue
        key=(xref,round(b[0]),round(b[1]))
        if key in seen: continue
        seen.add(key)
        res.append({'xref':xref,'cx':(b[0]+b[2])/2,'cy':(b[1]+b[3])/2,
                    'bbox':b,'area':w*h,'h':h})
    return res

def cluster_rows(imgs, gap=90):
    s=sorted(imgs,key=lambda i:i['cy']); rows=[]; cur=[]
    last=None
    for im in s:
        if last is not None and im['cy']-last>gap:
            rows.append(cur); cur=[]
        cur.append(im); last=im['cy']
    if cur: rows.append(cur)
    for r in rows: r.sort(key=lambda i:i['cx'])
    return rows

doc=fitz.open(PDF)
products=[]; img_hashes={}; gidx=0

for pidx in range(doc.page_count):
    pno=pidx+1
    if pno not in PAGE_CAT: continue
    page=doc[pidx]; cat=PAGE_CAT[pno]; noun=NOUN.get(cat,'Изделие')
    items=line_items(page); imgs=big_images(page)
    if not imgs: continue
    hw=heading_words(page)
    rows=cluster_rows(imgs)
    cols=max(len(r) for r in rows)
    cells=[im for r in rows for im in r]   # reading order

    # тоқендерді жіктеу
    prices=[];models=[];mats=[];sizes=[];descs=[]
    for it in items:
        t=it['t']
        pm=PRICE_RE.search(t)
        if pm:
            v=int(re.sub(r'\D','',pm.group(1)))
            if 1000<=v<=100000000: prices.append({**it,'v':v})
            continue
        if it.get('_used'): continue
        if len(t)>70 and not is_boiler(t): descs.append(t); continue
        u=t.upper()
        if u.startswith('MODEL') or (not is_boiler(t) and not MAT_RE.search(t)
            and not SIZE_RE.search(t) and len(t)<=26 and re.search(r'[A-Za-zА-Яа-я]',t)
            and u not in('ЦВЕТ','ЦВЕТ:') and t.upper()!=cat.upper() and t.upper()!=noun.upper()
            and 'ММ' not in u and not looks_heading(t,hw)):
            models.append(it); continue
        if MAT_RE.search(t) and len(t)<60: mats.append(it); continue
        if SIZE_RE.search(t) and 'ММ' in u: sizes.append(it)

    def nearest_eucl(im,cands):
        best=None;bd=1e9
        for c in cands:
            d=math.hypot(im['cx']-c['cx'],im['cy']-c['cy'])
            if d<bd:bd=d;best=c
        return best
    def nearest_below(tok,cellset):
        # тоқеннің астындағы ең жақын сурет (тақырып → фото)
        best=None;bd=1e9
        for im in cellset:
            if im['cy']>tok['cy']-12:
                d=im['cy']-tok['cy']
                if d<bd:bd=d;best=im
        return best

    # әр ұяшыққа (суретке) тоқендерді тағайындау
    assign={id(im):{'price':None,'model':None,'mat':None,'size':None} for im in cells}
    if cols==1:
        # жолақ: тақырып (баға/модель) → астындағы сурет; спецификация → жақын сурет
        for p in prices:
            im=nearest_below(p,cells)
            if im and (assign[id(im)]['price'] is None): assign[id(im)]['price']=p['v']
        for m in models:
            im=nearest_below(m,cells)
            if im and assign[id(im)]['model'] is None: assign[id(im)]['model']=m['t']
        for m in mats:
            im=nearest_eucl(m,cells)
            if im and assign[id(im)]['mat'] is None: assign[id(im)]['mat']=m['t']
        for s in sizes:
            im=nearest_eucl(s,cells)
            if im and assign[id(im)]['size'] is None: assign[id(im)]['size']=s['t']
    else:
        # тор: ұяшық ықшам — ең жақын сурет жеткілікті
        for arr,key in ((prices,'price'),(models,'model'),(mats,'mat'),(sizes,'size')):
            for tok in arr:
                im=nearest_eucl(tok,cells)
                if im is None: continue
                val = tok['v'] if key=='price' else tok['t']
                if assign[id(im)][key] is None: assign[id(im)][key]=val

    for im in cells:
        a=assign[id(im)]
        h=str(im['xref'])
        if h in img_hashes: fname=img_hashes[h]
        else:
            try:
                jpg=extract_clean(doc, im['xref'])
            except Exception:
                jpg=None
            if not jpg or len(jpg)<2500: continue
            gidx+=1; fname=f'p{pno:02d}_{gidx:03d}.jpg'
            open(os.path.join(IMGDIR,fname),'wb').write(jpg)
            img_hashes[h]=fname
        model=clean_model(a['model']) if a['model'] else None
        name=f'{noun} {model}' if model else noun
        dp=[]
        if descs: dp.append(descs[0])
        if a['mat']: dp.append('Материал: '+clean_spec(a['mat']))
        if a['size']: dp.append('Размер: '+clean_spec(a['size']))
        dp.append('Цвет: по запросу клиента')
        products.append({'page':pno,'category':cat,'name':name,'model':model,
            'price':a['price'],'material':clean_spec(a['mat']) if a['mat'] else None,
            'size':clean_spec(a['size']) if a['size'] else None,
            'description':'\n'.join(dp),'image':fname})

# бірдей атауларды нөмірлеу (категория ішінде)
cnt=defaultdict(int)
for p in products: cnt[(p['category'],p['name'])]+=1
run=defaultdict(int); seq=defaultdict(int)
for p in products:
    k=(p['category'],p['name'])
    if cnt[k]>1:
        run[k]+=1; p['name']=f"{p['name']} №{run[k]}"

json.dump(products, open(os.path.join(OUT,'manifest.json'),'w',encoding='utf-8'),
          ensure_ascii=False, indent=1)
print('products:',len(products),'| images:',len(img_hashes),
      '| priced:',sum(1 for p in products if p['price']),
      '| modeled:',sum(1 for p in products if p['model']))
cc=defaultdict(int)
for p in products: cc[p['category']]+=1
for k,v in sorted(cc.items()): print(f'  {v:3d}  {k}')
