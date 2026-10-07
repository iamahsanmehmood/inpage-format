"""Conservative reader for the controlled single-paragraph InPage100 profile.

This is research code, not a general INP reader. Unmatched profiles fail closed.
All offsets refer to the reconstructed logical stream. Property widths and
framing are verified against native excerpts; text-range ownership is inferred
for this profile only. The leading format entry has unresolved ownership.
"""
import hashlib
import struct


class UnsupportedProfile(ValueError):
    pass


STYLE_PROFILE_SHA256 = '27c6364cca7e5646a0a27131feaebd260f69ce7559731453335cfe73cb2c3d55'
WIDTHS = {0x0080:4, 0x0202:2, 0x7F00:4, 0x7F02:2, 0x7F03:2, 0x7F80:2}
NAMES = {0x0080:'base_reference', 0x0202:'urdu_font_slot', 0x7F00:'size_units',
         0x7F02:'weight', 0x7F03:'italic', 0x7F80:'alignment'}
ALIGNMENTS = {0:'left', 1:'right', 2:'center', 4:'justify'}
# Existing legacy glyph mappings, not new character-map discoveries.
# Explicit mapping avoids assuming that Urdu letters follow Unicode order.
LETTERS = {0x81:'ا',0x82:'ب',0x83:'پ',0x84:'ت',0x85:'ٹ',0x86:'ث',0x87:'ج',
    0x88:'چ',0x89:'ح',0x8A:'خ',0x8B:'د',0x8C:'ڈ',0x8D:'ذ',0x8E:'ر',0x8F:'ڑ',
    0x90:'ز',0x91:'ژ',0x92:'س',0x93:'ش',0x94:'ص',0x95:'ض',0x96:'ط',0x97:'ظ',
    0x98:'ع',0x99:'غ',0x9A:'ف',0x9B:'ق',0x9C:'ک',0x9D:'گ',0x9E:'ل',0x9F:'م',
    0xA0:'ن',0xA1:'ں',0xA2:'و',0xA3:'ء',0xA4:'ی',0xA5:'ے',0xA6:'ہ',0xA7:'ھ',0x20:' '}


def need(data, offset, length, end=None):
    end = len(data) if end is None else min(end,len(data))
    if offset<0 or length<0 or offset+length>end:
        raise UnsupportedProfile(f'truncated bounded record at stream offset {offset}')


def u16(data, offset, end=None):
    need(data,offset,2,end)
    return struct.unpack_from('<H',data,offset)[0]


def u32(data, offset, end=None):
    need(data,offset,4,end)
    return struct.unpack_from('<I',data,offset)[0]


def read_properties(data, start, end):
    need(data,start,end-start)
    result=[]
    seen=set()
    p=start
    while p<end:
        tag=u16(data,p,end)
        width=WIDTHS.get(tag)
        if width is None:
            raise UnsupportedProfile(f'unknown property width for tag {tag:04x} at {p}')
        if tag in seen:
            raise UnsupportedProfile(f'duplicate property {tag:04x} at {p}')
        seen.add(tag)
        need(data,p+2,width,end)
        value=int.from_bytes(data[p+2:p+2+width],'little')
        result.append({'tag':f'{tag:04x}', 'name':NAMES[tag], 'value':value,
                       'offset':p, 'width':width, 'raw':data[p:p+2+width].hex()})
        p+=2+width
    return result


def read_format_entry(data, start, end):
    """Read both length layers, rather than searching for property patterns."""
    need(data,start,14,end)
    span=u32(data,start,end)
    size=u32(data,start+4,end)
    blob_start=start+8
    blob_end=blob_start+size
    need(data,blob_start,size,end)
    marker=u16(data,blob_start,blob_end)
    inner=u32(data,blob_start+2,blob_end)
    if marker!=1 or size!=inner+6:
        raise UnsupportedProfile(f'unmatched format envelope at {start}')
    fields=read_properties(data,blob_start+6,blob_end)
    if not fields or fields[0]['tag']!='0080' or fields[0]['value']!=0:
        raise UnsupportedProfile(f'unsupported base reference at {start}')
    return {'offset':start, 'span_value':span, 'outer_length':size,
            'envelope_marker':marker, 'inner_length':inner,
            'properties':fields, 'raw':data[start:blob_end].hex()}, blob_end


def decode_text(raw):
    """Only the observed Urdu pairs followed by a single CR are supported."""
    if not raw or raw[-1]!=13 or len(raw)%2!=1:
        raise UnsupportedProfile('text is outside the single-paragraph Urdu profile')
    output=[]
    for p in range(0,len(raw)-1,2):
        if raw[p]!=4 or raw[p+1] not in LETTERS:
            raise UnsupportedProfile(f'unsupported glyph pair at text byte {p}')
        output.append(LETTERS[raw[p+1]])
    return ''.join(output)+'\r'


def effective_style(entry, defaults, fonts):
    style=dict(defaults)
    explicit={}
    for field in entry['properties']:
        name=field['name']
        if name!='base_reference':
            explicit[name]=field['value']
    style.update(explicit)
    slot=style['urdu_font_slot']
    if slot>=len(fonts) or not fonts[slot]['name']:
        raise UnsupportedProfile('unresolved font slot')
    if style['alignment'] not in ALIGNMENTS or style['italic'] not in (0,1):
        raise UnsupportedProfile('unverified alignment or italic value')
    if style['weight'] not in (400,700):
        raise UnsupportedProfile('unverified weight value')
    return {'font_slot':slot, 'font':fonts[slot]['name'],
            'size_units':style['size_units'], 'font_size_pt':style['size_units']/2000,
            'weight':style['weight'], 'bold':style['weight']==700,
            'italic':bool(style['italic']), 'alignment':ALIGNMENTS[style['alignment']],
            'explicit':explicit}


