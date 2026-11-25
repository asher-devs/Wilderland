// Renders a generated world to PNG for eyeballing terrain: node tools/preview.js [seed] [size]
const zlib=require('zlib'),fs=require('fs');const {generate}=require('../server/worldgen.js');const {C,T}=require('../public/js/defs.js');
const seed=+process.argv[2]||12345;const [W,H]=C.SIZES[process.argv[3]||'medium'];
const t0=Date.now();const w=generate(seed,W,H);console.log('gen ms',Date.now()-t0,W,H);
const col={0:[120,190,255],1:[70,160,50],2:[120,80,40],3:[110,110,115],4:[100,65,30],5:[230,210,140],6:[240,245,250],7:[200,110,60],8:[200,170,150],9:[250,210,60],10:[120,220,255],11:[40,120,40],12:[200,170,110],13:[170,220,245],14:[40,140,60],15:[40,90,200],16:[170,120,60],17:[150,100,50],18:[90,90,90],19:[220,160,40],20:[255,200,80],21:[60,200,60],22:[20,20,20],23:[50,150,50],28:[150,150,150],29:[90,200,255],30:[90,80,40],31:[120,160,60],32:[70,72,86],33:[20,90,50],34:[110,130,50],35:[150,190,60]};
const raw=Buffer.alloc((W*3+1)*H);const cnt={};
for(let y=0;y<H;y++){raw[y*(W*3+1)]=0;for(let x=0;x<W;x++){const v=w.tiles[y*W+x];cnt[v]=(cnt[v]||0)+1;let c=col[v];if(v===0&&y>w.surf[x])c=[25,22,30];const o=y*(W*3+1)+1+x*3;raw[o]=c[0];raw[o+1]=c[1];raw[o+2]=c[2];}}
function crc(b){let c,crc=~0;for(let n=0;n<b.length;n++){c=(crc^b[n])&255;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;crc=(crc>>>8)^c;}return ~crc>>>0;}
function chunk(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(W,0);ihdr.writeUInt32BE(H,4);ihdr[8]=8;ihdr[9]=2;
fs.writeFileSync('/tmp/world.png',Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
const air=cnt[0]-W*30;console.log(Object.entries(cnt).map(([k,v])=>k+':'+v).join(' '));console.log('chests',Object.keys(w.chests).length,'spawn',w.spawn);