def read_stream(data):
    need(data,0,58)
    if data[:8]!=bytes.fromhex('0000020001000000'):
        raise UnsupportedProfile('unmatched stream header')
    directory=[{'id':u16(data,p), 'target':u32(data,p+2)} for p in range(16,58,6)]
    if [v['id'] for v in directory]!=list(range(7)):
        raise UnsupportedProfile('unmatched directory identifiers')
    targets=[v['target'] for v in directory]
    if targets!=sorted(targets) or targets[0]<58 or targets[-1]!=len(data):
        raise UnsupportedProfile('invalid directory bounds')
    if targets[0]!=targets[1] or targets[1]!=targets[2] or targets[4]!=targets[5]:
        raise UnsupportedProfile('unmatched section intervals')
    if data[targets[2]:targets[3]]!=b'InPage Arabic Document':
        raise UnsupportedProfile('unmatched document label')
    if data[targets[5]:targets[6]]!=b'\xfd\xff\xff\xff'+bytes(44)+bytes.fromhex('ffffffff'):
        raise UnsupportedProfile('unmatched trailer')
    # These defaults are inferred only for the identical native header profile.
    style_start=targets[3]+72
    size=u32(data,style_start,targets[4])
    style_end=style_start+4+size
    need(data,style_start,4+size,targets[4])
    if hashlib.sha256(data[style_start:style_end]).hexdigest()!=STYLE_PROFILE_SHA256:
        raise UnsupportedProfile('default-style profile is not verified')
    default_fields=[]
    for rel,tag,width,name in ((24,0x0202,2,'urdu_font_slot'),(120,0x7F00,4,'size_units'),
                              (130,0x7F02,2,'weight'),(134,0x7F03,2,'italic'),
                              (238,0x7F80,2,'alignment')):
        p=style_start+rel
        if u16(data,p,style_end)!=tag:
            raise UnsupportedProfile('default tag mismatch')
        default_fields.append({'name':name,'tag':f'{tag:04x}', 'value':int.from_bytes(data[p+2:p+2+width],'little'),
                               'offset':p, 'width':width})
    defaults={f['name']:f['value'] for f in default_fields}
    # Preserve physical font slots, including empty names and opaque suffixes.
    font_len_pos=style_end+124
    font_len=u32(data,font_len_pos,targets[4])
    if font_len!=324:
        raise UnsupportedProfile('font-slot profile is not verified')
    font_start=font_len_pos+4
    font_end=font_start+font_len
    need(data,font_start,font_len,targets[4])
    fonts=[]
    for slot,p in enumerate(range(font_start,font_end,54)):
        name=data[p:p+32].split(b'\0',1)[0]
        try:name=name.decode('ascii')
        except UnicodeDecodeError:raise UnsupportedProfile('non-ASCII font name profile')
        fonts.append({'slot':slot,'name':name,'offset':p,'raw_name_area':data[p:p+32].hex(),
                      'opaque_suffix':data[p+32:p+54].hex()})
    if [f['name'] for f in fonts[:2]]!=['Noori Nastaliq','Naskh']:
        raise UnsupportedProfile('unmatched baseline font slots')
    p=font_end
    if data[p:p+10]!=bytes.fromhex('010000000d0000000000'):
        raise UnsupportedProfile('unmatched text-record prefix')
    text_len=u32(data,p+10,targets[4])
    text_start=p+14
    need(data,text_start,text_len,targets[4])
    raw_text=data[text_start:text_start+text_len]
    text=decode_text(raw_text)
    p=text_start+text_len
    if data[p:p+9]!=bytes(5)+bytes.fromhex('ffffffff'):
        raise UnsupportedProfile('unmatched text/format separator')
    p+=9
    entries=[]
    for unused in range(3):
        entry,p=read_format_entry(data,p,targets[4])
        entries.append(entry)
    if data[p:p+10]!=bytes.fromhex('feffffffffffffff0000'):
        raise UnsupportedProfile('unmatched format-table terminator')
    if [e['span_value'] for e in entries]!=[1,text_len-1,1]:
        raise UnsupportedProfile('format spans outside verified profile')
    body=effective_style(entries[1],defaults,fonts)
    trailing=effective_style(entries[2],defaults,fonts)
    return {'profile':'controlled-single-paragraph-InPage100',
            'stream_sha256':hashlib.sha256(data).hexdigest(), 'directory':directory,
            'default_header':{'offset':style_start,'length':4+size,'sha256':STYLE_PROFILE_SHA256},
            'default_properties':default_fields,'fonts':fonts,
            'text':text,'text_offset':text_start,'text_byte_length':text_len,
            'text_sha256':hashlib.sha256(raw_text).hexdigest(),
            'format_entries':entries,'format_end_offset':p,
            'body':{'text':text[:-1], 'encoded_byte_range':[0,text_len-1],
                    'unicode_range':[0,len(text)-1], 'style':body,
                    'ownership_status':'inferred for this one-paragraph profile'},
            'trailing_cr':{'encoded_byte_range':[text_len-1,text_len], 'style':trailing,
                           'ownership_status':'inferred for this one-paragraph profile'},
            'unresolved':['leading format entry span=1 ownership',
                          'general inline range ownership and multiple paragraphs',
                          'default-style reference/inheritance outside identical header profile',
                          'units and semantics outside controlled corpus']}
