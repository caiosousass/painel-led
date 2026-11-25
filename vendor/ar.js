/* Projetech Calculator — AR (realidade aumentada)
   Monta em 3D, em metros, o que a Pré-visualização mostra (painel com a imagem de
   teste, palco e pessoa) e empacota em USDZ: o formato que o iPhone abre direto no
   AR (AR Quick Look), em tamanho real, apoiado no chão.
   Sem biblioteca: as peças são caixas, planos, cilindros e esferas, gravadas já na
   posição final. O arquivo segue o mesmo formato do exportador do three.js, que foi
   o que abriu no iPhone nos testes (zip sem compressão, dados alinhados a 64 bytes,
   materiais UsdPreviewSurface).

   Uso:  ProjetechAR.usdz(cena) → Promise<Blob>      (cena: ver montaCena)
         ProjetechAR.zip([{nome, dados:Uint8Array}]) → Uint8Array
         ProjetechAR.abreNoIphone(blob, nome) → true se abriu o AR Quick Look */
(function(){
'use strict';

/* ---------- malhas: {pts, nrm, st|null, idx} em coordenadas finais ---------- */
function malha(){ return {pts:[], nrm:[], st:[], idx:[], temSt:false}; }
function quad(m,a,b,c,d,n,uv){            // a,b,c,d em sentido anti-horário visto de fora
  const i=m.pts.length; m.pts.push(a,b,c,d); m.nrm.push(n,n,n,n);
  m.st.push(...(uv||[[0,0],[1,0],[1,1],[0,1]])); m.idx.push(i,i+1,i+2, i,i+2,i+3);
}
// caixa alinhada aos eixos, de (x0,y0,z0) a (x1,y1,z1)
function caixa(m,x0,y0,z0,x1,y1,z1){
  quad(m,[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[0,0,1]);     // frente (+z)
  quad(m,[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[0,0,-1]);    // trás
  quad(m,[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[1,0,0]);     // direita
  quad(m,[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[-1,0,0]);    // esquerda
  quad(m,[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],[0,1,0]);     // topo
  quad(m,[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],[0,-1,0]);    // base
}
// plano virado pra +z (a tela), com a imagem inteira: (0,0) é o canto de baixo à esquerda
function tela(m,x0,y0,x1,y1,z){ m.temSt=true; quad(m,[x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y1,z],[0,0,1],[[0,0],[1,0],[1,1],[0,1]]); }
// cilindro em pé (eixo y), raio rx/rz (elíptico), de y0 a y1, com tampas
function cilindro(m,cx,cz,rx,rz,y0,y1,n){
  n=n||16;
  for(let i=0;i<n;i++){
    const a0=i/n*2*Math.PI, a1=(i+1)/n*2*Math.PI, c0=Math.cos(a0), s0=Math.sin(a0), c1=Math.cos(a1), s1=Math.sin(a1);
    const k=m.pts.length, p=(c,s,y)=>[cx+rx*c, y, cz+rz*s];
    m.pts.push(p(c0,s0,y0),p(c1,s1,y0),p(c1,s1,y1),p(c0,s0,y1));
    m.nrm.push([c0,0,s0],[c1,0,s1],[c1,0,s1],[c0,0,s0]); m.st.push([0,0],[0,0],[0,0],[0,0]);
    m.idx.push(k,k+2,k+1, k,k+3,k+2);
    const t=m.pts.length; m.pts.push([cx,y1,cz],p(c0,s0,y1),p(c1,s1,y1)); m.nrm.push([0,1,0],[0,1,0],[0,1,0]); m.st.push([0,0],[0,0],[0,0]); m.idx.push(t,t+2,t+1);
    const b=m.pts.length; m.pts.push([cx,y0,cz],p(c0,s0,y0),p(c1,s1,y0)); m.nrm.push([0,-1,0],[0,-1,0],[0,-1,0]); m.st.push([0,0],[0,0],[0,0]); m.idx.push(b,b+1,b+2);
  }
}
// polígono plano convexo com a normal n pra fora; o sentido dos triângulos sai da própria normal
function face(m,ps,n,uv){
  const i=m.pts.length; let N=[0,0,0];
  ps.forEach((p,k)=>{ N=soma(N,vxv(p,ps[(k+1)%ps.length])); m.pts.push(p); m.nrm.push(n); m.st.push(uv?uv[k]:[0,0]); });
  const inv=pe3(N,n)<0;
  for(let k=1;k<ps.length-1;k++) if(inv) m.idx.push(i,i+k+1,i+k); else m.idx.push(i,i+k,i+k+1);
}
// polígono convexo [x,y] levantado de z0 a z1 (z0 < z1); semFrente = sem a tampa de +z (encostada em algo)
function prisma(m,poly,z0,z1,semFrente){
  const n=poly.length; let A=0;
  poly.forEach((p,k)=>{ const q=poly[(k+1)%n]; A+=p[0]*q[1]-q[0]*p[1]; });
  const s=A>0?1:-1;                                      // anti-horário: a normal de fora de cada aresta é (dy, −dx)
  face(m,poly.map(p=>[p[0],p[1],z0]),[0,0,-1]);
  if(!semFrente) face(m,poly.map(p=>[p[0],p[1],z1]),[0,0,1]);
  for(let k=0;k<n;k++){ const p=poly[k], q=poly[(k+1)%n], dx=q[0]-p[0], dy=q[1]-p[1], l=Math.hypot(dx,dy)||1;
    face(m,[[p[0],p[1],z0],[q[0],q[1],z0],[q[0],q[1],z1],[p[0],p[1],z1]],[s*dy/l,-s*dx/l,0]); }
}
/* ---------- formas lisas (o boneco) ----------
   Tudo vira uma grade de anéis em volta de um eixo: as normais saem lisas das
   diferenças entre vizinhos, viradas pra fora do centro de cada anel, e o sentido dos
   triângulos é conferido num quadrado (o AR desenha só a frente de cada face). */
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], soma=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]], vez=(a,k)=>[a[0]*k,a[1]*k,a[2]*k];
const vxv=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]], pe3=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const unit=a=>{ const l=Math.hypot(a[0],a[1],a[2])||1; return [a[0]/l,a[1]/l,a[2]/l]; };
function grade(m,aneis){
  const N=aneis.length, U=aneis[0].pts.length, v0=m.pts.length, nr=[];
  for(let i=0;i<N;i++) for(let j=0;j<U;j++){
    const P=aneis[i].pts, fora=sub(P[j],aneis[i].c);
    let n=vxv(sub(P[(j+1)%U],P[(j+U-1)%U]), sub(aneis[Math.min(N-1,i+1)].pts[j],aneis[Math.max(0,i-1)].pts[j]));
    if(Math.hypot(...fora)<1e-6||Math.hypot(...n)<1e-12){             // polo: a normal é o próprio eixo
      const ax=sub(aneis[Math.min(N-1,i+1)].c,aneis[Math.max(0,i-1)].c); n=i===0?vez(ax,-1):ax; }
    else if(pe3(n,fora)<0) n=vez(n,-1);
    nr.push(unit(n));
  }
  for(let i=0;i<N;i++) for(let j=0;j<U;j++){ m.pts.push(aneis[i].pts[j]); m.nrm.push(nr[i*U+j]); m.st.push([0,0]); }
  let inv=false;                                         // sentido: o primeiro quadrado que não é ponto
  achar: for(let i=0;i<N-1;i++) for(let j=0;j<U;j++){
    const a=aneis[i].pts[j], b=aneis[i].pts[(j+1)%U], c=aneis[i+1].pts[(j+1)%U], x=vxv(sub(b,a),sub(c,a));
    if(Math.hypot(...x)>1e-12){ inv=pe3(x,nr[i*U+j])<0; break achar; } }
  for(let i=0;i<N-1;i++) for(let j=0;j<U;j++){
    const a=v0+i*U+j, b=v0+i*U+(j+1)%U, c=v0+(i+1)*U+(j+1)%U, d=v0+(i+1)*U+j;
    if(inv) m.idx.push(a,c,b, a,d,c); else m.idx.push(a,b,c, a,c,d);
  }
}
// elipsoide de centro c e raios r; meia = só a metade de cima (o casco do capacete)
function elipsoide(m,c,r,meia,nl,nu){
  nl=nl||10; nu=nu||18; const aneis=[], lat=meia?Math.PI/2:Math.PI;
  for(let i=0;i<=nl;i++){ const th=i/nl*lat, y=c[1]+r[1]*Math.cos(th), s=Math.sin(th), pts=[];
    for(let j=0;j<nu;j++){ const ph=j/nu*2*Math.PI; pts.push([c[0]+r[0]*s*Math.cos(ph), y, c[2]+r[2]*s*Math.sin(ph)]); }
    aneis.push({c:[c[0],y,c[2]],pts}); }
  grade(m,aneis);
}
// cápsula de a até b, afinando de ra pra rb, com as pontas redondas
function capsula(m,a,b,ra,rb,n){
  n=n||14; const d=sub(b,a), L=Math.hypot(...d); if(L<1e-6) return;
  const f=vez(d,1/L), u=unit(vxv(Math.abs(f[1])<0.95?[0,1,0]:[1,0,0],f)), v=vxv(f,u);
  const tg=Math.asin(Math.max(-1,Math.min(1,(ra-rb)/L))), K=5, aneis=[];
  const anel=(t,r)=>{ const c=soma(a,vez(f,t)), pts=[];
    for(let j=0;j<n;j++){ const s=j/n*2*Math.PI; pts.push(soma(c,soma(vez(u,r*Math.cos(s)),vez(v,r*Math.sin(s))))); }
    aneis.push({c,pts}); };
  for(let i=0;i<=K;i++){ const p=-Math.PI/2+(Math.PI/2+tg)*i/K; anel(ra*Math.sin(p),ra*Math.cos(p)); }
  for(let i=0;i<=K;i++){ const p=tg+(Math.PI/2-tg)*i/K; anel(L+rb*Math.sin(p),rb*Math.cos(p)); }
  grade(m,aneis);
}
/* o símbolo da Projetech nas costas da camiseta: a imagem já sobre a cor da camiseta
   (sem transparência, que o AR do iPhone nem sempre respeita); fica pronta sozinha */
let LOGO_COSTAS=null;
const logoPronto=new Promise(fim=>{ try{ const i=new Image();
  i.onload=()=>{ const c=document.createElement('canvas'); c.width=256; c.height=Math.round(256*i.height/i.width);
    const x=c.getContext('2d'); x.fillStyle='#1b1e25'; x.fillRect(0,0,c.width,c.height); x.globalAlpha=0.96; x.drawImage(i,0,0,c.width,c.height);
    LOGO_COSTAS=c; fim(c); };
  i.onerror=()=>fim(null); i.src='logo-mark.png'; }catch(e){ fim(null); } });
/* tubo de raio r seguindo um caminho (pontos 3D), com as pontas fechadas. Na quina o anel
   fica na bissetriz e abre (meia-esquadria) só no plano da curva, pra espessura não afinar;
   de um anel pro outro ele é levado sem girar (transporte paralelo), senão o tubo torce e
   estrangula numa das curvas. */
function tubo(m,cam,r,n){
  n=n||10; const N=cam.length; if(N<2) return;
  const dir=i=>unit(sub(cam[i+1],cam[i]));
  const tg=cam.map((_,i)=>i===0?dir(0):i===N-1?dir(N-2):unit(soma(dir(i-1),dir(i))));
  let ref=null;                                          // o primeiro anel: de lado no plano da primeira curva
  for(let i=1;i<N-1&&!ref;i++){ const x=vxv(sub(cam[i],cam[i-1]),sub(cam[i+1],cam[i])); if(Math.hypot(...x)>1e-12) ref=unit(x); }
  if(!ref) ref=Math.abs(tg[0][2])<0.9?[0,0,1]:[0,1,0];
  let u=unit(vxv(tg[0],ref));
  const aneis=cam.map((c,i)=>{
    const t=tg[i]; if(i>0) u=unit(sub(u,vez(t,pe3(u,t))));
    const v=vxv(u,t);
    let w=null, k=1;                                     // w: direção da curva, perpendicular à bissetriz
    if(i>0&&i<N-1){ const a=dir(i-1), b=dir(i), d=sub(b,a); if(Math.hypot(...d)>1e-9){ w=unit(d); k=1/Math.max(0.5,pe3(a,t)); } }
    const pts=[]; for(let j=0;j<n;j++){ const s=j/n*2*Math.PI; let o=soma(vez(u,r*Math.cos(s)),vez(v,r*Math.sin(s)));
      if(w) o=soma(o,vez(w,pe3(o,w)*(k-1))); pts.push(soma(c,o)); }
    return {c,pts};
  });
  const polo=(c,d)=>{ const p=soma(c,vez(d,r*0.04)); return {c:p,pts:new Array(n).fill(0).map(()=>p.slice())}; };
  grade(m,[polo(cam[0],vez(tg[0],-1)),...aneis,polo(cam[N-1],tg[N-1])]);
}
// tronco por seções em superelipse (y, meia largura, meia profundidade), de baixo pra cima
function tronco(m,cx,cz,secoes,ex,nu){
  nu=nu||24; ex=ex||2.6; const aneis=[];
  secoes.forEach(([y,rx,rz,dz])=>{ const pts=[];
    for(let j=0;j<nu;j++){ const s=j/nu*2*Math.PI, c=Math.cos(s), q=Math.sin(s);
      pts.push([cx+rx*Math.sign(c)*Math.pow(Math.abs(c),2/ex), y, cz+(dz||0)+rz*Math.sign(q)*Math.pow(Math.abs(q),2/ex)]); }
    aneis.push({c:[cx,y,cz+(dz||0)],pts}); });
  grade(m,aneis);
}

/* ---------- o técnico da Montagem, em 3D ----------
   O mesmo boneco da Vista e da Montagem: camiseta preta com o símbolo da Projetech nas
   costas, calça, botina, luvas e capacete com aba e catraca — a montadora (capacete
   amarelo, rabo de cavalo) ou o ajudante (capacete branco). De pé, de costas pra
   plateia (olhando o painel, pro −z). Medidas de uma pessoa de 1,75 m até o alto da
   cabeça, na escala k da altura pedida (o capacete passa uns 4 cm). */
function pessoa3d(peca,o){
  const k=o.k, F=!!o.mulher, P=(bx,by,bz)=>[o.x+bx*k, o.y0+by*k, o.z+bz*k], R=v=>v*k;
  const calca=peca('Pessoa_calca','calca'), camisa=peca('Pessoa_camisa','camisa'), pele=peca('Pessoa_pele','pele'),
        bota=peca('Pessoa_bota','bota'), sola=peca('Pessoa_sola','sola'), luva=peca('Pessoa_luva','luva'),
        cabelo=peca('Pessoa_cabelo',F?'cabeloF':'cabelo'), cap=peca('Pessoa_capacete',F?'capacete':'capaceteB'),
        catraca=peca('Pessoa_catraca','catraca');
  // pernas e botinas (a ponta da botina pro painel)
  [-1,1].forEach(s=>{
    const J=P(s*0.092,0.9,0), K=P(s*0.102,0.49,-0.012), A=P(s*0.11,0.11,0.005);
    capsula(calca,J,K,R(0.088),R(0.066),16); capsula(calca,K,A,R(0.065),R(0.054),16);
    capsula(bota,P(s*0.11,0.06,0.012),P(s*0.11,0.165,0.01),R(0.058),R(0.056),16);
    elipsoide(bota,P(s*0.11,0.07,-0.045),[R(0.058),R(0.062),R(0.135)],false,8,16);
    cilindro(sola,o.x+R(s*0.11),o.z+R(-0.045),R(0.064),R(0.142),o.y0,o.y0+R(0.022),20);
  });
  elipsoide(calca,P(0,0.935,0.004),[R(F?0.182:0.172),R(0.125),R(F?0.122:0.115)],false,8,20);   // quadril
  // tronco: a camiseta, um pouco folgada; nela, ombros mais estreitos e a cintura marcada
  const T=F?[[0.86,0.178,0.13],[0.95,0.171,0.125],[1.05,0.152,0.112],[1.15,0.162,0.12],[1.25,0.178,0.13],[1.32,0.185,0.123],
             [1.38,0.18,0.112],[1.42,0.162,0.097],[1.45,0.122,0.08],[1.474,0.08,0.066],[1.48,0.056,0.052]]
           :[[0.86,0.178,0.128],[0.95,0.172,0.122],[1.05,0.168,0.118],[1.15,0.178,0.122],[1.25,0.195,0.128],[1.33,0.205,0.125],
             [1.39,0.205,0.115],[1.43,0.182,0.1],[1.46,0.135,0.083],[1.485,0.085,0.07],[1.49,0.06,0.055]];
  tronco(camisa,o.x,o.z,T.map(([y,rx,rz])=>[o.y0+y*k,R(rx),R(rz)]),2.6,28);
  // braços: manga, braço, antebraço e luva
  const oS=F?0.155:0.17, oE=F?0.2:0.215, oW=F?0.215:0.235;
  [-1,1].forEach(s=>{
    const S=P(s*oS,F?1.365:1.375,0.005), E=P(s*oE,1.11,0.012), W=P(s*oW,0.86,-0.004);
    capsula(camisa,S,soma(S,vez(sub(E,S),0.44)),R(F?0.06:0.066),R(F?0.054:0.06),16);
    capsula(pele,S,E,R(F?0.044:0.048),R(F?0.037:0.04),14); capsula(pele,E,W,R(F?0.037:0.04),R(0.031),14);
    capsula(luva,soma(E,vez(sub(W,E),0.8)),W,R(0.036),R(0.04),14);
    elipsoide(luva,P(s*(oW+0.004),0.8,-0.012),[R(0.04),R(0.062),R(0.048)],false,8,14);
  });
  // pescoço, cabeça, orelhas e cabelo (o cabelo fica por trás: de frente, o rosto)
  capsula(pele,P(0,1.44,0.004),P(0,1.575,-0.004),R(F?0.045:0.05),R(F?0.043:0.048),14);
  elipsoide(pele,P(0,1.645,-0.01),[R(F?0.076:0.08),R(0.105),R(0.098)],false,10,18);
  [-1,1].forEach(s=>elipsoide(pele,P(s*(F?0.076:0.08),1.638,0.002),[R(0.014),R(0.027),R(0.02)],false,6,10));
  elipsoide(cabelo,P(0,1.662,0.014),[R(F?0.08:0.083),R(0.098),R(0.093)],false,10,18);
  if(F){                                                 // rabo de cavalo, saindo por baixo da catraca
    const B=[P(0,1.612,0.092),P(0,1.555,0.122),P(0,1.48,0.126),P(0,1.425,0.114)], r=[0.03,0.034,0.026,0.012];
    for(let i=0;i<B.length-1;i++) capsula(cabelo,B[i],B[i+1],R(r[i]),R(r[i+1]),12);
    capsula(peca('Pessoa_elastico','elastico'),P(0,1.614,0.086),P(0,1.6,0.104),R(0.032),R(0.032),12);
  }
  // capacete: casco, nervura, aba (maior na frente) e a catraca atrás
  elipsoide(cap,P(0,1.672,0),[R(0.118),R(0.115),R(0.138)],true,8,22);
  elipsoide(cap,P(0,1.674,0),[R(0.02),R(0.123),R(0.147)],true,6,10);
  cilindro(cap,o.x,o.z+R(-0.02),R(0.132),R(0.165),o.y0+R(1.664),o.y0+R(1.676),28);
  capsula(catraca,P(0,1.612,0.104),P(0,1.612,0.126),R(0.017),R(0.017),12);
  // o símbolo nas costas, acompanhando a curva da camiseta (u, v = a imagem; 0,0 embaixo à esquerda)
  if(o.logo){
    const lw=F?0.18:0.2, lh=lw*LOGO_COSTAS.height/LOGO_COSTAS.width, yc=F?1.255:1.275, NX=10, NY=8, ex=2.6, m=peca('Pessoa_logo','logo');
    const secao=y=>{ for(let i=0;i<T.length-1;i++) if(y<=T[i+1][0]){ const f=(y-T[i][0])/(T[i+1][0]-T[i][0]); return [T[i][1]+(T[i+1][1]-T[i][1])*f, T[i][2]+(T[i+1][2]-T[i][2])*f]; }
      return [T[T.length-1][1],T[T.length-1][2]]; };
    m.temSt=true; const v0=m.pts.length;
    for(let j=0;j<=NY;j++) for(let i=0;i<=NX;i++){ const u=i/NX, v=j/NY, bx=(u-0.5)*lw, by=yc+(v-0.5)*lh, [rx,rz]=secao(by);
      const bz=rz*Math.pow(1-Math.pow(Math.min(1,Math.abs(bx)/rx),ex),1/ex)+0.003;
      const gx=Math.sign(bx)*Math.pow(Math.abs(bx)/rx,ex-1)/rx, gz=Math.pow(Math.max(0,bz-0.003)/rz,ex-1)/rz;   // gradiente da superelipse
      m.pts.push(P(bx,by,bz)); m.nrm.push(unit([gx,0,gz])); m.st.push([u,v]); }
    for(let j=0;j<NY;j++) for(let i=0;i<NX;i++){ const a=v0+j*(NX+1)+i, b=a+1, c=a+NX+2, d=a+NX+1; m.idx.push(a,b,c, a,c,d); }
  }
}

/* ---------- a placa vista de trás (o gabinete) ----------
   No desenho da Absen NT V2 (fotos e medidas do site da Absen): as placas de 0,50 × 0,50 m
   usam a traseira da NT V2 50×50 e as de 0,50 × 1,00 m, a da 50×100. Moldura de
   magnésio-alumínio com os cantos chanfrados (e o protetor prateado), o fundo dos módulos
   com as nervuras (uma textura), a caixa de energia no meio — aletas, o conector azul de
   força e o redondo de sinal —, a alça de cima, as duas alças
   laterais em colchete (uma de cada lado), as barras com as juntas em flecha, as travas laranja de um lado e os encaixes
   prateados do outro.
   Desenhada uma vez, em mm, vista de trás (u da esquerda pra direita de quem olha as
   costas, v de baixo pra cima, z da frente pra trás) e repetida em cada placa do painel:
   no USDZ cada placa é uma referência à mesma peça, no visor um desenho instanciado.
   Outra medida de placa estica o desenho; a profundidade é a da placa escolhida. */
const NT_V2={
  500: {fonte:[52,432],  azul:330, cabo:{v:245,meia:80,alcance:88},   barras:[246],         juntas:[108,335], travas:[125,372],
        travinhas:[[118,392],[382,392],[118,104],[382,104]]},
  1000:{fonte:[262,738], azul:640, cabo:{v:618,meia:95,alcance:88},   barras:[270,505,740], juntas:[140,360], travas:[270,740],
        travinhas:[[118,868],[382,868],[382,618],[118,372],[382,372],[118,128],[382,128]]} };
// o fundo dos módulos: nervuras verticais com um bico no meio, apontando pro centro da placa
const TEX_GAB={};
function texturaFundo(BH){
  if(TEX_GAB[BH]) return TEX_GAB[BH];
  let c; try{ c=document.createElement('canvas'); }catch(e){ return null; }
  const k=512/500; c.width=512; c.height=Math.round(BH*k);          // 512 × 512 ou 512 × 1024: o visor faz mipmap
  const g=c.getContext('2d'), px=u=>u*k, py=v=>(BH-v)*k;
  g.fillStyle='#55585e'; g.fillRect(0,0,c.width,c.height);
  for(let mv=0;mv<BH;mv+=250) for(let mu=0;mu<500;mu+=250){
    const x0=px(mu+5), y0=py(mv+245), x1=px(mu+245), y1=py(mv+5);
    g.lineWidth=3; g.strokeStyle='#222326'; g.strokeRect(x0+1.5,y0+1.5,x1-x0,y1-y0);
    g.strokeStyle='#676a71'; g.strokeRect(x0,y0,x1-x0,y1-y0);
    const dir=mu<250?1:-1, vm=mv+125;
    for(let u=mu+22;u<=mu+228;u+=13){
      const risca=d=>{ g.beginPath(); g.moveTo(px(u)+d,py(mv+232)+d); g.lineTo(px(u)+d,py(vm+22)+d); g.lineTo(px(u+dir*11)+d,py(vm)+d);
        g.lineTo(px(u)+d,py(vm-22)+d); g.lineTo(px(u)+d,py(mv+18)+d); g.stroke(); };
      g.lineWidth=3.2; g.strokeStyle='#26282c'; risca(1.6);
      g.lineWidth=2.2; g.strokeStyle='#5e6168'; risca(0);
    }
    [[mu+16,mv+16],[mu+234,mv+16],[mu+16,mv+234],[mu+234,mv+234]].forEach(([u,v])=>{
      g.fillStyle='#1d1e21'; g.beginPath(); g.arc(px(u),py(v),4.5,0,7); g.fill(); g.strokeStyle='#6c6f76'; g.lineWidth=1.2; g.stroke(); });
  }
  return TEX_GAB[BH]=c;
}
const GAB={};
function gabinete(W,H,D){
  const chave=[W,H,D].map(v=>Math.round(v*1000)).join('x');
  if(GAB[chave]) return GAB[chave];
  const BH=H/W>=1.5?1000:500, F=NT_V2[BH], sx=W/0.5, sy=H/(BH/1000), sz=D/0.075;
  const X=u=>(500-u)/1000*sx, Y=v=>v/1000*sy, Z=z=>-z/1000*sz, Pt=(u,v,z)=>[X(u),Y(v),Z(z)];
  const partes=[], parte=(nome,mat)=>{ const m=malha(); partes.push({nome,mat,m}); return m; };
  const mold=parte('Moldura','gab_moldura'), fundo=parte('Fundo','gab_fundo'), cx=parte('Fonte','gab_caixa'), aleta=parte('Aletas','gab_aleta'),
        lar=parte('Travas','gab_laranja'), azul=parte('Forca','gab_azul'), prata=parte('Encaixes','gab_prata'), met=parte('Alcas','gab_metal'), led=parte('Led','gab_led');
  const bloco=(m,u0,v0,z0,u1,v1,z1)=>caixa(m,X(u1),Y(v0),Z(z1),X(u0),Y(v1),Z(z0));
  const chapa=(m,poly,z0,z1,semFrente)=>prisma(m,poly.map(([u,v])=>[X(u),Y(v)]),Z(z1),Z(z0),semFrente);
  const cano=(m,cam,r,n)=>tubo(m,cam.map(([u,v,z])=>Pt(u,v,z)),r/1000,n);
  // fundo dos módulos (a textura), 30 mm atrás da frente
  fundo.temSt=true; face(fundo,[Pt(0,0,30),Pt(500,0,30),Pt(500,BH,30),Pt(0,BH,30)],[0,0,-1],[[0,0],[1,0],[1,1],[0,1]]);
  // moldura: anel de 20 mm com os cantos chanfrados (30 mm), da camada dos módulos até a profundidade toda
  const t=20, c=30, ct=c+t*(Math.SQRT2-1);
  const ext=[[c,0],[500-c,0],[500,c],[500,BH-c],[500-c,BH],[c,BH],[0,BH-c],[0,c]],
        int=[[ct,t],[500-ct,t],[500-t,ct],[500-t,BH-ct],[500-ct,BH-t],[ct,BH-t],[t,BH-ct],[t,ct]];
  for(let k=0;k<8;k++){
    const a=ext[k], b=ext[(k+1)%8], p=int[k], q=int[(k+1)%8], ne=unit([Y(b[1])-Y(a[1]),-(X(b[0])-X(a[0])),0]), ni=unit([Y(q[1])-Y(p[1]),-(X(q[0])-X(p[0])),0]);
    const fora=pe3(ne,[X(a[0])-W/2,Y(a[1])-H/2,0])<0?-1:1;            // a normal que aponta pra fora do centro
    face(mold,[Pt(a[0],a[1],28),Pt(b[0],b[1],28),Pt(b[0],b[1],75),Pt(a[0],a[1],75)],vez(ne,fora));
    face(mold,[Pt(p[0],p[1],30),Pt(q[0],q[1],30),Pt(q[0],q[1],75),Pt(p[0],p[1],75)],vez(ni,-fora));
    face(mold,[Pt(a[0],a[1],75),Pt(b[0],b[1],75),Pt(q[0],q[1],75),Pt(p[0],p[1],75)],[0,0,-1]);
  }
  /* espinha do meio, de ponta a ponta, e a caixa de energia sobre ela: o corpo é do cinza da
     moldura (com um degrau de chanfro), igual dos dois lados, e a fenda do meio tem aletas */
  bloco(mold,230,t,30,270,BH-t,50);
  const [f0,f1]=F.fonte;
  chapa(mold,[[208,f0],[292,f0],[300,f0+12],[300,f1-28],[286,f1],[214,f1],[200,f1-28],[200,f0+12]],30,70,true);
  chapa(mold,[[212,f0+6],[288,f0+6],[294,f0+16],[294,f1-30],[282,f1-6],[218,f1-6],[206,f1-30],[206,f0+16]],70,72,true);
  bloco(aleta,244,f0+64,72,272,f1-54,72.6);                          // a fenda
  [250,258,266].forEach(u=>bloco(cx,u-1.5,f0+70,72.6,u+1.5,f1-60,74.5));
  bloco(azul,208,F.azul,72,236,F.azul+30,80);                       // o conector de força (azul)
  cano(cx,[[222,F.azul+15,80],[222,F.azul+15,82.5]],9,12);
  cano(prata,[[222,f0+46,72],[222,f0+46,78]],13,14);                 // o de sinal (anel prateado)
  cano(cx,[[222,f0+46,78],[222,f0+46,80]],8,12);
  cano(led,[[280,f0+46,72],[280,f0+46,74]],5,10);
  /* o LED aceso (verde claro): um pouco maior, cobrindo o apagado (escuro), com um brilho em volta —
     uma placa quadrada que o visor e o AR desenham redonda, somando luz — pra ele aparecer de longe
     contra o cinza da placa. Pisca em 1 s (meio aceso, meio apagado), todas as placas juntas — no
     visor, no USDZ e no GLB (lá os dois encolhem a zero na metade apagada) */
  cano(parte('LedAceso','gab_led_on'),[[280,f0+46,71.9],[280,f0+46,74.4]],6.5,12);
  const rb=42; face(parte('LedBrilho','gab_led_halo'),[Pt(280+rb,f0+46-rb,74.8),Pt(280-rb,f0+46-rb,74.8),Pt(280-rb,f0+46+rb,74.8),Pt(280+rb,f0+46+rb,74.8)],[0,0,-1],[[0,0],[1,0],[1,1],[0,1]]);
  bloco(lar,247,f1-50,72,269,f1-36,75);
  /* alça de cima e as duas alças laterais, iguais, uma de cada lado (espelhadas): um colchete
     fundido junto com a moldura — sai do trilho, entra em diagonal, desce reto e volta */
  cano(met,[[192,BH-4,60],[192,BH-34,70],[204,BH-46,72],[296,BH-46,72],[308,BH-34,70],[308,BH-4,60]],6,10);
  const L=F.cabo, a=L.alcance;
  [u=>u,u=>500-u].forEach(lado=>cano(mold,[[lado(18),L.v+L.meia,64],[lado(a*0.62),L.v+L.meia*0.78,67],[lado(a),L.v+L.meia*0.5,68],
            [lado(a),L.v-L.meia*0.5,68],[lado(a*0.62),L.v-L.meia*0.78,67],[lado(18),L.v-L.meia,64]],11,8));
  // barras de lado a lado, com as juntas em flecha
  F.barras.forEach(vb=>{
    cano(mold,[[t,vb,44],[500-t,vb,44]],11,10);
    F.juntas.forEach(uj=>chapa(mold,[[uj-18,vb],[uj,vb+28],[uj+18,vb],[uj,vb-28]],30,58,true));
  });
  // as travinhas de cada módulo (corpo preto, miolo laranja) e as abas laranja de baixo
  F.travinhas.forEach(([u,v])=>{ bloco(cx,u-17,v-23,30,u+17,v+23,46); bloco(lar,u-5,v-9,46,u+5,v+9,48.5); });
  [[100,32],[410,40]].forEach(([u,v])=>bloco(lar,u-9,v-6,30,u+9,v+6,42));
  /* travas (lado direito de quem olha as costas): corpo cinza com a tampa escura, a argola
     laranja pendurada e o botão laranja na lateral; do outro lado, na mesma altura, os
     encaixes prateados */
  F.travas.forEach(v=>{
    bloco(mold,446,v-28,32,498,v+28,62);
    bloco(cx,452,v-4,62,494,v+22,68);
    cano(lar,[[463,v-8,66],[459,v-26,69],[468,v-42,70],[477,v-26,69],[473,v-8,66]],3,6);
    bloco(lar,490,v-7,40,499,v+7,54);
    face(prata,[Pt(-0.6,v-32,35),Pt(-0.6,v+32,35),Pt(-0.6,v+32,70),Pt(-0.6,v-32,70)],[1,0,0]);   // o encaixe fica na lateral da placa
  });
  // protetores prateados sobre os quatro chanfros e os pinos rosqueados de cima, de encaixar a placa de cima
  [[0,0,1,1],[500,0,-1,1],[0,BH,1,-1],[500,BH,-1,-1]].forEach(([u,v,du,dv])=>chapa(prata,[[u,v+dv*28],[u+du*28,v],[u+du*54,v],[u,v+dv*54]],75,77.5,true));
  [100,400].forEach(u=>{ bloco(cx,u-14,BH-84,30,u+14,BH-24,56); cano(prata,[[u,BH-78,60],[u,BH+3,60]],6,8); });
  return GAB[chave]={nome:'Placa_'+chave, partes, tex:texturaFundo(BH)};
}

/* ---------- painel curvo ----------
   As colunas de placas são planas e dobram nas emendas: 'emendas' é o ângulo de cada
   emenda em graus (+ côncava, abraçando a plateia; − convexa). Devolve, pra cada coluna,
   o canto da frente à esquerda (x, z) e o giro em y (a, como o rotateY do USD), com a corda
   no eixo x, centrada, e o ponto mais à frente em z = 0; pra cada emenda (0..n, as pontas
   incluídas), o ponto e o giro da bissetriz — onde a mão-francesa encosta, de esquadro.
   Painel com quina: 'alinha' = [c0, c1) é a seção (colunas) que fica de frente, paralela ao
   x, e o x é centrado no que ocupa (a corda, numa L, sairia torta). */
/* placa flexível (flex: a curva de cada coluna, em graus, de uma ponta à outra do corpo dela): cada placa
   é um arco entre as mesmas duas pontas da corda; as emendas que chegam aqui já são o giro entre as
   cordas ((b de um lado + b do outro)/2 + a quina), então a curva fica contínua. 'lisos': K pontos por
   coluna ao longo dos arcos (a planta desenha a curva lisa) */
const FLEX_K=8, corFlex=(w,bDeg)=>{ const b=Math.abs(bDeg)*Math.PI/180; return b<1e-6?w:w*Math.sin(b/2)/(b/2); };
function curvaGeo(emendas,cw,D,alinha,flex){
  const n=emendas.length+1, fl=Array.isArray(flex)&&flex.length===n&&flex.some(v=>Math.abs(v)>1e-6)?flex:null, P=[[0,0]], h=[0];
  const larg=j=>fl?corFlex(cw,fl[j]):cw, rad=j=>fl?fl[j]*Math.PI/180:0;
  for(let j=0;j<n;j++){ if(j>0) h.push(h[j-1]+emendas[j-1]*Math.PI/180); P.push([P[j][0]+larg(j)*Math.cos(h[j]), P[j][1]+larg(j)*Math.sin(h[j])]); }
  // o arco de cada coluna (no começo da corda, no giro dela): a mesma conta da placa curvada (dobra)
  const arco=(j,f)=>{ const b=rad(j); if(Math.abs(b)<1e-6) return [larg(j)*f,0]; const R=cw/b, c=larg(j), zc=R*Math.cos(b/2), ph=(f-0.5)*b; return [c/2+R*Math.sin(ph), zc-R*Math.cos(ph)]; };
  let L=fl?[]:null;
  if(fl) for(let j=0;j<n;j++) for(let k=(j?1:0);k<=FLEX_K;k++){ const [lx,lz]=arco(j,k/FLEX_K), co=Math.cos(h[j]), si=Math.sin(h[j]); L.push([P[j][0]+co*lx-si*lz, P[j][1]+si*lx+co*lz]); }
  const al=Array.isArray(alinha)&&alinha[1]>alinha[0]&&alinha[0]>=0&&alinha[1]<=n?alinha:null;
  const r=al?-h.slice(al[0],al[1]).reduce((q,v)=>q+v,0)/(al[1]-al[0]):-Math.atan2(P[n][1]-P[0][1],P[n][0]-P[0][0]), co=Math.cos(r), si=Math.sin(r);
  const gira=([x,z])=>[x*co-z*si, x*si+z*co];
  let Q=P.map(gira); const H=h.map(v=>v+r); if(L) L=L.map(gira);
  const cx=al?(Math.min(...Q.map(q=>q[0]))+Math.max(...Q.map(q=>q[0])))/2:(Q[0][0]+Q[n][0])/2, zf=Math.max(...Q.map(q=>q[1]),...(L||[]).map(q=>q[1]));
  Q=Q.map(([x,z])=>[x-cx,z-zf]); if(L) L=L.map(([x,z])=>[x-cx,z-zf]);
  const cols=H.map((hh,j)=>({x:Q[j][0], z:Q[j][1], a:-hh, b:fl?fl[j]:0}));
  // o giro na emenda: entre o fim de uma placa e o começo da outra (na flexível, as tangentes dos arcos)
  const fim=j=>H[j]+rad(j)/2, ini=j=>H[j]-rad(j)/2;
  const em=Q.map((q,k)=>({x:q[0], z:q[1], a:-(k===0?ini(0):k===n?fim(n-1):(fim(k-1)+ini(k))/2)}));
  let zTras=0; H.forEach((hh,j)=>[Q[j],Q[j+1]].forEach(q=>{ zTras=Math.min(zTras,q[1]-D*Math.cos(hh)); }));
  if(L) L.forEach(q=>{ zTras=Math.min(zTras,q[1]-D); });
  const z0=Q[0][1], todos=L||Q;
  return {cols, emendas:em, zTras, corda:Math.abs(Q[n][0]-Q[0][0]), flecha:Math.max(...todos.map(q=>Math.abs(q[1]-z0))), pontos:Q, lisos:L};
}
/* refina: parte os triângulos até nenhuma aresta passar de 'lim' em x (a aresta dividida ao meio é a mesma
   dos dois lados, então não abre fresta); dobra: curva a malha reta de uma placa (x de 0 a w, frente em
   z = 0, costas pra trás) em b graus no corpo, com as pontas na corda (0 a c) — + côncava (as pontas vêm
   pra plateia), − convexa. A profundidade segue a normal do arco */
function refina(src,lim){
  const P=src.pts.slice(), N=src.nrm.slice(), temSt=src.st.length===src.pts.length, S=temSt?src.st.slice():[], meio=new Map();
  const mid=(a,b)=>{ const k=a<b?a+'_'+b:b+'_'+a; let v=meio.get(k);
    if(v==null){ v=P.length; P.push(P[a].map((q,i)=>(q+P[b][i])/2)); const nn=N[a].map((q,i)=>q+N[b][i]), l=Math.hypot(...nn)||1; N.push(nn.map(q=>q/l));
      if(temSt) S.push([(S[a][0]+S[b][0])/2,(S[a][1]+S[b][1])/2]); meio.set(k,v); }
    return v; };
  const fila=[], out=[]; for(let i=0;i<src.idx.length;i+=3) fila.push([src.idx[i],src.idx[i+1],src.idx[i+2]]);
  while(fila.length){ const t=fila.pop(); let e=-1, dl=lim;
    for(let k=0;k<3;k++){ const d=Math.abs(P[t[k]][0]-P[t[(k+1)%3]][0]); if(d>dl){ dl=d; e=k; } }
    if(e<0){ out.push(t[0],t[1],t[2]); continue; }
    const a=t[e], b=t[(e+1)%3], c=t[(e+2)%3], v=mid(a,b); fila.push([a,v,c],[v,b,c]); }
  return {pts:P, nrm:N, st:S, idx:out, temSt:src.temSt};
}
function dobra(src,w,bDeg){
  const b=bDeg*Math.PI/180; if(Math.abs(b)<1e-6||!src.idx.length) return src;
  const m=refina(src,w/24), R=w/b, c=2*R*Math.sin(b/2), zc=R*Math.cos(b/2), fi=m.pts.map(p=>(p[0]/w-0.5)*b);
  m.nrm=m.nrm.map((q,i)=>{ const f=fi[i], co=Math.cos(f), si=Math.sin(f); return [q[0]*co-q[2]*si, q[1], q[0]*si+q[2]*co]; });
  m.pts=m.pts.map((p,i)=>{ const f=fi[i]; return [c/2+(R-p[2])*Math.sin(f), p[1], zc-(R-p[2])*Math.cos(f)]; });
  return m;
}
// o gabinete da placa flexível curvado (um protótipo por curva; as placas da mesma seção dividem)
function gabineteDobrado(W,H,D,bDeg){
  const g=gabinete(W,H,D); if(Math.abs(bDeg)<1e-6) return g;
  const chave=g.nome+'_F'+Math.round(bDeg*10); if(GAB[chave]) return GAB[chave];
  return GAB[chave]=Object.assign({},g,{nome:chave.replace('-','m'), partes:g.partes.map(pt=>Object.assign({},pt,{m:dobra(pt.m,W,bDeg)}))});
}
// copia a malha 'src' pra 'dest', girada em y (a) e levada pra (x, z)
function poe(dest,T,src){
  const co=Math.cos(T.a), si=Math.sin(T.a), i0=dest.pts.length;
  src.pts.forEach(p=>dest.pts.push([T.x+co*p[0]+si*p[2], p[1], T.z-si*p[0]+co*p[2]]));
  src.nrm.forEach(q=>dest.nrm.push([co*q[0]+si*q[2], q[1], -si*q[0]+co*q[2]]));
  src.st.forEach(q=>dest.st.push(q)); src.idx.forEach(k=>dest.idx.push(i0+k)); if(src.temSt) dest.temSt=true;
}

// palco de S.x ± S.w/2 e z0..z1: praticável = tampo + pés a cada 1 m; fechado = bloco com saia
function fazPalco(peca,S,z0,z1){
  const x0=S.x-S.w/2, x1=S.x+S.w/2;
  if(S.fechado){ caixa(peca('Palco','saia'),x0,0,z0,x1,S.h-0.1,z1); caixa(peca('Tampo','saia'),x0,S.h-0.1,z0,x1,S.h,z1); }   // fechado: todo preto (o tampo também)
  else{
    caixa(peca('Tampo','tampo'),x0,S.h-0.1,z0,x1,S.h,z1);
    const pe=peca('Pes','pe'), xs=[], zs=[]; for(let m=0;m<S.w-0.01;m+=1) xs.push(x0+m); xs.push(x1);
    for(let m=0;m<(z1-z0)-0.01;m+=1) zs.push(z0+m); zs.push(z1);
    xs.forEach(x=>zs.forEach(z=>{ const xa=Math.min(Math.max(x-0.03,x0),x1-0.06), za=Math.min(Math.max(z-0.03,z0),z1-0.06); caixa(pe,xa,0,za,xa+0.06,S.h-0.1,za+0.06); }));
  }
}

/* o palco da cena única, de z0 (fundo) a z1 (frente): com o painel em cima, ele começa 'recuo'
   atrás das costas do painel (o espaço da mão-francesa, quando ela vai no palco) e vai 'prof' pra
   frente; com o painel no chão, fica atrás dele e da mão-francesa. Sem 'prof': 1,5 m na frente da
   tela / 2 m */
function palcoZ(c,zTras){
  const S=c.palco; if(!S||!(S.h>0)) return null;
  if(S.painelEmCima){ const z0=zTras-(S.recuo!=null?S.recuo:0.4); return {z0, z1:S.prof>0?Math.max(z0+S.prof,0.02):1.5}; }
  const z1=zTras-(c.estrutura?c.estrutura.prof+0.3:0.05); return {z0:z1-(S.prof>0?S.prof:2.0), z1};
}
// onde fica a fileira de mão-francesa do apoio 'ax' (na emenda; curvo: no lugar e no giro da emenda)
function mfLugar(ax,{P,nc,gw,CV}){
  const e=CV?CV.emendas[Math.min(nc,Math.max(0,Math.round((ax+P.w/2)/gw)))]:null;
  return e?{x:P.x+e.x,z:e.z,a:e.a}:{x:P.x+ax,z:0,a:0};
}
/* mão-francesa mista: com o painel sobre o palco, cada fileira vê se o pé dela (o meio do quadro,
   entre as costas do painel e o fundo) cai em cima do palco. Em cima: apoia nele, com a pilha
   recalculada da altura do palco (estrutura.palco); fora: no chão (estrutura.chao). Painel curvo
   com a mão-francesa no chão: as pontas vêm pra frente e as delas sobem do palco, sem atravessá-lo.
   Sem as duas pilhas, null: todas apoiam em estrutura.base */
function mfOnde(c,g){
  const E=c.estrutura, S=c.palco; if(!E||!S||!S.painelEmCima||!('palco' in E)||!('chao' in E)) return null;
  const Z=palcoZ(c,g.zTras); if(!Z) return null;
  const zc=-g.D-E.prof/2, x0=S.x-S.w/2, x1=S.x+S.w/2;
  return E.apoios.map(ax=>{ const T=mfLugar(ax,g), x=T.x+Math.sin(T.a)*zc, z=T.z+Math.cos(T.a)*zc;
    return x>=x0-1e-6&&x<=x1+1e-6&&z>=Z.z0-1e-6&&z<=Z.z1+1e-6?'palco':'chao'; });
}
// pro app (o texto da estrutura): a mesma decisão do 3D, fileira por fileira
function mfOndeCena(c){
  const P=c.painel, G=P.placa&&P.placa.w>0&&P.placa.h>0?P.placa:null, D=G?(G.d||0.08):0.09;
  const nc=G?Math.max(1,Math.round(P.w/G.w)):1, gw=P.w/nc;
  const CV=G&&nc>1&&Array.isArray(P.curva)&&P.curva.length===nc-1&&P.curva.some(a=>Math.abs(a)>1e-6)?curvaGeo(P.curva,gw,D,P.alinha,P.flex):null;
  return mfOnde(c,{P,nc,gw,CV,D,zTras:CV?CV.zTras:-D});
}

/* ---------- a cena ----------
   cena = { painel:{w,h,base,x,img(canvas),placa:null|{w,h,d},curva:null|[graus por emenda],alinha:null|[c0,c1]}, palco:null|{w,h,prof,recuo,x,fechado,painelEmCima},
            pessoa:null|{h,x,emCima}, apoio:bool,
            estrutura:null|{modulos:[{h,quadros}], topo, apoios:[x], prof, pesos, base} }
          (x = centro, em metros; z = 0 na frente do painel; palco.prof em branco = automática;
           palco.recuo = quanto o palco passa das costas do painel quando ele está em cima;
           estrutura.base = altura de onde a mão-francesa apoia: o palco ou o chão) */
const COR={ corpo:[0.012,0.014,0.018], tampo:[0.02,0.02,0.022], pe:[0.42,0.44,0.47], saia:[0.008,0.008,0.009],
  calca:[0.035,0.043,0.06], camisa:[0.011,0.013,0.018], pele:[0.56,0.27,0.14], bota:[0.008,0.009,0.011],
  capacete:[0.89,0.47,0.0], luva:[0.48,0.53,0.6], peso:[0.025,0.026,0.03],
  // o resto do técnico, com as cores da Montagem (convertidas pra linear, como as de cima)
  capaceteB:[0.855,0.879,0.913], sola:[0.064,0.069,0.085], cabelo:[0.023,0.015,0.011], cabeloF:[0.155,0.063,0.03],
  elastico:[0.028,0.159,0.776], catraca:[0.024,0.027,0.036], logo:[0.011,0.013,0.018],
  // a placa por trás (NT V2): magnésio-alumínio, caixa preta, travas laranja, conector azul, encaixes prateados
  gab_moldura:[0.102,0.109,0.125], gab_fundo:[0.06,0.064,0.072], gab_caixa:[0.016,0.017,0.0194], gab_aleta:[0.042,0.045,0.052],
  gab_laranja:[0.888,0.262,0.021], gab_azul:[0.016,0.169,0.752], gab_prata:[0.578,0.604,0.644], gab_metal:[0.147,0.156,0.175],
  gab_led:[0.02,0.045,0.025], gab_led_on:[0.25,1,0.35], gab_led_halo:[0.04,1,0.16] };
const MAT_GAB={ gab_moldura:{cor:COR.gab_moldura,rug:0.7,metal:0.2}, gab_fundo:{tex:'textures/placa.jpg',rug:0.7,metal:0.1},
  gab_caixa:{cor:COR.gab_caixa,rug:0.4,metal:0.1}, gab_aleta:{cor:COR.gab_aleta,rug:0.5,metal:0.4}, gab_laranja:{cor:COR.gab_laranja,rug:0.45},
  gab_azul:{cor:COR.gab_azul,rug:0.4}, gab_prata:{cor:COR.gab_prata,rug:0.35,metal:0.55}, gab_metal:{cor:COR.gab_metal,rug:0.35,metal:0.6},
  gab_led:{cor:COR.gab_led,rug:0.3}, gab_led_on:{cor:[0,0,0],luz:COR.gab_led_on,rug:0.3},
  gab_led_halo:{tex:'textures/brilho.png',emissivo:true,alfa:true,rug:1} };
const LED_MEIO=0.5;                                       // o LED das placas: meio segundo aceso, meio apagado
// o brilho do LED (PNG com transparência, pro AR): verde, forte no meio e sumindo até a borda
let PNG_BRILHO=null;
function pngBrilho(){
  if(PNG_BRILHO) return PNG_BRILHO;
  const c=document.createElement('canvas'); c.width=c.height=64;
  const x=c.getContext('2d'), g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(150,255,170,1)'); g.addColorStop(0.2,'rgba(70,255,120,0.88)'); g.addColorStop(0.55,'rgba(40,255,90,0.32)'); g.addColorStop(1,'rgba(40,255,90,0)');
  x.fillStyle=g; x.fillRect(0,0,64,64);
  return PNG_BRILHO=new Promise((ok,erro)=>c.toBlob(b=>b?b.arrayBuffer().then(a=>ok(new Uint8Array(a))):erro(new Error('não deu pra gerar o brilho do LED')),'image/png'));
}
function montaCena(c){
  const pecas=[]; const peca=(nome,mat)=>{ const m=malha(); pecas.push({nome,mat,m}); return m; };
  const P=c.painel, G=P.placa&&P.placa.w>0&&P.placa.h>0?P.placa:null, D=G?(G.d||0.08):0.09;
  /* painel: corpo escuro + a tela com a imagem (emissiva: LED aceso, lê bem até no claro).
     Sabendo a placa, o corpo é só a camada dos módulos e as costas são as placas, uma a
     uma (o mesmo gabinete repetido em cada posição: 'grupo') */
  const nc=G?Math.max(1,Math.round(P.w/G.w)):1, nr=G?Math.max(1,Math.round(P.h/G.h)):1, gw=P.w/nc, gh=P.h/nr;
  // curvo: cada coluna de placas no seu lugar e no seu giro (CV.cols); reto: CV = null
  const CV=G&&nc>1&&Array.isArray(P.curva)&&P.curva.length===nc-1&&P.curva.some(a=>Math.abs(a)>1e-6)?curvaGeo(P.curva,gw,D,P.alinha,P.flex):null;
  const naColuna=(m,fazer)=>CV.cols.forEach((col,i)=>{ const l=malha(); fazer(l,i); poe(m,{x:P.x+col.x,z:col.z,a:col.a},col.b?dobra(l,gw,col.b):l); });   // flexível: a coluna curvada no corpo
  const zTras=CV?CV.zTras:-D;                       // as costas mais recuadas do painel
  if(G){
    if(CV) naColuna(peca('Painel','corpo'),l=>caixa(l,0,P.base,-0.028,gw,P.base+P.h,0));
    else caixa(peca('Painel','corpo'), P.x-P.w/2, P.base, -0.028, P.x+P.w/2, P.base+P.h, 0);
    const porCurva=new Map();                                       // flexível: um protótipo por curva (as placas da mesma seção dividem)
    for(let j=0;j<nr;j++) for(let i=0;i<nc;i++){ const b=CV?CV.cols[i].b||0:0; if(!porCurva.has(b)) porCurva.set(b,[]);
      porCurva.get(b).push(CV?[P.x+CV.cols[i].x, P.base+j*gh, CV.cols[i].z, CV.cols[i].a]:[P.x-P.w/2+i*gw, P.base+j*gh, 0, 0]); }
    porCurva.forEach((pos,b)=>pecas.push({nome:b?'Placas_F'+String(Math.round(b*10)).replace('-','m'):'Placas', mat:null, m:malha(), grupo:{proto:gabineteDobrado(gw,gh,D,b), pos}}));
  }
  else caixa(peca('Painel','corpo'), P.x-P.w/2, P.base, -D, P.x+P.w/2, P.base+P.h, 0);
  /* a tela: a imagem parada, ou o efeito em quadros (painel.quadros) — uma tela por quadro,
     todas no mesmo lugar; no USDZ só uma aparece por vez (ver usdaQuadro). Curva: um pedaço
     da imagem em cada coluna */
  const [u0,v0,u1,v1]=P.uv||[0,0,1,1], U=f=>u0+(u1-u0)*f;   // uv: o pedaço da imagem que é desta tela
  const telaEm=m=>{ m.temSt=true;
    if(!CV) return quad(m,[P.x-P.w/2,P.base,0.002],[P.x+P.w/2,P.base,0.002],[P.x+P.w/2,P.base+P.h,0.002],[P.x-P.w/2,P.base+P.h,0.002],[0,0,1],[[u0,v0],[u1,v0],[u1,v1],[u0,v1]]);
    naColuna(m,(l,i)=>{ l.temSt=true; quad(l,[0,P.base,0.002],[gw,P.base,0.002],[gw,P.base+P.h,0.002],[0,P.base+P.h,0.002],[0,0,1],[[U(i/nc),v0],[U((i+1)/nc),v0],[U((i+1)/nc),v1],[U(i/nc),v1]]); }); };
  const Q=P.quadros&&P.quadros.length>1?P.quadros:null;
  if(Q) Q.forEach((_,k)=>{ telaEm(peca('Tela_'+String(k).padStart(2,'0'),'tela'+k)); pecas[pecas.length-1].quadro=k; });
  else telaEm(peca('Tela','tela'));
  if(c.apoio && !c.estrutura && P.base<0.01){       // painel no chão sem estrutura: pés de apoio atrás
    const a=peca('Apoio','corpo');
    if(CV) [0,nc-1].forEach(i=>{ const col=CV.cols[i], l=malha(); caixa(l,gw/2-0.04,0,-0.95,gw/2+0.04,0.06,-D); poe(a,{x:P.x+col.x,z:col.z,a:col.a},col.b?dobra(l,gw,col.b):l); });
    else [-1,1].forEach(l=>caixa(a, P.x+l*(P.w/2-0.4)-0.04,0,-0.95, P.x+l*(P.w/2-0.4)+0.04,0.06,-D)); }
  // palco: com o painel em cima, ele começa 'recuo' atrás das costas do painel (o espaço
  // da mão-francesa, quando ela vai no palco) e vai 'prof' pra frente; com o painel no
  // chão, fica atrás dele e da mão-francesa. Sem 'prof': 1,5 m na frente da tela / 2 m.
  // Praticável = tampo + pés a cada 1 m; fechado = bloco com saia.
  let frenteZ=0, palcoZ1=0;
  const PZ0=palcoZ(c,zTras);
  if(PZ0){ palcoZ1=PZ0.z1; if(c.palco.painelEmCima) frenteZ=PZ0.z1; fazPalco(peca,c.palco,PZ0.z0,PZ0.z1); }
  const areas=PZ0?[{x:c.palco.x, z:(PZ0.z0+PZ0.z1)/2, w:c.palco.w, d:PZ0.z1-PZ0.z0, h:c.palco.h}]:[];
  /* estrutura de apoio atrás do painel, no molde do Vectorworks (a regra vem do app, ver
     regraEstrutura): em cada apoio, quadros retangulares de tubo 4×4 cm de pé, com
     'prof' de fundo a partir das costas do painel, empilhados de onde ela apoia (o palco
     ou o chão) pra cima; os pesos (24 × 45 cm) encaixados no tubo de baixo, no meio do fundo */
  if(c.estrutura){
    const E=c.estrutura, t=0.04, zF=-D, zT=-D-E.prof, zc=(zF+zT)/2, MF=peca('MaoFrancesa','pe'), PZ=peca('Pesos','peso');
    let mf, pz;
    const quadro=(x,ya,yb)=>{
      caixa(mf,x-t/2,ya,zF-t,x+t/2,yb,zF);                                     // montante da frente, nas costas do painel
      caixa(mf,x-t/2,ya,zT,x+t/2,yb,zT+t);                                     // montante de trás
      caixa(mf,x-t/2,ya,zT+t,x+t/2,ya+t,zF-t);                                 // tubo de baixo
      caixa(mf,x-t/2,yb-t,zT+t,x+t/2,yb,zF-t);                                 // tubo de cima
    };
    // a pilha de cada fileira: a que o app já decidiu (porApoio, nas Múltiplas) ou a de onde o pé cai
    const onde=E.porApoio?null:mfOnde(c,{P,nc,gw,CV,D,zTras});
    E.apoios.forEach((ax,k)=>{
      const pi=E.porApoio?E.porApoio[k]:onde?E[onde[k]]:E; if(!pi) return;     // sem pilha que caiba ali: sem fileira
      const y0=E.porApoio||onde?pi.base:(E.base!=null?E.base:P.base);
      mf=malha(); pz=malha(); const x=0; let y=y0;
      pi.modulos.forEach(m=>{ const hq=m.h/m.quadros; for(let i=0;i<m.quadros;i++){ quadro(x,y,y+hq); y+=hq; } });
      /* Painel de LED (Projetech): segunda linha — a 1,92 da base dobrada para trás, mais um quadro de 'prof'
         de fundo encostado atrás do primeiro (painel alto: base com o dobro de fundo) */
      if(E.segunda&&pi.modulos[0]&&pi.modulos[0].h>=1.9){
        const zF2=zT, zT2=zT-E.prof, hq=pi.modulos[0].h/pi.modulos[0].quadros;
        for(let i=0;i<pi.modulos[0].quadros;i++){ const ya=y0+i*hq, yb=ya+hq;
          caixa(mf,x-t/2,ya,zT2,x+t/2,yb,zT2+t); caixa(mf,x-t/2,ya,zT2+t,x+t/2,ya+t,zF2); caixa(mf,x-t/2,yb-t,zT2+t,x+t/2,yb,zF2); }
      }
      for(let i=0;i<pi.pesos;i++){ const yb=y0+i*0.101;                          // empilhados de 10,1 em 10,1 cm, como no molde
        caixa(pz,x-0.12,yb,zc-0.225,x+0.12,yb+0.09,zc+0.225);                  // a placa
        caixa(pz,x-0.05,yb+0.09,zc-0.215,x+0.05,yb+0.101,zc+0.215); }          // a nervura de cima
      const T=mfLugar(ax,{P,nc,gw,CV});
      poe(MF,T,mf); poe(PZ,T,pz);
    });
  }
  fazPessoa(peca,c,frenteZ,palcoZ1,areas);
  return pecas;
}
// pessoa de referência: o técnico da Montagem, de costas pra plateia (olhando o painel)
/* palcos onde a pessoa pode pisar: {x, z (centro), w, d, a (giro, rad), h}. Com a posição escolhida
   (pessoa.z), ela sobe no mais alto que estiver embaixo dela; fora de todos, fica no chão */
const pisaEm=(areas,x,z)=>(areas||[]).reduce((h,A)=>{ const dx=x-A.x, dz=z-A.z, co=Math.cos(A.a||0), si=Math.sin(A.a||0);
  return Math.abs(co*dx-si*dz)<=A.w/2+1e-6&&Math.abs(si*dx+co*dz)<=A.d/2+1e-6?Math.max(h,A.h):h; },0);
let pessoaUlt=null;                                       // onde a pessoa ficou na última cena (o app mostra no campo)
function fazPessoa(peca,c,frenteZ,palcoZ1,areas){
  pessoaUlt=null;
  if(c.pessoa && c.pessoa.h>0){
    const H=c.pessoa.h, x=c.pessoa.x;
    if(c.pessoa.z!=null&&isFinite(c.pessoa.z)){            // escolhida nos campos: x, z e a altura de onde pisa
      const z=+c.pessoa.z, y0=pisaEm(areas,x,z); pessoaUlt={x,z,y0,auto:false};
      pessoa3d(peca,{x, y0, z, k:H/1.75, mulher:c.pessoa.mulher!==false, logo:!!LOGO_COSTAS}); return; }
    // no palco: na frente do painel (painel em cima) ou atrás dele (palco atrás do painel);
    // no chão: na frente de tudo. Palco raso demais na frente do painel: ela desce pro chão
    let emCima=!!(c.pessoa.emCima&&c.palco), z;
    if(emCima&&c.palco.painelEmCima){ z=Math.min(0.75,frenteZ-0.3); if(z<0.3) emCima=false; }
    else if(emCima) z=Math.min(-1.1,palcoZ1-0.5);
    if(!emCima) z=frenteZ>0?frenteZ+0.6:1.0;
    if(c.pessoa.xFixo){ const y0=pisaEm(areas,x,z); pessoaUlt={x,z,y0,auto:true};   // X digitado: pisa no que estiver embaixo dela
      pessoa3d(peca,{x, y0, z, k:H/1.75, mulher:c.pessoa.mulher!==false, logo:!!LOGO_COSTAS}); return; }
    pessoaUlt={x, z, y0:emCima?c.palco.h:0, auto:true};
    pessoa3d(peca,{x, y0:emCima?c.palco.h:0, z, k:H/1.75, mulher:c.pessoa.mulher!==false, logo:!!LOGO_COSTAS});
  }
}
/* várias telas no mesmo palco (Múltiplas screens): cada tela é montada como a screen única
   (placas, curvatura, mão-francesa) e levada pro seu lugar — x, recuo (z) e giro —; o palco
   e a pessoa entram uma vez só. Todas usam a mesma imagem (a composição), cada uma com o
   seu pedaço (painel.uv).
   cena = { painel:{img,quadros,fps,w,h}, telas:[{painel:{w,h,base,placa,curva,uv}, estrutura,
            x, z, giro (graus), incl (graus, + o topo pra plateia), noPalco}], palco, palcos:[{w,prof,h,x,z (centro),giro,fechado}], pessoa, apoio } */
function montaCenaMulti(c){
  const pecas=[], peca=(nome,mat)=>{ const m=malha(); pecas.push({nome,mat,m}); return m; };
  let zPainel=0, zPalco=0, xMin=Infinity, xMax=-Infinity;
  c.telas.forEach((t,i)=>{
    const sub=montaCena({painel:Object.assign({},t.painel,{x:0,img:c.painel.img,quadros:c.painel.quadros}), apoio:c.apoio&&!t.semApoio, estrutura:t.estrutura});   // "Sem" mão-francesa: sem pés de apoio também
    const T={x:t.x||0, z:t.z||0, a:(t.giro||0)*Math.PI/180}, co=Math.cos(T.a), si=Math.sin(T.a), pre='S'+(i+1)+'_';
    // inclinação: a screen inteira tomba em torno da linha de baixo da frente (+ o topo vem pra plateia)
    const inc=(t.incl||0)*Math.PI/180, ci=Math.cos(inc), sn=Math.sin(inc), yb=t.painel.base||0;
    const tomba=v=>[v[0], yb+(v[1]-yb)*ci-v[2]*sn, v[2]*ci+(v[1]-yb)*sn];
    sub.forEach(p=>{
      if(p.grupo){                                    // placa inclinada: [x, y, z, giro dela, inclinação, giro da screen]
        pecas.push({nome:pre+p.nome, mat:null, m:malha(), grupo:{proto:p.grupo.proto,
          pos:p.grupo.pos.map(q=>{ const v=inc?tomba(q):q, b=[T.x+co*v[0]+si*v[2], v[1], T.z-si*v[0]+co*v[2]];
            return inc?b.concat([q[3]||0, inc, T.a]):b.concat([(q[3]||0)+T.a]); })}});
        return; }
      const src=inc?{pts:p.m.pts.map(tomba), nrm:p.m.nrm.map(n=>[n[0], n[1]*ci-n[2]*sn, n[2]*ci+n[1]*sn]), st:p.m.st, idx:p.m.idx, temSt:p.m.temSt}:p.m;
      const m=malha(); poe(m,T,src); pecas.push(Object.assign({},p,{nome:pre+p.nome, m}));
      const estr=p.nome==='MaoFrancesa'||p.nome==='Pesos';
      m.pts.forEach(v=>{ xMin=Math.min(xMin,v[0]); xMax=Math.max(xMax,v[0]);
        if(!estr) zPainel=Math.min(zPainel,v[2]-0.09);                       // a frente do painel menos as costas
        if(t.noPalco&&(!estr||t.estrutura&&t.estrutura.noPalco)) zPalco=Math.min(zPalco,v[2]-(estr?0.1:0.09)); });
    });
  });
  let frenteZ=0, palcoZ1=0; const areas=[];
  if(c.palco&&c.palco.h>0){
    const S=Object.assign({},c.palco);
    if(!(S.w>0)){ S.w=xMax-xMin; S.x=(xMin+xMax)/2; }                       // em branco: cobre todas as telas
    let z0, z1;
    if(S.livre){                                                            // solto na planta: montado no centro, levado pro lugar e giro dele
      const loc=[], pk=(nome,mat)=>{ const m=malha(); loc.push({nome,mat,m}); return m; }, d=S.prof>0?S.prof:2, zc=S.z0+d/2;
      fazPalco(pk,{w:S.w, h:S.h, x:0, fechado:S.fechado},-d/2,d/2);
      const T={x:S.x, z:zc, a:(S.giro||0)*Math.PI/180}; loc.forEach(p=>poe(peca(p.nome,p.mat),T,p.m));
      frenteZ=palcoZ1=zc+d/2; areas.push({x:S.x, z:zc, w:S.w, d, a:T.a, h:S.h});
    }
    else{
    if(S.painelEmCima&&S.z0!=null){ z0=S.z0; z1=z0+(S.prof>0?S.prof:2); frenteZ=z1; }   // palco fixo: as screens se posicionam nele
    else if(S.painelEmCima){ z0=zPalco; z1=S.prof>0?Math.max(z0+S.prof,0.02):1.5; frenteZ=z1; }
    else{ const temMF=c.telas.some(t=>t.estrutura); z1=zPainel-(temMF?0.6+0.3:0.05); z0=z1-(S.prof>0?S.prof:2.0); }
    palcoZ1=z1;
    fazPalco(peca,S,z0,z1); areas.push({x:S.x, z:(z0+z1)/2, w:S.w, d:z1-z0, h:S.h});
    }
  }
  // os palcos a mais: cada um montado no centro e levado pro seu lugar e giro
  (c.palcos||[]).forEach((S2,i)=>{
    const loc=[], pk=(nome,mat)=>{ const m=malha(); loc.push({nome,mat,m}); return m; };
    fazPalco(pk,{w:S2.w, h:S2.h, x:0, fechado:S2.fechado},-S2.prof/2,S2.prof/2);
    const T={x:S2.x, z:S2.z, a:(S2.giro||0)*Math.PI/180};
    loc.forEach(p=>poe(peca('P'+(i+2)+'_'+p.nome,p.mat),T,p.m));
    areas.push({x:S2.x, z:S2.z, w:S2.w, d:S2.prof, a:T.a, h:S2.h});
  });
  fazPessoa(peca,c,frenteZ,palcoZ1,areas);
  if(c.chao&&c.chao.img&&c.chao.cantos){                 // a planta do local, no chão (cantos: TL, TR, BR, BL da imagem)
    const [tl,tr,br,bl]=c.chao.cantos, y=0.004, m=peca('Planta','planta'); m.temSt=true;
    quad(m,[bl[0],y,bl[1]],[br[0],y,br[1]],[tr[0],y,tr[1]],[tl[0],y,tl[1]],[0,1,0],[[0,0],[1,0],[1,1],[0,1]]); }
  return pecas;
}

const monta=c=>c.telas?montaCenaMulti(c):montaCena(c);   // uma tela ou várias

/* ---------- USDA (texto) ---------- */
const fm=v=>{ const r=Math.round(v*1e5)/1e5; return Object.is(r,-0)?'0':String(r); };
const v3=a=>`(${fm(a[0])}, ${fm(a[1])}, ${fm(a[2])})`, v2=a=>`(${fm(a[0])}, ${fm(a[1])})`;
function usdaMalha(p,raiz){
  const m=p.m, n=m.idx.length/3;
  return `
			def Mesh "${p.nome}" (
				prepend apiSchemas = ["MaterialBindingAPI"]
			)
			{
				int[] faceVertexCounts = [${new Array(n).fill(3).join(', ')}]
				int[] faceVertexIndices = [${m.idx.join(', ')}]
				normal3f[] normals = [${m.nrm.map(v3).join(', ')}] (
					interpolation = "vertex"
				)
				point3f[] points = [${m.pts.map(v3).join(', ')}]
${m.temSt?`				texCoord2f[] primvars:st = [${m.st.map(v2).join(', ')}] (
					interpolation = "vertex"
				)
`:''}				uniform token subdivisionScheme = "none"
				rel material:binding = <${raiz||'/Root/Materials'}/${p.mat}>
			}
`;
}
function usdaMaterial(nome,o,raiz){
  const base=`${raiz||'/Root/Materials'}/${nome}`;
  const tex=o.tex?`
			def Shader "Leitor"
			{
				uniform token info:id = "UsdPrimvarReader_float2"
				float2 inputs:fallback = (0.0, 0.0)
				token inputs:varname = "st"
				float2 outputs:result
			}

			def Shader "Transform2d"
			{
				uniform token info:id = "UsdTransform2d"
				token inputs:in.connect = <${base}/Leitor.outputs:result>
				float inputs:rotation = 0
				float2 inputs:scale = (1, 1)
				float2 inputs:translation = (0, 0)
				float2 outputs:result
			}

			def Shader "Textura"
			{
				uniform token info:id = "UsdUVTexture"
				asset inputs:file = @${o.tex}@
				float2 inputs:st.connect = <${base}/Transform2d.outputs:result>
				token inputs:sourceColorSpace = "sRGB"
				token inputs:wrapS = "clamp"
				token inputs:wrapT = "clamp"
				float outputs:r
				float outputs:g
				float outputs:b
				float outputs:a
				float3 outputs:rgb
			}
`:'';
  const cor=o.tex&&o.emissivo?`color3f inputs:diffuseColor = (0, 0, 0)
					color3f inputs:emissiveColor.connect = <${base}/Textura.outputs:rgb>`
          :o.tex?`color3f inputs:diffuseColor.connect = <${base}/Textura.outputs:rgb>`
          :o.luz?`color3f inputs:diffuseColor = ${v3(o.cor)}
					color3f inputs:emissiveColor = ${v3(o.luz)}`
          :`color3f inputs:diffuseColor = ${v3(o.cor)}`;
  return `
		def Material "${nome}"
		{
			def Shader "PreviewSurface"
			{
				uniform token info:id = "UsdPreviewSurface"
					${cor}
				float inputs:roughness = ${fm(o.rug==null?0.8:o.rug)}
				float inputs:metallic = ${fm(o.metal||0)}
				${o.alfa?`float inputs:opacity.connect = <${base}/Textura.outputs:a>`:'float inputs:opacity = 1'}
				int inputs:useSpecularWorkflow = 0
				token outputs:surface
			}

			token outputs:surface.connect = <${base}/PreviewSurface.outputs:surface>
${tex}		}
`;
}
/* o efeito em quadros, à moda de um folioscópio: o AR do iPhone não toca vídeo dentro do
   arquivo, mas toca animação. Todas as telas ficam no mesmo lugar e a do quadro da vez
   anda 2 mm pra frente no seu instante [k, k+1): quem está na frente é quem aparece.
   Andar pra frente (e não encolher) não deixa defeito nenhum se o iPhone interpolar entre
   as amostras — no pior caso a troca acontece meio quadro antes. As amostras coladas (ε)
   fazem a troca seca. */
function usdaQuadro(p,n){
  const k=p.quadro, e=0.0001, sim='(0, 0, 0.002)', nao='(0, 0, 0)', a=[`0: ${k===0?sim:nao}`];
  if(k>0) a.push(`${fm(k-e)}: ${nao}`, `${k}: ${sim}`);
  if(k<n-1) a.push(`${fm(k+1-e)}: ${sim}`, `${k+1}: ${nao}`, `${n}: ${nao}`); else a.push(`${n}: ${sim}`);
  return `
			def Xform "${p.nome}_quadro"
			{
				double3 xformOp:translate.timeSamples = { ${a.join(', ')} }
				uniform token[] xformOpOrder = ["xformOp:translate"]
${usdaMalha(p)}			}
`;
}
/* peças repetidas (as placas por trás): a peça é escrita uma vez, num arquivo à parte dentro
   do USDZ (prototipos.usda), com os materiais dentro dela — assim cada referência leva os
   seus; cada placa da cena é só uma referência a ela com a posição. É o mesmo jeito do
   exportador do three.js (referência a outro arquivo do pacote), que o AR do iPhone abre. */
const PROTOS='prototipos.usda';
function usdaGrupo(p){
  const g=p.grupo, alvo=`@./${PROTOS}@</${g.proto.nome}>`;
  return `
			def Xform "${p.nome}"
			{${g.pos.map((q,i)=>`
				def Xform "${p.nome}_${String(i).padStart(4,'0')}" (
					prepend references = ${alvo}
				)
				{
					double3 xformOp:translate = ${v3(q)}${q[4]?`
					float xformOp:rotateY:giro = ${fm((q[5]||0)*180/Math.PI)}
					float xformOp:rotateX = ${fm(q[4]*180/Math.PI)}
					float xformOp:rotateY = ${fm((q[3]||0)*180/Math.PI)}
					uniform token[] xformOpOrder = ["xformOp:translate", "xformOp:rotateY:giro", "xformOp:rotateX", "xformOp:rotateY"]`:q[3]?`
					float xformOp:rotateY = ${fm(q[3]*180/Math.PI)}
					uniform token[] xformOpOrder = ["xformOp:translate", "xformOp:rotateY"]`:`
					uniform token[] xformOpOrder = ["xformOp:translate"]`}
				}`).join('')}
			}
`;
}
/* o LED aceso piscando (e o brilho dele): encolhe a quase zero, em volta do próprio meio, na metade
   apagada; as amostras coladas (ε) fazem a troca seca, como nos quadros do efeito. Está no
   protótipo: todas as placas juntas */
function usdaLed(q,R,anim){
  const h=anim.fps*LED_MEIO, e=0.0001, sim='(1, 1, 1)', nao='(0.0001, 0.0001, 0.0001)', a=[`0: ${sim}`];
  for(let k=1;k*h<=anim.n+1e-9;k++) a.push(`${fm(k*h-e)}: ${k%2?sim:nao}`, `${fm(k*h)}: ${k%2?nao:sim}`);
  const P=q.m.pts, c=[0,1,2].map(i=>(Math.min(...P.map(p=>p[i]))+Math.max(...P.map(p=>p[i])))/2);
  const m=Object.assign({},q.m,{pts:P.map(p=>[p[0]-c[0],p[1]-c[1],p[2]-c[2]])});
  return `
	def Xform "${q.nome}_pisca"
	{
		double3 xformOp:translate = ${v3(c)}
		float3 xformOp:scale.timeSamples = { ${a.join(', ')} }
		uniform token[] xformOpOrder = ["xformOp:translate", "xformOp:scale"]
${usdaMalha(Object.assign({},q,{m}),R)}	}
`;
}
const ehLed=mat=>mat==='gab_led_on'||mat==='gab_led_halo';
function usdaPrototipos(grupos,mats,anim){
  const vistos=new Set(), protos=grupos.map(p=>p.grupo.proto).filter(pr=>!vistos.has(pr.nome)&&vistos.add(pr.nome));
  return `#usda 1.0
(
	defaultPrim = "${protos[0].nome}"
	metersPerUnit = 1
	upAxis = "Y"${anim?`
	startTimeCode = 0
	endTimeCode = ${anim.n}
	timeCodesPerSecond = ${fm(anim.fps)}
	framesPerSecond = ${fm(anim.fps)}`:''}
)
${protos.map(pr=>{ const R=`/${pr.nome}/Materiais`, partes=pr.partes.filter(q=>q.m.idx.length);
    return `
def Xform "${pr.nome}"
{${partes.map(q=>ehLed(q.mat)&&anim?usdaLed(q,R,anim):usdaMalha(q,R)).join('')}
	def Scope "Materiais"
	{${[...new Set(partes.map(q=>q.mat))].map(k=>usdaMaterial(k,mats[k],R)).join('')}
	}
}
`; }).join('')}`;
}
// anim = {n, fps}: os quadros do efeito, em loop
function usda(pecas,mats,anim){
  const grupos=pecas.filter(p=>p.grupo&&p.grupo.pos.length);
  return `#usda 1.0
(
	customLayerData = {
		string creator = "Projetech Calculator"
	}
	defaultPrim = "Root"
	metersPerUnit = 1
	upAxis = "Y"${anim?`
	startTimeCode = 0
	endTimeCode = ${anim.n}
	timeCodesPerSecond = ${fm(anim.fps)}
	framesPerSecond = ${fm(anim.fps)}`:''}
)

def Xform "Root"
{
	def Scope "Scenes" (
		kind = "sceneLibrary"
	)
	{
		def Xform "Scene" (
			customData = {
				bool preliminary_collidesWithEnvironment = 0
				string sceneName = "Scene"
			}
			sceneName = "Scene"
		)
		{
			token preliminary:anchoring:type = "plane"
			token preliminary:planeAnchoring:alignment = "horizontal"
${pecas.filter(p=>p.m.idx.length).map(p=>p.quadro!=null&&anim?usdaQuadro(p,anim.n):usdaMalha(p)).join('')}${grupos.map(usdaGrupo).join('')}
		}
	}

	def Scope "Materials"
	{${Object.keys(mats).map(k=>usdaMaterial(k,mats[k])).join('')}
	}
}
`;
}

/* ---------- zip sem compressão, cada arquivo com os dados em múltiplo de 64 bytes ---------- */
const CRC=(()=>{ const t=new Uint32Array(256); for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c=c&1?0xEDB88320^(c>>>1):c>>>1; t[n]=c>>>0; } return t; })();
function crc32(u){ let c=0xFFFFFFFF; for(let i=0;i<u.length;i++) c=CRC[(c^u[i])&255]^(c>>>8); return (c^0xFFFFFFFF)>>>0; }
function zip(arqs){
  const enc=new TextEncoder(), partes=[], centrais=[]; let pos=0;
  for(const a of arqs){
    const nome=enc.encode(a.nome), dados=a.dados, crc=crc32(dados);
    // alinhamento exigido pelo USDZ: um campo "extra" de enchimento (id 12345, como o three.js faz)
    let extra=(64-((pos+30+nome.length)%64))%64; if(extra>0&&extra<4) extra+=64;
    const h=new DataView(new ArrayBuffer(30+nome.length+extra));
    h.setUint32(0,0x04034b50,true); h.setUint16(4,20,true); h.setUint16(6,0,true); h.setUint16(8,0,true);
    h.setUint16(10,0,true); h.setUint16(12,0x21,true); h.setUint32(14,crc,true); h.setUint32(18,dados.length,true); h.setUint32(22,dados.length,true);
    h.setUint16(26,nome.length,true); h.setUint16(28,extra,true); new Uint8Array(h.buffer).set(nome,30);
    if(extra){ h.setUint16(30+nome.length,12345,true); h.setUint16(32+nome.length,extra-4,true); }
    partes.push(new Uint8Array(h.buffer),dados);
    const c=new DataView(new ArrayBuffer(46+nome.length));
    c.setUint32(0,0x02014b50,true); c.setUint16(4,20,true); c.setUint16(6,20,true); c.setUint16(8,0,true); c.setUint16(10,0,true);
    c.setUint16(12,0,true); c.setUint16(14,0x21,true); c.setUint32(16,crc,true); c.setUint32(20,dados.length,true); c.setUint32(24,dados.length,true);
    c.setUint16(28,nome.length,true); c.setUint32(42,pos,true); new Uint8Array(c.buffer).set(nome,46);
    centrais.push(new Uint8Array(c.buffer));
    pos+=30+nome.length+extra+dados.length;
  }
  const tamCentral=centrais.reduce((s,u)=>s+u.length,0), fim=new DataView(new ArrayBuffer(22));
  fim.setUint32(0,0x06054b50,true); fim.setUint16(8,arqs.length,true); fim.setUint16(10,arqs.length,true);
  fim.setUint32(12,tamCentral,true); fim.setUint32(16,pos,true);
  const out=new Uint8Array(pos+tamCentral+22); let o=0;
  for(const u of [...partes,...centrais,new Uint8Array(fim.buffer)]){ out.set(u,o); o+=u.length; }
  return out;
}

/* ---------- USDZ ---------- */
function jpeg(cv,lado,q){                              // a imagem da tela, até 2048 px no lado maior
  const s=Math.min(1,(lado||2048)/Math.max(cv.width,cv.height)), c=document.createElement('canvas');
  c.width=Math.max(1,Math.round(cv.width*s)); c.height=Math.max(1,Math.round(cv.height*s));
  const x=c.getContext('2d'); x.imageSmoothingQuality='high'; x.drawImage(cv,0,0,c.width,c.height);
  return new Promise((ok,erro)=>c.toBlob(b=>b?b.arrayBuffer().then(a=>ok(new Uint8Array(a))):erro(new Error('não deu pra gerar a imagem do painel')),'image/jpeg',q||0.9));
}
async function usdz(cena){
  await logoPronto;                                      // o símbolo das costas entra junto, se carregou
  const pecas=monta(cena);
  const mats={ tela:{tex:'textures/painel.jpg',emissivo:true,rug:0.6}, corpo:{cor:COR.corpo,rug:0.7,metal:0.3},
    tampo:{cor:COR.tampo,rug:0.95}, pe:{cor:COR.pe,rug:0.4,metal:0.8}, saia:{cor:COR.saia,rug:1},
    calca:{cor:COR.calca,rug:0.9}, camisa:{cor:COR.camisa,rug:0.9}, pele:{cor:COR.pele,rug:0.6}, bota:{cor:COR.bota,rug:0.5},
    sola:{cor:COR.sola,rug:0.9}, luva:{cor:COR.luva,rug:0.85}, capacete:{cor:COR.capacete,rug:0.35}, capaceteB:{cor:COR.capaceteB,rug:0.35},
    cabelo:{cor:COR.cabelo,rug:0.7}, cabeloF:{cor:COR.cabeloF,rug:0.7}, elastico:{cor:COR.elastico,rug:0.6}, catraca:{cor:COR.catraca,rug:0.5},
    logo:{tex:'textures/logo.jpg',rug:0.9}, peso:{cor:COR.peso,rug:0.6,metal:0.5}, planta:{tex:'textures/planta.jpg',rug:1} };
  // efeito em quadros: uma textura por quadro, em até 1024 px (são muitas); cada quadro pode
  // vir pronto em JPEG (Uint8Array) — no iPhone, guardar dezenas de canvas estoura a memória
  const Q=cena.painel.quadros&&cena.painel.quadros.length>1?cena.painel.quadros:null, nq=k=>'textures/quadro'+String(k).padStart(2,'0')+'.jpg';
  if(Q) Q.forEach((_,k)=>{ mats['tela'+k]={tex:nq(k),emissivo:true,rug:0.6}; });
  const usados={}; pecas.forEach(p=>{ if(p.m.idx.length) usados[p.mat]=mats[p.mat]; });
  // a animação: os quadros do efeito; sem efeito, com placas, 1 s em loop só pro LED piscar
  const grupos=pecas.filter(p=>p.grupo&&p.grupo.pos.length);
  const anim=Q?{n:Q.length,fps:cena.painel.fps||12}:grupos.length?{n:24,fps:24}:null;
  const texto=new TextEncoder().encode(usda(pecas,usados,anim));
  const arqs=[{nome:'model.usda',dados:texto}];                 // o model.usda tem que ser o primeiro do pacote
  if(grupos.length){ arqs.push({nome:PROTOS,dados:new TextEncoder().encode(usdaPrototipos(grupos,MAT_GAB,anim))});
    if(grupos.some(p=>p.grupo.proto.partes.some(q=>q.mat==='gab_led_halo'&&q.m.idx.length))) arqs.push({nome:MAT_GAB.gab_led_halo.tex,dados:await pngBrilho()}); }
  if(Q) for(let k=0;k<Q.length;k++) arqs.push({nome:nq(k),dados:Q[k] instanceof Uint8Array?Q[k]:await jpeg(Q[k],1024,0.82)});   // já em JPEG ou canvas
  else arqs.push({nome:'textures/painel.jpg',dados:await jpeg(cena.painel.img)});
  if(usados.logo) arqs.push({nome:'textures/logo.jpg',dados:await jpeg(LOGO_COSTAS)});
  if(usados.planta&&cena.chao&&cena.chao.img) arqs.push({nome:'textures/planta.jpg',dados:await jpeg(cena.chao.img,2048,0.8)});
  const placa=pecas.find(p=>p.grupo&&p.grupo.proto.tex);            // o fundo dos módulos das placas
  if(placa) arqs.push({nome:MAT_GAB.gab_fundo.tex,dados:await jpeg(placa.grupo.proto.tex,1024,0.85)});
  return new Blob([zip(arqs)],{type:'model/vnd.usdz+zip'});
}

/* ---------- GLB (glTF 2.0 binário): o AR do Android ----------
   A mesma cena do USDZ (monta), em metros, y pra cima. As placas por trás (grupo) viram um
   mesh só, repetido em nós (translação + giro), como o protótipo do USD. A tela é emissiva
   (acesa); com efeito em quadros, vai o primeiro (o glTF do AR não troca textura). As
   coordenadas de textura do app têm v pra cima: no glTF v cresce pra baixo. */
async function glb(cena){
  await logoPronto;
  const pecas=monta(cena), partes=[], views=[], accs=[], meshes=[], nodes=[], mats=[], texs=[], imgs=[];
  let off=0;
  const vista=(u8,alvo)=>{ const pad=(4-off%4)%4; if(pad){ partes.push(new Uint8Array(pad)); off+=pad; }
    partes.push(u8); views.push(Object.assign({buffer:0,byteOffset:off,byteLength:u8.byteLength},alvo?{target:alvo}:{})); off+=u8.byteLength; return views.length-1; };
  const acc=(arr,tipo,comp,n,extra)=>{ accs.push(Object.assign({bufferView:vista(new Uint8Array(arr.buffer),comp===5125?34963:34962),componentType:comp,count:n,type:tipo},extra||{})); return accs.length-1; };
  const texDe=async(fonte,lado,q)=>{ if(!fonte) return null; const d=fonte instanceof Uint8Array?fonte:await jpeg(fonte,lado||2048,q||0.88);
    imgs.push({bufferView:vista(d),mimeType:'image/jpeg'}); texs.push({source:imgs.length-1,sampler:0}); return texs.length-1; };
  const Q=cena.painel.quadros&&cena.painel.quadros.length>1?cena.painel.quadros:null;
  const matDe={}; let usaUnlit=false;
  async function material(mat,proto){
    if(mat in matDe) return matDe[mat];
    let m;
    if(String(mat).startsWith('tela')){ const t=await texDe(Q?Q[0]:cena.painel.img);   // LED aceso: sem luz em cima (unlit); quem não lê o unlit usa o emissivo
      m={pbrMetallicRoughness:{baseColorTexture:{index:t},metallicFactor:0,roughnessFactor:1},emissiveTexture:{index:t},emissiveFactor:[1,1,1],extensions:{KHR_materials_unlit:{}}}; usaUnlit=true; }
    else if(mat==='logo'&&LOGO_COSTAS){ const t=await texDe(LOGO_COSTAS,512); m={pbrMetallicRoughness:{baseColorTexture:{index:t},metallicFactor:0,roughnessFactor:0.9}}; }
    else if(mat==='planta'&&cena.chao&&cena.chao.img){ const t=await texDe(cena.chao.img,2048,0.8); m={pbrMetallicRoughness:{baseColorTexture:{index:t},metallicFactor:0,roughnessFactor:1}}; }
    else if(mat==='gab_fundo'&&proto&&proto.tex){ const t=await texDe(proto.tex,1024,0.85); m={pbrMetallicRoughness:{baseColorTexture:{index:t},metallicFactor:0.1,roughnessFactor:0.7}}; }
    else if(mat==='gab_led_on'){ const c=COR.gab_led_on;                // o LED aceso: sem luz em cima, como a tela
      m={pbrMetallicRoughness:{baseColorFactor:[c[0],c[1],c[2],1],metallicFactor:0,roughnessFactor:1},emissiveFactor:c,extensions:{KHR_materials_unlit:{}}}; usaUnlit=true; }
    else if(mat==='gab_led_halo'){                                        // o brilho dele: o PNG redondo, transparente nas bordas
      imgs.push({bufferView:vista(await pngBrilho()),mimeType:'image/png'}); texs.push({source:imgs.length-1,sampler:0}); const t=texs.length-1;
      m={pbrMetallicRoughness:{baseColorTexture:{index:t},metallicFactor:0,roughnessFactor:1},emissiveTexture:{index:t},emissiveFactor:[1,1,1],alphaMode:'BLEND',extensions:{KHR_materials_unlit:{}}}; usaUnlit=true; }
    else{ const g=MAT_GAB[mat], c=(g&&g.cor)||COR[mat]||[0.3,0.3,0.3];
      m={pbrMetallicRoughness:{baseColorFactor:[c[0],c[1],c[2],1],metallicFactor:(g&&g.metal)||0,roughnessFactor:(g&&g.rug)||0.8}}; }
    m.name=String(mat); m.doubleSided=true; mats.push(m); return matDe[mat]=mats.length-1;
  }
  function primitiva(mm,matI,frente){
    const n=mm.pts.length, P=new Float32Array(n*3), N=new Float32Array(n*3), T=new Float32Array(n*2), I=new Uint32Array(mm.idx);
    const mn=[1e9,1e9,1e9], mx=[-1e9,-1e9,-1e9];
    mm.pts.forEach((v,i)=>{ const q=mm.nrm[i]||[0,0,0], d=frente||0;          // frente: a tela sai uns mm da placa (o AR tem menos precisão de profundidade)
      for(let k=0;k<3;k++){ P[i*3+k]=v[k]+q[k]*d; mn[k]=Math.min(mn[k],P[i*3+k]); mx[k]=Math.max(mx[k],P[i*3+k]); } });
    mm.nrm.forEach((v,i)=>{ const l=Math.hypot(v[0],v[1],v[2])||1; N[i*3]=v[0]/l; N[i*3+1]=v[1]/l; N[i*3+2]=v[2]/l; });
    mm.st.forEach((v,i)=>{ T[i*2]=v[0]; T[i*2+1]=1-v[1]; });
    return {attributes:{POSITION:acc(P,'VEC3',5126,n,{min:mn,max:mx}),NORMAL:acc(N,'VEC3',5126,n),TEXCOORD_0:acc(T,'VEC2',5126,n)},indices:acc(I,'SCALAR',5125,I.length),material:matI};
  }
  const filhos=[], leds=[], qY=a=>[0,Math.sin(a/2),0,Math.cos(a/2)], qX=a=>[Math.sin(a/2),0,0,Math.cos(a/2)];
  const qMul=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1], a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0], a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3], a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
  for(const p of pecas){
    if(p.quadro>0) continue;                                         // efeito: só o primeiro quadro
    if(p.grupo&&p.grupo.pos.length){
      // o LED aceso vai num mesh à parte, filho de cada placa: a animação encolhe ele a zero na metade apagada
      const prims=[], led=[]; for(const pt of p.grupo.proto.partes){ if(!pt.m.idx.length) continue; (ehLed(pt.mat)?led:prims).push(primitiva(pt.m,await material(pt.mat,p.grupo.proto))); }
      if(!prims.length) continue; meshes.push({name:p.nome,primitives:prims}); const mi=meshes.length-1;
      let ml=null; if(led.length){ meshes.push({name:p.nome+'_Led',primitives:led}); ml=meshes.length-1; }
      /* cada nó com nome próprio: o three.js (model-viewer) liga a animação pelo nome, e sem nome as
         placas e os LEDs ganhavam o mesmo ("_instance_N") — o LED apagava a placa inteira */
      p.grupo.pos.forEach((q,i)=>{ const r=q.length>4?qMul(qMul(qY(q[5]||0),qX(q[4]||0)),qY(q[3]||0)):qY(q[3]||0);   // o shader: gira y (placa), x (inclinação), y (screen)
        const k=String(i).padStart(4,'0'), no={name:p.nome+'_'+k,mesh:mi,translation:[q[0],q[1],q[2]],rotation:r};
        if(ml!=null){ nodes.push({name:p.nome+'_Led_'+k,mesh:ml}); leds.push(nodes.length-1); no.children=[nodes.length-1]; }
        nodes.push(no); filhos.push(nodes.length-1); });
      continue; }
    if(!p.m.idx.length) continue;
    meshes.push({name:p.nome,primitives:[primitiva(p.m,await material(p.mat),String(p.mat).startsWith('tela')?0.004:0)]}); nodes.push({name:p.nome,mesh:meshes.length-1}); filhos.push(nodes.length-1);
  }
  nodes.push({name:'Projetech',children:filhos});
  const json={asset:{version:'2.0',generator:'Projetech Calculator'},scene:0,scenes:[{nodes:[nodes.length-1]}],nodes,meshes,materials:mats,accessors:accs,bufferViews:views,buffers:[{byteLength:0}]};
  if(usaUnlit) json.extensionsUsed=['KHR_materials_unlit'];
  if(leds.length){                                                   // o LED piscando: aceso, apagado (escala 0), aceso — em loop, todas juntas
    const T=new Float32Array([0,LED_MEIO,2*LED_MEIO]), S=new Float32Array([1,1,1, 0,0,0, 1,1,1]);
    accs.push({bufferView:vista(new Uint8Array(T.buffer)),componentType:5126,count:3,type:'SCALAR',min:[0],max:[2*LED_MEIO]});
    accs.push({bufferView:vista(new Uint8Array(S.buffer)),componentType:5126,count:3,type:'VEC3'});
    json.animations=[{name:'LED',samplers:[{input:accs.length-2,output:accs.length-1,interpolation:'STEP'}],
      channels:leds.map(n=>({sampler:0,target:{node:n,path:'scale'}}))}];
  }
  if(texs.length){ json.textures=texs; json.images=imgs; json.samplers=[{magFilter:9729,minFilter:9987,wrapS:33071,wrapT:33071}]; }
  const pad=(4-off%4)%4; if(pad){ partes.push(new Uint8Array(pad)); off+=pad; } json.buffers[0].byteLength=off;
  let js=new TextEncoder().encode(JSON.stringify(json)); const jp=(4-js.length%4)%4;
  if(jp){ const t=new Uint8Array(js.length+jp); t.set(js); t.fill(0x20,js.length); js=t; }
  const total=12+8+js.length+8+off, out=new Uint8Array(total), dv=new DataView(out.buffer);
  dv.setUint32(0,0x46546C67,true); dv.setUint32(4,2,true); dv.setUint32(8,total,true);
  dv.setUint32(12,js.length,true); dv.setUint32(16,0x4E4F534A,true); out.set(js,20);
  let o=20+js.length; dv.setUint32(o,off,true); dv.setUint32(o+4,0x004E4942,true); o+=8;
  for(const u of partes){ out.set(u,o); o+=u.length; }
  return new Blob([out],{type:'model/gltf-binary'});
}

/* ---------- abrir ----------
   No iPhone (Safari ou app instalado) um link com rel="ar" e uma imagem dentro abre
   o AR Quick Look direto, sem baixar nada. */
function temAR(){ try{ const a=document.createElement('a'); return !!(a.relList&&a.relList.supports&&a.relList.supports('ar')); }catch(e){ return false; } }
function abreNoIphone(blob){
  if(!temAR()) return false;
  const a=document.createElement('a'); a.rel='ar'; a.href=URL.createObjectURL(blob);
  a.appendChild(document.createElement('img'));
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),60000);
  return true;
}

/* ---------- visor 3D (WebGL puro) ----------
   A mesma cena do AR, desenhada dentro da Pré-visualização. Câmera em três modos:
   Girar (arrastar roda em volta do ponto do meio), Olhar (pan/tilt: a câmera fica
   parada e vira, como uma cabeça de câmera) e Pessoa (Olhar, a partir dos olhos do
   boneco). Dois dedos (ou o botão direito) arrastam a vista; pinça ou roda do mouse dá
   zoom (no Girar aproxima, no Olhar fecha a lente); dois toques voltam ao começo. Só desenha
   quando algo muda. */
function m4mul(a,b){ const o=new Float32Array(16); for(let c=0;c<4;c++) for(let r=0;r<4;r++){ let s=0; for(let k=0;k<4;k++) s+=a[k*4+r]*b[c*4+k]; o[c*4+r]=s; } return o; }
function m4persp(fov,asp,n,f){ const t=1/Math.tan(fov/2), o=new Float32Array(16); o[0]=t/asp; o[5]=t; o[10]=(f+n)/(n-f); o[11]=-1; o[14]=2*f*n/(n-f); return o; }
function m4orto(hw,hh,n,f){ const o=new Float32Array(16); o[0]=1/hw; o[5]=1/hh; o[10]=-2/(f-n); o[14]=-(f+n)/(f-n); o[15]=1; return o; }
function m4olha(e,a,u){
  const z=[e[0]-a[0],e[1]-a[1],e[2]-a[2]], nz=Math.hypot(...z); z.forEach((v,i)=>z[i]=v/nz);
  const x=[u[1]*z[2]-u[2]*z[1],u[2]*z[0]-u[0]*z[2],u[0]*z[1]-u[1]*z[0]], nx=Math.hypot(...x); x.forEach((v,i)=>x[i]=v/nx);
  const y=[z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]];
  return new Float32Array([x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0,
    -(x[0]*e[0]+x[1]*e[1]+x[2]*e[2]), -(y[0]*e[0]+y[1]*e[1]+y[2]*e[2]), -(z[0]*e[0]+z[1]*e[1]+z[2]*e[2]), 1]);
}
const COR_VISOR={ tela:null, chao:[0.012,0.014,0.022], grade:[0.06,0.07,0.1] };
// a foto do PDF mostra a cena sem o chão: painel, estrutura, palcos e a pessoa (se ligada); fora a planta do local
const FORA_DA_FOTO=nome=>/(^|_)Planta$/.test(nome);
function visor(cv){
  const gl=cv.getContext('webgl',{antialias:true})||cv.getContext('experimental-webgl');
  if(!gl) return null;
  const sombra=(tipo,src)=>{ const s=gl.createShader(tipo); gl.shaderSource(s,src); gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog=gl.createProgram();
  gl.attachShader(prog,sombra(gl.VERTEX_SHADER,`attribute vec3 p; attribute vec3 n; attribute vec2 t; attribute vec4 o; attribute vec2 o2; uniform mat4 M;
    varying vec3 vn; varying vec2 vt;
    vec3 gy(vec3 v,float a){ float c=cos(a), s=sin(a); return vec3(c*v.x+s*v.z, v.y, -s*v.x+c*v.z); }
    vec3 gx(vec3 v,float a){ float c=cos(a), s=sin(a); return vec3(v.x, c*v.y-s*v.z, s*v.y+c*v.z); }
    void main(){ vn=gy(gx(gy(n,o.w),o2.x),o2.y); vt=t; gl_Position=M*vec4(gy(gx(gy(p,o.w),o2.x),o2.y)+o.xyz,1.0); }`));
    /* o = onde vai cada placa e o giro dela (instância); o2 = inclinação e giro da screen (placa inclinada) */
  gl.attachShader(prog,sombra(gl.FRAGMENT_SHADER,`#ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    varying vec3 vn; varying vec2 vt;
    uniform vec3 cor; uniform float modo; uniform sampler2D tex;
    void main(){
      if(modo>3.5){ float d=length(vt-vec2(0.5))*2.0, a=clamp(1.0-d,0.0,1.0);          /* 4 = o brilho do LED: redondo, somando luz */
        gl_FragColor=vec4(pow(cor,vec3(1.0/2.2))*(a*a*1.4+a*0.15),1.0); return; }
      if(modo>2.5){ gl_FragColor=vec4(pow(cor,vec3(1.0/2.2)),1.0); return; }            /* 3 = luz própria (o LED aceso) */
      if(modo>0.5&&modo<1.5){ gl_FragColor=vec4(texture2D(tex,vt).rgb,1.0); return; }   /* tela: acesa, sem sombra */
      vec3 base=modo>1.5?pow(texture2D(tex,vt).rgb,vec3(2.2)):cor;                       /* 2 = textura com luz (o logo) */
      vec3 N=normalize(vn); float luz=0.5+0.5*max(dot(N,normalize(vec3(0.35,0.85,0.55))),0.0)+0.12*max(N.y,0.0)
        +0.32*max(dot(N,normalize(vec3(-0.4,0.3,-0.87))),0.0)*clamp(-N.z*4.0,0.0,1.0);       /* + uma luz de trás, só pro que olha pra trás */
      gl_FragColor=vec4(pow(base,vec3(1.0/2.2))*luz,1.0); }`));      /* cores lineares (as do USD) pra tela */
  gl.bindAttribLocation(prog,0,'p');
  gl.linkProgram(prog); if(!gl.getProgramParameter(prog,gl.LINK_STATUS)) return null;
  const at={p:gl.getAttribLocation(prog,'p'), n:gl.getAttribLocation(prog,'n'), t:gl.getAttribLocation(prog,'t'), o:gl.getAttribLocation(prog,'o'), o2:gl.getAttribLocation(prog,'o2')};
  const inst=gl.getExtension('ANGLE_instanced_arrays');   // as placas: um desenho, repetido (sem ele, uma por uma)
  if(at.o>=0) gl.vertexAttrib4f(at.o,0,0,0,0);
  if(at.o2>=0) gl.vertexAttrib2f(at.o2,0,0);
  const un={M:gl.getUniformLocation(prog,'M'), cor:gl.getUniformLocation(prog,'cor'), modo:gl.getUniformLocation(prog,'modo'), tex:gl.getUniformLocation(prog,'tex')};
  let texPlanta=null, texPlantaDe=null;
  let pecas=[], linhas=null, tex=null, texLogo=null, texPlaca=null, texPlacaDe=null, ultima=null, raio=4, alvo=[0,1.5,0], yaw=0.5, pitch=0.2, dist=10, w=1, h=1, pedido=0;
  const FOV0=0.75, FOV_OLHOS=0.95;
  let alvo0=[0,1.5,0], fov=FOV0, modo='girar', mexeu=false, pessoaVis=null, quandoModo=null, quandoDesenha=null;
  /* as vistas técnicas (como no Vectorworks): ortográficas, sem perspectiva — Frente, Trás, Esquerda, Direita
     (de quem está na plateia) e Topo. orto = {vista, meia: meia altura da tela, em m}; null = perspectiva.
     Nelas, arrastar move a vista, a pinça/roda dá zoom e dois toques enquadram de novo */
  let orto=null, zRef={orto:1, dist:1};                              // zRef: o enquadramento que vale 100% (vista técnica / órbita)
  const ISO=Math.atan(Math.SQRT1_2);                                  // a isométrica: 35,26° de cima, a 45° (os 3 eixos encurtam igual)
  const ORTO={frente:{yaw:0,pitch:0}, tras:{yaw:Math.PI,pitch:0}, dir:{yaw:Math.PI/2,pitch:0}, esq:{yaw:-Math.PI/2,pitch:0}, topo:{yaw:0,pitch:Math.PI/2},
              isoE:{yaw:-Math.PI/4,pitch:ISO}, isoD:{yaw:Math.PI/4,pitch:ISO}};
  const eixos=(y,p)=>{ const f=dirDe(y,p).map(v=>-v), r=[Math.cos(y),0,-Math.sin(y)]; return {f, r, u:[r[1]*f[2]-r[2]*f[1], r[2]*f[0]-r[0]*f[2], r[0]*f[1]-r[1]*f[0]]}; };
  const pe3=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  let folgaTopo=null;                                                 // px de cima cobertos pela barra do app (null: o padrão)
  // F (a foto do PDF): {W, H, mg} em px da foto, mg = a margem das cotas (0 = sem); sem F, a tela
  function ajustaOrto(v,asp,naTela,F){                                // o meio e o tamanho que enquadram a cena nessa vista (10% de folga)
    const {yaw:y, pitch:p}=ORTO[v], {f,r,u}=eixos(y,p), C=caixaFoto;
    let P=pontosFoto.length?pontosFoto:C?[0,1,2,3,4,5,6,7].map(i=>[i&1?C.mx[0]:C.mn[0], i&2?C.mx[1]:C.mn[1], i&4?C.mx[2]:C.mn[2]]):[];
    if(!P.length) return {alvo:alvo0.slice(), meia:raio};
    let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9,z0=1e9,z1=-1e9;
    P.forEach(q=>{ const x=pe3(q,r), yy=pe3(q,u), z=pe3(q,f); x0=Math.min(x0,x); x1=Math.max(x1,x); y0=Math.min(y0,yy); y1=Math.max(y1,yy); z0=Math.min(z0,z); z1=Math.max(z1,z); });
    const mx=(x0+x1)/2, my=(y0+y1)/2, mz=(z0+z1)/2;
    // com as cotas ligadas, sobra espaço em volta pra elas (até 2 fileiras) e pra barra de cima
    // na tela, a faixa de cima coberta pela barra também fica de fora (e a cena desce metade dela)
    const Hc=F?Math.max(100,F.H):Math.max(100,cv.clientHeight||h), Wc=F?Math.max(100,F.W):Math.max(100,cv.clientWidth||w), co=F?F.mg>0:!!cotasOn;
    const mg=co?Math.min(F?F.mg:72,Hc*0.2,Wc*0.2):0;
    const ft=F?0:naTela&&folgaTopo!=null?Math.min(folgaTopo,Hc*0.35):cotasOn?Math.min(40,Hc*0.1):0;
    const kv=Hc/Math.max(40,Hc-2*mg-ft), kh=Wc/Math.max(40,Wc-2*mg);
    const meia=Math.max(0.3,Math.max((y1-y0)/2*kv,(x1-x0)/2/Math.max(0.1,asp)*kh)*(co?1.04:1.1)), sobe=naTela&&folgaTopo!=null?ft/2*2*meia/Hc:0;
    return {alvo:[0,1,2].map(j=>r[j]*mx+u[j]*(my+sobe)+f[j]*mz), meia};
  }
  function vistaPoe(v){
    if(!ORTO[v]) return false;
    yaw=ORTO[v].yaw; pitch=ORTO[v].pitch; const a=ajustaOrto(v,w/Math.max(1,h),true);
    orto={vista:v, meia:a.meia}; zRef.orto=a.meia; alvo=a.alvo; mexeu=true; poeModo('vista'); return true;
  }
  function saiOrto(){ if(!orto) return; dist=Math.max(raio*0.35,Math.min(raio*8,orto.meia/Math.tan(FOV0/2))); fov=FOV0; orto=null; }   // a órbita: do mesmo meio, numa distância que mostra o mesmo tanto
  const dirDe=(y,p)=>[Math.sin(y)*Math.cos(p), Math.sin(p), Math.cos(y)*Math.cos(p)];   // do alvo pro olho
  const olhoDe=()=>{ const d=dirDe(yaw,pitch); return [alvo[0]+dist*d[0], alvo[1]+dist*d[1], alvo[2]+dist*d[2]]; };
  const poeModo=m=>{ if(modo===m) return; modo=m; if(quandoModo) quandoModo(m); };
  const buf=(dados,tipo)=>{ const b=gl.createBuffer(); gl.bindBuffer(tipo||gl.ARRAY_BUFFER,b); gl.bufferData(tipo||gl.ARRAY_BUFFER,dados,gl.STATIC_DRAW); return b; };
  function limpa(){ pecas.forEach(p=>[p.bp,p.bn,p.bt,p.bi,p.grupo&&p.grupo.bo].forEach(b=>b&&gl.deleteBuffer(b))); pecas=[]; if(linhas){ gl.deleteBuffer(linhas.bp); gl.deleteBuffer(linhas.bn); linhas=null; } }
  function sobe(nome,mat,m,cor){
    if(!m.idx.length) return;
    pecas.push({nome, pessoa:/^Pessoa_/.test(nome), planta:mat==='planta', tela:mat==='tela', logo:mat==='logo', placa:mat==='gab_fundo', led:mat==='gab_led_on'||mat==='gab_led_halo', brilho:mat==='gab_led_halo',
      fora:nome==='chao'||FORA_DA_FOTO(nome), cor:cor||COR[mat]||[0.3,0.3,0.3], n:m.idx.length,
      bp:buf(new Float32Array(m.pts.flat())), bn:buf(new Float32Array(m.nrm.flat())), bt:buf(new Float32Array(m.st.flat())),
      bi:buf(new Uint16Array(m.idx),gl.ELEMENT_ARRAY_BUFFER)});
  }
  // as placas por trás: as peças do gabinete sobem uma vez e são desenhadas em cada posição
  function sobeGrupo(g){
    const bo=buf(new Float32Array(g.pos.flatMap(q=>[q[0],q[1],q[2],q[3]||0,q[4]||0,q[5]||0])));   // 6 por placa: o (4) + o2 (2)
    g.proto.partes.forEach(pt=>{ const n=pecas.length; sobe(pt.nome,pt.mat,pt.m); if(pecas.length>n) pecas[n].grupo={bo, n:g.pos.length, pos:g.pos}; });
    if(g.proto.tex&&texPlacaDe!==g.proto.tex){                // o fundo dos módulos: potência de 2, com mipmap (não cintila de longe)
      if(!texPlaca) texPlaca=gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D,texPlaca); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,g.proto.tex);
      [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T].forEach(k=>gl.texParameteri(gl.TEXTURE_2D,k,gl.CLAMP_TO_EDGE));
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      texPlacaDe=g.proto.tex;
    }
  }
  function inicial(){ orto=null; yaw=0.5; pitch=0.2; dist=raio*2.3; zRef.dist=dist; alvo=alvo0.slice(); fov=FOV0; mexeu=false; poeModo('girar'); }
  /* nos olhos do boneco (a 94% da altura, de onde ele pisa). nova: olhando pro meio da cena;
     senão (a cena mudou, ex.: mexeram no X/Y dele) mantém pra onde estava olhando */
  function nosOlhos(nova){
    const P=pessoaVis, o=[P.x, P.y0+P.h*0.94, P.z];
    if(nova){ const v=[alvo0[0]-o[0], alvo0[1]-o[1], alvo0[2]-o[2]], hd=Math.hypot(v[0],v[2])||1;
      yaw=Math.atan2(-v[0],-v[2]); pitch=Math.max(-1.2,Math.min(1.2,Math.atan2(-v[1],hd))); dist=Math.max(1,Math.hypot(hd,v[1])); fov=FOV_OLHOS; }
    const d=dirDe(yaw,pitch); alvo=[o[0]-dist*d[0], o[1]-dist*d[1], o[2]-dist*d[2]];
  }
  function cena(c, primeira){
    limpa(); ultima=c;
    const ps=monta(c); let mn=[1e9,1e9,1e9], mx=[-1e9,-1e9,-1e9], longe=0;
    cotasGeo=cotasDe(ps,c);
    const fmn=[1e9,1e9,1e9], fmx=[-1e9,-1e9,-1e9], naFoto=v=>{ for(let i=0;i<3;i++){ fmn[i]=Math.min(fmn[i],v[i]); fmx[i]=Math.max(fmx[i],v[i]); } };
    pontosFoto=[];                                                    // o que a foto do PDF enquadra (até ~400 pontos por peça)
    ps.forEach(p=>{ if(FORA_DA_FOTO(p.nome)) return; const P=p.m.pts, k=Math.max(1,Math.floor(P.length/400));
      for(let i=0;i<P.length;i+=k){ naFoto(P[i]); pontosFoto.push(P[i]); }
      if(p.grupo) p.grupo.pos.forEach(q=>{ naFoto(q); pontosFoto.push(q); }); });
    caixaFoto=fmx[0]>fmn[0]?{c:fmn.map((v,i)=>(v+fmx[i])/2), mn:fmn.slice(), mx:fmx.slice()}:null;
    ps.forEach(p=>{ if(p.grupo) sobeGrupo(p.grupo); else sobe(p.nome,p.mat,p.m);
      if(p.mat==='planta'){ p.m.pts.forEach(v=>{ longe=Math.max(longe,Math.abs(v[0]),Math.abs(v[2])); }); return; }   // a planta do local não entra no enquadramento
      p.m.pts.forEach(v=>{ for(let i=0;i<3;i++){ mn[i]=Math.min(mn[i],v[i]); mx[i]=Math.max(mx[i],v[i]); } }); });
    if(c.chao&&c.chao.img&&texPlantaDe!==c.chao.img){ if(!texPlanta) texPlanta=gl.createTexture(); sobeTexturaMip(texPlanta,c.chao.img); texPlantaDe=c.chao.img; }
    // chão e grade de 1 m: dá a escala de quem está no meio (e cobre a planta do local, se tiver)
    const L=Math.ceil(Math.max(6,(mx[0]-mn[0]),(mx[2]-mn[2]),longe)*1.2), ch=malha();
    quad(ch,[-L,-0.002,L],[L,-0.002,L],[L,-0.002,-L],[-L,-0.002,-L],[0,1,0]); sobe('chao','chao',ch,COR_VISOR.chao);
    const lp=[]; for(let i=-L;i<=L;i++){ lp.push(-L,0,i, L,0,i, i,0,-L, i,0,L); }
    linhas={bp:buf(new Float32Array(lp)), bn:buf(new Float32Array(lp.map((v,i)=>i%3===1?1:0))), n:lp.length/3};
    alvo0=[(mn[0]+mx[0])/2,(mn[1]+mx[1])/2,0.2];                      // gira em volta da frente do painel
    raio=Math.max(1,Math.hypot(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2])/2);
    pessoaVis=pessoaUlt&&c.pessoa?{x:pessoaUlt.x, y0:pessoaUlt.y0, z:pessoaUlt.z, h:c.pessoa.h}:null;
    if(primeira) inicial();
    else if(modo==='pessoa'){ if(pessoaVis) nosOlhos(false); else inicial(); }   // a pessoa andou: a câmera vai junto
    else if(!mexeu) alvo=alvo0.slice();                               // ninguém mexeu na vista: acompanha a cena
    ledLiga(); pede();
  }
  function sobeTextura(t,c){
    gl.bindTexture(gl.TEXTURE_2D,t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);
    [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T].forEach(k=>gl.texParameteri(gl.TEXTURE_2D,k,gl.CLAMP_TO_EDGE));
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  }
  /* a planta do local no chão: em potência de 2 (até 4096, 8 Mpx) com mipmap e anisotrópico — sem isso, as linhas
     finas vistas de longe e de lado serrilham e somem */
  function sobeTexturaMip(t,f){
    const mx=Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE)||2048), p2=v=>Math.min(mx,Math.pow(2,Math.round(Math.log2(Math.max(1,v)))));
    let w=p2(f.width), h=p2(f.height); while(w*h>8.4e6){ if(w>=h) w/=2; else h/=2; }
    const c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d'); x.imageSmoothingEnabled=true; x.imageSmoothingQuality='high'; x.drawImage(f,0,0,w,h);
    gl.bindTexture(gl.TEXTURE_2D,t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);
    [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T].forEach(k=>gl.texParameteri(gl.TEXTURE_2D,k,gl.CLAMP_TO_EDGE));
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    const an=gl.getExtension('EXT_texture_filter_anisotropic')||gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
    if(an) gl.texParameterf(gl.TEXTURE_2D,an.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)||1));
  }
  /* a textura da tela pra foto do PDF: em potência de 2 (até 4096) com mipmap e filtro anisotrópico — de longe
     e nas faces vistas de lado as linhas finas da imagem de teste não serrilham */
  function texturaAlta(fonte){
    if(!fonte||!fonte.width) return; texW=texH=0;                    // a textura muda de tamanho: a próxima textura() recria
    const mx=Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE)||2048), p2=v=>{ let n=1; while(n<v&&n<mx) n*=2; return n; };
    const c=document.createElement('canvas'); c.width=p2(fonte.width); c.height=p2(fonte.height);
    const x=c.getContext('2d'); x.imageSmoothingEnabled=true; x.imageSmoothingQuality='high'; x.drawImage(fonte,0,0,c.width,c.height);
    if(!tex) tex=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);
    [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T].forEach(k=>gl.texParameteri(gl.TEXTURE_2D,k,gl.CLAMP_TO_EDGE));
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    const an=gl.getExtension('EXT_texture_filter_anisotropic')||gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
    if(an) gl.texParameterf(gl.TEXTURE_2D,an.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)||1));
    pede();
  }
  /* a imagem da tela (conteúdo, pixel map): um orçamento de pixels, não um teto por lado — uma screen total larga
     (6720 × 1008) com teto de 2048 no lado maior virava 2048 × 307, e cada screen ficava com um terço dos pixels dela.
     Parada: até 8,4 Mpx (4,2 no celular); viva (vídeo e efeito, a cada quadro): até 2,1 Mpx (1 no celular). Em
     potência de 2 com mipmap e anisotrópico, como a estrutura: de longe e de lado as linhas não serrilham */
  const movel=/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'')||(navigator.maxTouchPoints>1&&/Mac/.test(navigator.platform||''));
  const TELA_MP={parada:movel?4.2e6:8.4e6, viva:movel?1.05e6:2.1e6};
  function telaTam(fw,fh,mp){
    const mx=Math.min(8192, gl.getParameter(gl.MAX_TEXTURE_SIZE)||2048), p2=v=>Math.min(mx,Math.pow(2,Math.max(0,Math.round(Math.log2(Math.max(1,v))))));
    const s=Math.min(1,Math.sqrt(mp/Math.max(1,fw*fh))); let W=p2(fw*s), H=p2(fh*s);
    while(W*H>mp*1.01&&(W>1||H>1)){ if(W>=H) W/=2; else H/=2; }
    return [W,H];
  }
  let texC=null, texW=0, texH=0;
  // modo: 'viva' (vídeo/efeito, a cada quadro) ou nada (parada); um número é o ar.js antigo (1024 = viva)
  function textura(fonte,modo){
    if(!fonte||!fonte.width) return;
    const viva=modo==='viva'||(typeof modo==='number'&&modo<=1024), [W,H]=telaTam(fonte.width,fonte.height,viva?TELA_MP.viva:TELA_MP.parada);
    if(!texC) texC=document.createElement('canvas');
    if(texC.width!==W||texC.height!==H){ texC.width=W; texC.height=H; }
    const x=texC.getContext('2d'); x.imageSmoothingEnabled=true; x.imageSmoothingQuality=viva?'medium':'high'; x.clearRect(0,0,W,H); x.drawImage(fonte,0,0,W,H);
    if(!tex){ tex=gl.createTexture(); texW=texH=0; }
    gl.bindTexture(gl.TEXTURE_2D,tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    if(texW===W&&texH===H) gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,texC);   // mesmo tamanho (vídeo): só troca os pixels
    else{ gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,texC); texW=W; texH=H;
      [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T].forEach(k=>gl.texParameteri(gl.TEXTURE_2D,k,gl.CLAMP_TO_EDGE));
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      const an=gl.getExtension('EXT_texture_filter_anisotropic')||gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
      if(an) gl.texParameterf(gl.TEXTURE_2D,an.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)||1)); }
    gl.generateMipmap(gl.TEXTURE_2D);
    pede();
  }
  // o símbolo das costas do boneco: quando chega, vira textura e a cena é remontada com ele
  logoPronto.then(c=>{ if(!c) return; texLogo=gl.createTexture(); sobeTextura(texLogo,c); if(ultima) cena(ultima); else pede(); });
  function tamanho(cw,chH){
    const dpr=Math.min(2,window.devicePixelRatio||1), W=Math.round(cw*dpr), H=Math.round(chH*dpr);
    cv.style.width=cw+'px'; cv.style.height=chH+'px';
    if(cv.width!==W||cv.height!==H){ cv.width=W; cv.height=H; }
    w=W; h=H; pede();
  }
  function desenha(){
    pedido=0;
    gl.viewport(0,0,w,h); if(soFoto) gl.clearColor(1,1,1,1); else gl.clearColor(0.05,0.065,0.11,1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.useProgram(prog);
    const P=pessoaVis, Do=raio*20+20, olho=orto?alvo.map((v,j)=>v+Do*dirDe(yaw,pitch)[j]):olhoDe();
    const semPessoa=!orto&&(modo==='pessoa'||!!(P&&Math.hypot(olho[0]-P.x,olho[2]-P.z)<0.4&&olho[1]>P.y0&&olho[1]<P.y0+P.h+0.15));
    const asp=w/Math.max(1,h);
    const mvp=orto?m4mul(m4orto(orto.meia*asp,orto.meia,0.05,Do*2+raio*10),m4olha(olho,alvo,orto.vista==='topo'?[0,0,-1]:[0,1,0]))
      :m4mul(m4persp(fov,asp,0.05,raio*30+dist),m4olha(olho,alvo,[0,1,0]));
    gl.uniformMatrix4fv(un.M,false,mvp); mvpUlt=mvp;
    gl.activeTexture(gl.TEXTURE0); if(tex) gl.bindTexture(gl.TEXTURE_2D,tex); gl.uniform1i(un.tex,0);
    const liga=(b,loc,k)=>{ if(loc<0) return; gl.bindBuffer(gl.ARRAY_BUFFER,b); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,k,gl.FLOAT,false,0,0); };
    ledFase=soFoto?0:ledAgora();                                      // na foto o LED sai aceso
    for(const p of pecas){
      if(soFoto&&p.fora) continue;                                    // foto do PDF: só o painel e a estrutura
      if(p.pessoa&&semPessoa) continue;                               // dos olhos dela (ou ainda dentro dela), o boneco não aparece
      if(p.led&&ledFase) continue;                                    // o LED na metade apagada
      if(!p.brilho) peca1(p);
    }
    // o brilho em volta do LED aceso: por último, somando luz, sem tampar nada atrás
    const brilhos=ledFase?[]:pecas.filter(p=>p.brilho);
    if(brilhos.length){ gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE); gl.depthMask(false);
      brilhos.forEach(peca1); gl.depthMask(true); gl.disable(gl.BLEND); }
    if(linhas&&!soFoto){ liga(linhas.bp,at.p,3); liga(linhas.bn,at.n,3); if(at.t>=0) gl.disableVertexAttribArray(at.t);
      gl.uniform1f(un.modo,0); gl.uniform3fv(un.cor,COR_VISOR.grade); gl.drawArrays(gl.LINES,0,linhas.n); }
    cotasTela(); if(quandoDesenha&&!soFoto) try{ quandoDesenha(); }catch(e){ console.error(e); }   // quem desenha por cima (o editor) acompanha a câmera
    function peca1(p){
      liga(p.bp,at.p,3); liga(p.bn,at.n,3); liga(p.bt,at.t,2);
      const t=p.tela?tex:p.logo?texLogo:p.placa?texPlaca:p.planta?texPlanta:null; if(t) gl.bindTexture(gl.TEXTURE_2D,t);
      gl.uniform1f(un.modo,p.brilho?4:p.led?3:t?(p.tela||p.planta?1:2):0); gl.uniform3fv(un.cor,p.cor);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,p.bi);
      if(!p.grupo||at.o<0){ gl.drawElements(gl.TRIANGLES,p.n,gl.UNSIGNED_SHORT,0); return; }
      if(inst){
        gl.bindBuffer(gl.ARRAY_BUFFER,p.grupo.bo); gl.enableVertexAttribArray(at.o); gl.vertexAttribPointer(at.o,4,gl.FLOAT,false,24,0);
        inst.vertexAttribDivisorANGLE(at.o,1);
        if(at.o2>=0){ gl.enableVertexAttribArray(at.o2); gl.vertexAttribPointer(at.o2,2,gl.FLOAT,false,24,16); inst.vertexAttribDivisorANGLE(at.o2,1); }
        inst.drawElementsInstancedANGLE(gl.TRIANGLES,p.n,gl.UNSIGNED_SHORT,0,p.grupo.n);
        inst.vertexAttribDivisorANGLE(at.o,0); gl.disableVertexAttribArray(at.o);
        if(at.o2>=0){ inst.vertexAttribDivisorANGLE(at.o2,0); gl.disableVertexAttribArray(at.o2); }
      }
      else p.grupo.pos.forEach(q=>{ gl.vertexAttrib4f(at.o,q[0],q[1],q[2],q[3]||0); if(at.o2>=0) gl.vertexAttrib2f(at.o2,q[4]||0,q[5]||0); gl.drawElements(gl.TRIANGLES,p.n,gl.UNSIGNED_SHORT,0); });
      gl.vertexAttrib4f(at.o,0,0,0,0); if(at.o2>=0) gl.vertexAttrib2f(at.o2,0,0);
    }
  }
  function pede(){ if(!pedido) pedido=requestAnimationFrame(desenha); }
  /* o LED das placas piscando (meio segundo aceso, meio apagado, todas juntas): com placas na
     cena, um relógio vê se a fase virou e redesenha — só com o visor à vista e a aba aberta */
  let ledFase=0, ledRelogio=0, soFoto=false, caixaFoto=null, pontosFoto=[];
  /* ═══ cotas (📏): as medidas da cena, tiradas das peças — a tela de cada screen (a frente do LED), o tampo de
     cada palco e a estrutura —, desenhadas por cima do 3D (num canvas 2D) e na foto do PDF. Nas vistas técnicas
     (sem perspectiva) valem na vista inteira; na perspectiva, só a largura e a altura total */
  let cotasOn=false, cotasGeo=null, mvpUlt=null, ovCv=null;          // cotasOn: false | 'm' | 'px' (metros + pixels das screens)
  function cotasDe(ps,c){
    const bb=()=>({x0:1e9,x1:-1e9,y0:1e9,y1:-1e9,z0:1e9,z1:-1e9}), poe=(b,P)=>P.forEach(v=>{ b.x0=Math.min(b.x0,v[0]); b.x1=Math.max(b.x1,v[0]); b.y0=Math.min(b.y0,v[1]); b.y1=Math.max(b.y1,v[1]); b.z0=Math.min(b.z0,v[2]); b.z1=Math.max(b.z1,v[2]); });
    const T={}, S={}, E=bb(), Pe=bb();
    ps.forEach(p=>{ const n=p.nome, P=p.m.pts; if(!P.length) return;
      if(/^Pessoa_/.test(n)){ poe(Pe,P); return; }
      let r=/^(?:(S\d+)_)?Tela(?:_\d+)?$/.exec(n); if(r){ const k=r[1]||'S'; poe(T[k]=T[k]||bb(),P); return; }   // os quadros do vídeo: no mesmo lugar
      r=/^(?:(P\d+)_)?(?:Tampo|Palco)$/.exec(n); if(r){ const k=r[1]||'P1'; poe(S[k]=S[k]||bb(),P); return; }
      if(/(^|_)(MaoFrancesa|Pesos)$/.test(n)) poe(E,P); });
    Object.keys(T).forEach(k=>{ const t=k==='S'?c&&c.painel:c&&c.telas&&c.telas[+k.slice(1)-1]; T[k].px=t&&t.px&&t.px.w>0?t.px:null; });   // os pixels de cada screen
    const telas=Object.values(T), palcos=Object.values(S); if(!telas.length) return null;
    const tudo=bb(); telas.forEach(b=>poe(tudo,[[b.x0,b.y0,b.z0],[b.x1,b.y1,b.z1]]));
    const estr=bb(); poe(estr,[[tudo.x0,tudo.y0,tudo.z0],[tudo.x1,tudo.y1,tudo.z1]]); if(E.x1>E.x0) poe(estr,[[E.x0,E.y0,E.z0],[E.x1,E.y1,E.z1]]);
    // a pessoa: a caixa dela (pra nenhuma cota passar por cima) e a altura pedida, de onde ela pisa até o alto da cabeça
    const pes=Pe.x1>Pe.x0&&pessoaUlt&&c&&c.pessoa?Object.assign(Pe,{pe:pessoaUlt.y0, h:c.pessoa.h}):null;
    return {telas, palcos, tudo, estr, pes, Tk:T, Sk:S};
  }
  const fmM=v=>(Math.round(v*100)/100).toFixed(2).replace('.',',')+' m';
  // livre(p1,p2,dir): a coluna de cotas nessa linha, afastada pra dir, não cai em cima da pessoa (quem desenha é que sabe, em pixels)
  function cotasItens(vista,livre){                                   // [{p1, p2, dir (pra onde afasta), row (a fileira), txt, o1/o2 (de onde saem as linhas de chamada)}]
    const G=cotasGeo; if(!G) return []; livre=livre||(()=>true);
    const T=G.telas.slice().sort((a,b)=>a.x0-b.x0), A=G.tudo, S=G.palcos, Pe=G.pes, out=[];
    const add=(p1,p2,dir,row,px,o1,o2)=>{ const L=Math.hypot(p2[0]-p1[0],p2[1]-p1[1],p2[2]-p1[2]); if(L>0.005) out.push({p1,p2,dir,row,txt:fmM(L),px,o1,o2}); };
    // os px da largura só na screen reta e de frente pra vista: na curva (ou girada) a cota é a ocupada, não a do LED
    const pw=b=>b.px&&b.z1-b.z0<0.02&&b.px.w, ph=b=>b.px&&b.px.h;
    // os vãos: onde nenhuma screen cobre (uma quina de lado, dentro de outra, não abre vão)
    const vaos=[]; let fim=-1e9; T.forEach(b=>{ if(fim>-1e8&&b.x0-fim>0.01) vaos.push([fim,b.x0]); fim=Math.max(fim,b.x1); });
    const sx1=Math.max(A.x1,...S.map(b=>b.x1)), sx0=Math.min(A.x0,...S.map(b=>b.x0)), sz1=Math.max(A.z1,...S.map(b=>b.z1));
    if(!vista||/^iso/.test(vista)){ add([A.x0,0,A.z1],[A.x1,0,A.z1],[0,0,1],0); add([A.x1,0,A.z1],[A.x1,A.y1,A.z1],[1,0,0],0); return out; }   // perspectiva e isométrica: largura e altura total
    if(vista==='frente'||vista==='tras'){
      const z=sz1, y=A.y1;
      T.forEach(b=>add([b.x0,y,z],[b.x1,y,z],[0,1,0],0,pw(b))); vaos.forEach(([a,c])=>add([a,y,z],[c,y,z],[0,1,0],0));   // cada screen e os vãos
      if(T.length>1) add([A.x0,y,z],[A.x1,y,z],[0,1,0],1);                                                            // o conjunto
      // as alturas, na ponta da direita: do chão até a screen, ela e o total. A pessoa embaixo delas (tela pequena):
      // vão pra ponta da esquerda, junto da altura do palco (a mesma do chão até a screen, quando ela está em cima)
      const dir=livre([sx1,0,z],[sx1,A.y1,z],[1,0,0])||!livre([sx0,0,z],[sx0,A.y1,z],[-1,0,0]);
      const R=dir?T[T.length-1]:T[0], xa=dir?sx1:sx0, da=[dir?1:-1,0,0];
      if(R.y0>0.01) add([xa,0,z],[xa,R.y0,z],da,0); add([xa,R.y0,z],[xa,R.y1,z],da,0,ph(R)); if(Math.abs(A.y1-R.y1)>0.005||R.y0>0.01) add([xa,0,z],[xa,A.y1,z],da,1);
      S.forEach(b=>add([b.x0,0,z],[b.x1,0,z],[0,-1,0],0));                                                          // palco: largura e altura
      if(S[0]&&(dir||Math.abs(S[0].y1-R.y0)>0.01)) add([sx0,0,z],[sx0,S[0].y1,z],[-1,0,0],dir?0:2);
      if(Pe){ const fora=(Pe.x0+Pe.x1)/2>=(sx0+sx1)/2, xp=fora?Pe.x1:Pe.x0;                                         // a pessoa: do lado de fora dela
        add([xp,Pe.pe,z],[xp,Pe.pe+Pe.h,z],[fora?1:-1,0,0],0); }
      return out; }
    if(vista==='topo'){
      const y=A.y1+5, zb=A.z0;
      T.forEach(b=>add([b.x0,y,zb],[b.x1,y,zb],[0,0,-1],0,pw(b))); vaos.forEach(([a,c])=>add([a,y,zb],[c,y,zb],[0,0,-1],0));
      if(T.length>1) add([A.x0,y,zb],[A.x1,y,zb],[0,0,-1],1);
      const meio=(A.x0+A.x1)/2;                                                                                     // de lado (quina, recuo): a profundidade, pro lado de dentro
      T.forEach(b=>{ if(b.x1-b.x0<0.1&&b.z1-b.z0>0.05){ const cx=(b.x0+b.x1)/2; add([cx,y,b.z0],[cx,y,b.z1],[cx<meio?1:-1,0,0],0); } });
      S.forEach(b=>{ add([b.x0,y,b.z1],[b.x1,y,b.z1],[0,0,1],0); add([b.x1,y,b.z0],[b.x1,y,b.z1],[1,0,0],0); });     // palco: largura e profundidade
      return out; }
    const x=vista==='dir'?sx1:sx0, H=T.reduce((a,b)=>b.y1>a.y1?b:a,T[0]), Es=G.estr;                                // lados: alturas, a estrutura e o palco
    // as alturas na frente do painel; com a pessoa ali embaixo, atrás da estrutura (as linhas de chamada saem do painel)
    const fr=livre([x,0,A.z1],[x,A.y1,A.z1],[0,0,1])||!livre([x,0,Es.z0],[x,A.y1,Es.z0],[0,0,-1]);
    const zf=fr?A.z1:Es.z0, dz=[0,0,fr?1:-1], o=y=>fr?undefined:[x,y,A.z0];
    if(H.y0>0.01) add([x,0,zf],[x,H.y0,zf],dz,0,0,o(0),o(H.y0)); add([x,H.y0,zf],[x,H.y1,zf],dz,0,ph(H),o(H.y0),o(H.y1)); if(H.y0>0.01) add([x,0,zf],[x,A.y1,zf],dz,1,0,o(0),o(A.y1));
    add([x,A.y1,Es.z0],[x,A.y1,Es.z1],[0,1,0],0);
    S.forEach(b=>add([x,0,b.z0],[x,0,b.z1],[0,-1,0],0));
    if(Pe){ const fora=(Pe.z0+Pe.z1)/2>=(A.z0+A.z1)/2, zp=fora?Pe.z1:Pe.z0;                                          // a pessoa: do lado de fora dela
      add([x,Pe.pe,zp],[x,Pe.pe+Pe.h,zp],[0,0,fora?1:-1],0); }
    return out;
  }
  /* desenha as cotas num contexto 2D de W × H com a matriz M (a do 3D): linha de cota afastada da peça, linhas de
     chamada, marcas a 45° nas pontas e o texto no meio, de pé. claro: na foto do PDF (fundo branco) */
  function cotasDesenha(ctx,W,H,M,vista,claro){
    if(!M||!cotasGeo) return;
    const pj=p=>{ const x=M[0]*p[0]+M[4]*p[1]+M[8]*p[2]+M[12], y=M[1]*p[0]+M[5]*p[1]+M[9]*p[2]+M[13], q=M[3]*p[0]+M[7]*p[1]+M[11]*p[2]+M[15]; return q>1e-6?[(x/q+1)/2*W,(1-y/q)/2*H]:null; };
    const u=claro?Math.max(1,H/850):Math.min(2,window.devicePixelRatio||1), fs=Math.round(11*u), gap=16*u, passo=24*u;
    const sai=(it,a,b)=>{ const m=[0,1,2].map(i=>(it.p1[i]+it.p2[i])/2), q0=pj(m), q1=pj(m.map((v,i)=>v+it.dir[i]*0.05));   // pra onde a cota afasta, na tela
      let ox=q0&&q1?q1[0]-q0[0]:0, oy=q0&&q1?q1[1]-q0[1]:0, ol=Math.hypot(ox,oy);
      if(ol<1e-3){ ox=-(b[1]-a[1]); oy=b[0]-a[0]; ol=Math.hypot(ox,oy)||1; } return [ox/ol,oy/ol]; };            // de frente pro afastamento: perpendicular
    // a pessoa na tela: uma coluna de cotas (2 fileiras e o texto) que pega nela não serve
    const Pe=cotasGeo.pes, pr=Pe&&[0,1,2,3,4,5,6,7].map(i=>pj([i&1?Pe.x1:Pe.x0, i&2?Pe.y1:Pe.y0, i&4?Pe.z1:Pe.z0])).filter(Boolean);
    const livre=(p1,p2,dir)=>{ if(!pr||!pr.length) return true; const a=pj(p1), b=pj(p2); if(!a||!b) return true;
      const [ox,oy]=sai({p1,p2,dir},a,b), d=gap+passo+fs*0.7, xs=[a[0],b[0],a[0]+ox*d,b[0]+ox*d], ys=[a[1],b[1],a[1]+oy*d,b[1]+oy*d], f=2*u;
      return Math.max(...xs)+f<Math.min(...pr.map(q=>q[0]))||Math.min(...xs)-f>Math.max(...pr.map(q=>q[0]))||Math.max(...ys)+f<Math.min(...pr.map(q=>q[1]))||Math.min(...ys)-f>Math.max(...pr.map(q=>q[1])); };
    const itens=cotasItens(vista,livre); if(!itens.length) return;
    const comPx=claro?claro==='px':cotasOn==='px', fpx=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
    itens.forEach(it=>{ if(comPx&&it.px>0) it.txt+=' — '+fpx(it.px)+' px'; });   // como a Vista fazia: "2,00 m — 672 px"
    const cor=claro?'#1d4ed8':'#ffd34d', tx=claro?'#0b1b4d':'#fff', fundo=claro?'rgba(255,255,255,.92)':'rgba(6,10,20,.78)';
    ctx.save(); ctx.lineWidth=Math.max(1,1.1*u); ctx.font=`600 ${fs}px system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.strokeStyle=cor;
    itens.forEach(it=>{
      const a=pj(it.p1), b=pj(it.p2); if(!a||!b) return; const L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L<8*u) return;
      const [ox,oy]=sai(it,a,b), a0=it.o1&&pj(it.o1)||a, b0=it.o2&&pj(it.o2)||b;                                 // as linhas de chamada saem da peça (o1/o2)
      const d=gap+it.row*passo, P=[a[0]+ox*d,a[1]+oy*d], Q=[b[0]+ox*d,b[1]+oy*d], dx=(Q[0]-P[0])/L, dy=(Q[1]-P[1])/L, t=4*u;
      ctx.globalAlpha=0.5; ctx.beginPath(); ctx.moveTo(a0[0]+ox*3*u,a0[1]+oy*3*u); ctx.lineTo(P[0]+ox*4*u,P[1]+oy*4*u); ctx.moveTo(b0[0]+ox*3*u,b0[1]+oy*3*u); ctx.lineTo(Q[0]+ox*4*u,Q[1]+oy*4*u); ctx.stroke();
      ctx.globalAlpha=1; ctx.beginPath(); ctx.moveTo(P[0],P[1]); ctx.lineTo(Q[0],Q[1]);
      [P,Q].forEach(R=>{ ctx.moveTo(R[0]-(dx-dy)*t,R[1]-(dx+dy)*t); ctx.lineTo(R[0]+(dx-dy)*t,R[1]+(dx+dy)*t); }); ctx.stroke();
      let ang=Math.atan2(dy,dx); if(ang>Math.PI/2) ang-=Math.PI; if(ang<-Math.PI/2) ang+=Math.PI;
      // não cabe na cota: em pé (vertical), o texto vai na continuação da linha, além do começo dela (ex.: o 0,40 m
      // embaixo do chão); deitada, pro lado de fora da linha
      const tw=ctx.measureText(it.txt).width+6*u, cabe=tw<=L*0.9||L>=tw*0.6, emPe=Math.abs(dy)>Math.abs(dx);   // quase cabe: fica no meio
      const cx=cabe?(P[0]+Q[0])/2:emPe?P[0]-dx*(tw/2+4*u):(P[0]+Q[0])/2+ox*fs*1.25, cy=cabe?(P[1]+Q[1])/2:emPe?P[1]-dy*(tw/2+4*u):(P[1]+Q[1])/2+oy*fs*1.25;
      ctx.save(); ctx.translate(cx,cy); ctx.rotate(ang);
      ctx.fillStyle=fundo; ctx.fillRect(-tw/2,-fs*0.68,tw,fs*1.36); ctx.fillStyle=tx; ctx.fillText(it.txt,0,0); ctx.restore();
    });
    ctx.restore();
  }
  // a camada das cotas por cima do canvas do 3D (acompanha o tamanho, o lugar e o esconder dele)
  function cotasTela(){
    const vis=cotasOn&&!soFoto&&mvpUlt&&!cv.hidden&&cv.offsetParent;
    if(!vis){ if(ovCv) ovCv.style.display='none'; return; }
    if(!ovCv){ ovCv=document.createElement('canvas'); ovCv.setAttribute('aria-hidden','true'); ovCv.style.cssText='position:absolute;pointer-events:none;z-index:1';
      try{ new MutationObserver(()=>{ if(cv.hidden&&ovCv) ovCv.style.display='none'; }).observe(cv,{attributes:true, attributeFilter:['hidden','style']}); }catch(_){} }
    if(cv.nextSibling!==ovCv) cv.after(ovCv);
    ovCv.style.display=''; ovCv.style.left=cv.offsetLeft+'px'; ovCv.style.top=cv.offsetTop+'px'; ovCv.style.width=cv.clientWidth+'px'; ovCv.style.height=cv.clientHeight+'px';
    if(ovCv.width!==w||ovCv.height!==h){ ovCv.width=w; ovCv.height=h; }
    const x=ovCv.getContext('2d'); x.clearRect(0,0,w,h); cotasDesenha(x,w,h,mvpUlt,orto?orto.vista:null,false);
  }
  /* a foto do PDF: o painel, a estrutura, o palco e a pessoa, se ligada (sem chão, grade e planta), em fundo
     branco, no tamanho pedido. cam = uma vista salva no 📷: com exata, sai do jeito que foi
     enquadrada; sem, vale só o ângulo e a cena é encaixada. Sem cam: frente 3/4 ou costas 3/4
     (costas). escala = {mmPorM, alturaMm}: a escala pedida (no plano do meio da cena, é
     perspectiva) e a altura da foto no papel; sem ela, a maior que cabe (ou a do enquadramento).
     Devolve {url, forcada (a escala pedida não coube), mmPorM (a que saiu)}. Melhor num visor à
     parte (canvas fora da tela): o canvas muda de tamanho enquanto tira */
  // a imagem da foto: reduzida (se desenhou maior) e, pedidas, com as cotas da mesma câmera
  function fotoSai(W,H,ss,comCotas){
    if(!(ss>1.01)&&!comCotas) return cv.toDataURL('image/jpeg',0.92);
    const r=document.createElement('canvas'); r.width=W; r.height=H; const x=r.getContext('2d'); x.imageSmoothingEnabled=true; x.imageSmoothingQuality='high';
    x.drawImage(cv,0,0,W,H); if(comCotas) cotasDesenha(x,W,H,mvpUlt,orto?orto.vista:null,comCotas==='px'?'px':true);
    return r.toDataURL('image/jpeg',0.92);
  }
  const fotoF=(W,H,cotas)=>({W, H, mg:cotas?76*Math.max(1,H/850):0});   // a margem das cotas na foto (as 3 fileiras e o texto: ver cotasDesenha)
  function foto(o){
    o=o||{};
    const ant={alvo:alvo.slice(), yaw, pitch, dist, fov, W:cv.width, H:cv.height, w, h, orto};
    const W=Math.round(o.w||1600), H=Math.round(o.h||1000);
    const teto=Math.min(4096, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)||4096, (gl.getParameter(gl.MAX_VIEWPORT_DIMS)||[4096])[0]);
    const ss=Math.max(1,Math.min(2,teto/Math.max(W,H)));          // desenha até 2× maior e reduz: sem serrilhado
    cv.width=Math.round(W*ss); cv.height=Math.round(H*ss); w=cv.width; h=cv.height;
    /* o ângulo: o guardado (de onde a câmera olhava) ou 3/4 de frente / de costas. O enquadramento é
       sempre o da cena: a menor distância em que os pontos dela cabem, com 10% de folga
       (a vista guardada tinha o palco e a pessoa, que a foto não mostra) */
    const k=o.cam, temK=!!(k&&isFinite(k.yaw)&&isFinite(k.pitch));
    const exata=!!(o.exata&&temK&&Array.isArray(k.alvo)&&k.dist>0);
    /* vista ortográfica: a escala vale na vista inteira. Pedida, é ela; sem, a escala redonda (1:50, 1:100…)
       em que o que foi enquadrado cabe */
    if(temK&&k.orto&&ORTO[k.orto.vista]){
      yaw=ORTO[k.orto.vista].yaw; pitch=ORTO[k.orto.vista].pitch; const asp=W/H;
      let meia;
      if(exata&&k.orto.meia>0){ alvo=k.alvo.slice(); meia=Math.max(k.orto.meia, k.orto.meia*(k.asp>0?k.asp:asp)/asp); }
      else{ const a=ajustaOrto(k.orto.vista,asp,false,fotoF(W,H,o.cotas)); alvo=a.alvo; meia=a.meia; }   // enquadrada aqui: com o espaço das cotas
      const E=/^iso/.test(k.orto.vista)?null:o.escala; let forcada=false, mmPorM=0;   // a isométrica não tem escala: fica como foi enquadrada
      if(E&&E.alturaMm>0){
        if(E.mmPorM>0){ const mE=E.alturaMm/E.mmPorM/2; if(exata||mE>=meia*(1-1e-9)) meia=mE; else forcada=true; }   // a folha mediu esta mesma vista: cabe (sem o erro de arredondamento)
        else{ const cabe=E.alturaMm/(2*meia), D=[1,2,5,10,20,25,50,75,100,125,150,200,250,300,400,500,750,1000,1250,1500,2000,2500,5000,10000].find(d=>1000/d<=cabe+1e-9)||10000;
          meia=E.alturaMm/(2*1000/D); }
        mmPorM=E.alturaMm/(2*meia); }
      orto={vista:k.orto.vista, meia}; soFoto=true; let url=null;
      try{ desenha(); url=fotoSai(W,H,ss,o.cotas); }
      finally{ soFoto=false; orto=ant.orto; alvo=ant.alvo; yaw=ant.yaw; pitch=ant.pitch; dist=ant.dist; fov=ant.fov; cv.width=ant.W; cv.height=ant.H; w=ant.w; h=ant.h; pede(); }
      return {url, forcada, mmPorM, orto:true};
    }
    orto=null;
    if(exata){ alvo=k.alvo.slice(); yaw=k.yaw; pitch=k.pitch; dist=k.dist; fov=k.fov>0?k.fov:FOV0;
      if(k.asp>0){ const fh=2*Math.atan(Math.tan(Math.atan(Math.tan(fov/2)*k.asp))/(W/H)); if(fh>fov) fov=fh; } }   // outra proporção: cabe tudo o que foi enquadrado (na largura também)
    else{
      const C=caixaFoto; fov=0.62;
      yaw=temK?k.yaw:o.costas?Math.PI-0.6:0.6; pitch=temK?Math.max(-0.6,Math.min(1.3,k.pitch)):o.costas?0.24:0.18;
      if(C){
        alvo=C.c.slice();
        const d=dirDe(yaw,pitch), f=d.map(v=>-v), r=[Math.cos(yaw),0,-Math.sin(yaw)], u=[r[1]*f[2]-r[2]*f[1], r[2]*f[0]-r[0]*f[2], r[0]*f[1]-r[1]*f[0]];
        const tv=Math.tan(fov/2)*0.9, th=tv*W/H, cantos=pontosFoto.length?pontosFoto:[];
        if(!cantos.length) for(let i=0;i<8;i++) cantos.push([i&1?C.mx[0]:C.mn[0], i&2?C.mx[1]:C.mn[1], i&4?C.mx[2]:C.mn[2]]);
        const cabe=D=>cantos.every(P=>{ const v=[0,1,2].map(j=>P[j]-(alvo[j]+D*d[j])), z=v[0]*f[0]+v[1]*f[1]+v[2]*f[2]; if(z<=0.05) return false;
          return Math.abs(v[0]*r[0]+v[1]*r[1]+v[2]*r[2])<=z*th && Math.abs(v[0]*u[0]+v[1]*u[1]+v[2]*u[2])<=z*tv; });
        const ajusta=()=>{ let a=0.2, b=300; for(let i=0;i<40;i++){ const m=(a+b)/2; if(cabe(m)) b=m; else a=m; } return b; };
        dist=ajusta();
        for(let it=0;it<2;it++){                              // centra o que aparece (o meio da caixa não é o meio da foto) e encaixa de novo
          const olho=alvo.map((v,j)=>v+dist*d[j]); let x0=1e9, x1=-1e9, y0=1e9, y1=-1e9;
          cantos.forEach(P=>{ const v=[0,1,2].map(j=>P[j]-olho[j]), z=v[0]*f[0]+v[1]*f[1]+v[2]*f[2]; if(z<=0.05) return;
            const x=(v[0]*r[0]+v[1]*r[1]+v[2]*r[2])/z, y=(v[0]*u[0]+v[1]*u[1]+v[2]*u[2])/z; x0=Math.min(x0,x); x1=Math.max(x1,x); y0=Math.min(y0,y); y1=Math.max(y1,y); });
          if(!(x1>x0)) break;
          const mx=(x0+x1)/2, my=(y0+y1)/2; for(let j=0;j<3;j++) alvo[j]+=(r[j]*mx+u[j]*my)*dist;
          dist=ajusta();
        }
      }
      else{ alvo=alvo0.slice(); dist=raio*2.3; }
    }
    // escala pedida: a distância em que 1 m no meio da cena vale mmPorM no papel; não cabendo, fica a que cabe
    const E=o.escala, tg=2*Math.tan(fov/2); let forcada=false;
    if(E&&E.mmPorM>0&&E.alturaMm>0){ const dE=E.alturaMm/(tg*E.mmPorM); if(exata||dE>=dist) dist=dE; else forcada=true; }
    const mmPorM=E&&E.alturaMm>0?E.alturaMm/(tg*dist):0;
    soFoto=true; let url=null;
    try{ desenha(); url=fotoSai(W,H,ss,o.cotas); }
    finally{ soFoto=false; orto=ant.orto; alvo=ant.alvo; yaw=ant.yaw; pitch=ant.pitch; dist=ant.dist; fov=ant.fov; cv.width=ant.W; cv.height=ant.H; w=ant.w; h=ant.h; pede(); }
    return {url, forcada, mmPorM};
  }
  const ledAgora=()=>Math.floor(performance.now()/(LED_MEIO*1000))%2;
  function ledLiga(){
    const tem=pecas.some(p=>p.led);
    if(tem&&!ledRelogio) ledRelogio=setInterval(()=>{ if(!document.hidden&&cv.isConnected&&cv.offsetParent&&ledAgora()!==ledFase) pede(); },100);
    else if(!tem&&ledRelogio){ clearInterval(ledRelogio); ledRelogio=0; }
  }

  /* os movimentos da câmera (dx, dy em px de tela) */
  const altura=()=>Math.max(100,cv.clientHeight||h);
  function olha(dx,dy){                                               // pan/tilt: o olho fica, a direção muda (a cena segue o dedo)
    const o=olhoDe(), k=fov/altura();
    yaw+=dx*k; pitch=Math.max(-1.3,Math.min(1.3,pitch-dy*k));
    const d=dirDe(yaw,pitch); alvo=[o[0]-dist*d[0], o[1]-dist*d[1], o[2]-dist*d[2]]; mexeu=true;
  }
  function desloca(dx,dy){                                            // arrasta a vista: alvo e olho andam juntos, no plano da tela
    if(modo==='pessoa') poeModo('olhar');                             // saiu do lugar dela: a pessoa volta a aparecer
    const k=orto?2*orto.meia/altura():2*Math.max(dist,raio*0.5)*Math.tan(fov/2)/altura(), f=dirDe(yaw,pitch).map(v=>-v), r=[Math.cos(yaw),0,-Math.sin(yaw)];
    const u=[r[1]*f[2]-r[2]*f[1], r[2]*f[0]-r[0]*f[2], r[0]*f[1]-r[1]*f[0]];
    for(let i=0;i<3;i++) alvo[i]+=-r[i]*dx*k+u[i]*dy*k; mexeu=true;
  }
  /* o zoom vai até onde der: na vista técnica até ~4 mm de altura na tela (o LED um por um); na órbita a câmera
     chega a 30 cm do ponto e daí em diante fecha a lente (teleobjetiva); afastando, abre a lente antes de andar */
  const FOV_MIN=0.002, DIST_MIN=0.3, lente=(f,q)=>2*Math.atan(Math.tan(f/2)*q);
  function aproxima(q){                                               // q < 1 aproxima
    if(orto){ orto.meia=Math.max(0.002,Math.min(raio*12,orto.meia*q)); return; }   // vista: a escala da tela
    if(modo==='girar'){
      if(q<1){ if(dist>DIST_MIN+1e-9) dist=Math.max(DIST_MIN,dist*q); else fov=Math.max(FOV_MIN,lente(fov,q)); }
      else if(fov<FOV0-1e-9) fov=Math.min(FOV0,lente(fov,q)); else dist=Math.min(raio*8,dist*q); }
    else fov=Math.max(FOV_MIN,Math.min(1.4,lente(fov,q)));            // parado: fecha ou abre a lente
  }
  // o zoom em relação ao enquadramento (1 = 100%: o da vista técnica ou o inicial da órbita)
  const zoomFator=()=>orto?zRef.orto/orto.meia
    :(modo==='girar'?zRef.dist/dist:1)*Math.tan((modo==='pessoa'?FOV_OLHOS:FOV0)/2)/Math.tan(fov/2);
  function zoomPara(z){ for(let i=0;i<6;i++){ const f=zoomFator(); if(!(f>0)||Math.abs(f/z-1)<1e-4) break; aproxima(f/z); } }
  function usaModo(m){
    if(m==='vista') return !!orto;
    if(orto){ saiOrto(); if(m==='girar'){ pitch=Math.max(0.02,Math.min(1.35,pitch)); poeModo('girar'); pede(); return true; } }   // a órbita sai da vista no mesmo ângulo
    if(m==='pessoa'){ if(!pessoaVis) return false; nosOlhos(true); mexeu=true; poeModo('pessoa'); }
    else if(m==='olhar') poeModo('olhar');
    else if(m==='girar'){ if(modo==='pessoa') inicial(); else { pitch=Math.max(0.02,Math.min(1.35,pitch)); fov=FOV0; poeModo('girar'); } }
    pede(); return true;
  }
  // gestos: um dedo (botão esquerdo) faz o do modo; dois dedos (ou botão direito, ou shift) arrastam a vista
  // e a pinça dá zoom; roda do mouse dá zoom; dois toques voltam
  const dedos=new Map(); let pinca=0, centro=null, botao=0, ultimoToque=0;
  const para=e=>{ e.stopPropagation(); };
  const meio=()=>{ const [a,b]=[...dedos.values()]; return {d:Math.hypot(a[0]-b[0],a[1]-b[1]), c:[(a[0]+b[0])/2,(a[1]+b[1])/2]}; };
  cv.addEventListener('contextmenu',e=>e.preventDefault());
  cv.addEventListener('pointerdown',e=>{ para(e); try{ cv.setPointerCapture(e.pointerId); }catch(_){} dedos.set(e.pointerId,[e.clientX,e.clientY]); botao=e.button||0;
    const ag=performance.now(); if(dedos.size===1&&botao===0&&ag-ultimoToque<320){ if(orto) vistaPoe(orto.vista); else inicial(); pede(); } ultimoToque=ag;
    if(dedos.size===2){ const q=meio(); pinca=q.d; centro=q.c; } });
  cv.addEventListener('pointermove',e=>{ if(!dedos.has(e.pointerId)) return; para(e); const ant=dedos.get(e.pointerId); dedos.set(e.pointerId,[e.clientX,e.clientY]);
    const dx=e.clientX-ant[0], dy=e.clientY-ant[1];
    if(dedos.size===1){
      if(botao===2||e.shiftKey||orto) desloca(dx,dy);                // na vista técnica, arrastar move
      else if(modo==='girar'){ const k=Math.min(1,fov/FOV0); yaw-=dx*0.008*k; pitch=Math.max(0.02,Math.min(1.35,pitch+dy*0.006*k)); }   // com a lente fechada, gira devagar
      else olha(dx,dy);
      pede(); }
    else if(dedos.size===2){ const q=meio(); if(centro&&modo!=='pessoa') desloca(q.c[0]-centro[0],q.c[1]-centro[1]); /* na Pessoa a pinça só dá zoom */ if(pinca>0) aproxima(pinca/q.d); pinca=q.d; centro=q.c; pede(); } });
  const solta=e=>{ dedos.delete(e.pointerId); if(dedos.size<2){ pinca=0; centro=null; } };
  cv.addEventListener('pointerup',solta); cv.addEventListener('pointercancel',solta);
  cv.addEventListener('wheel',e=>{ e.preventDefault(); para(e); aproxima(Math.exp(e.deltaY*0.0015)); pede(); },{passive:false});
  return {cena, textura, texturaAlta, tamanho, telaMp:TELA_MP, desenha:pede, inicial:()=>{ inicial(); pede(); },
          zoom:f=>{ aproxima(f); mexeu=true; pede(); },
          // o zoom em %: sem argumento, o de agora (1 = 100%, o enquadramento); com, vai até ele. enquadra: volta ao 100%
          zoomPct:z=>{ if(z>0){ zoomPara(z); mexeu=true; pede(); } return zoomFator(); },
          enquadra:()=>{ if(orto) vistaPoe(orto.vista); else inicial(); pede(); },
          modo:m=>m?usaModo(m):modo, temPessoa:()=>!!pessoaVis, quandoModo:fn=>{ quandoModo=fn; },
          // as vistas técnicas: sem argumento, a atual (null = perspectiva); com 'frente'|'tras'|'esq'|'dir'|'topo', vai pra ela enquadrada
          vista:v=>{ if(v===undefined) return orto?orto.vista:null; const ok=vistaPoe(v); pede(); return ok; },
          cotas:on=>{ if(on===undefined) return cotasOn; const tinha=!!cotasOn; cotasOn=on==='px'?'px':on?'m':false;
            if(orto&&tinha!==!!cotasOn) vistaPoe(orto.vista);                  // ligou/desligou numa vista: reenquadra (com ou sem o espaço das cotas)
            pede(); return cotasOn; },   // false | 'm' | 'px' 
          foto, caixa:()=>caixaFoto,
          // a meia altura (m) em que a foto W × H px de uma vista técnica, enquadrada sozinha, mostra a cena (com as cotas, se pedidas)
          medeOrto:(v,W,H,cotas)=>ORTO[v]&&W>0&&H>0?ajustaOrto(v,W/H,false,fotoF(W,H,cotas)).meia:0,
          // as caixas de cada screen (S1, S2…; a frente do LED), de cada palco (P1 o principal, P2…) e da pessoa, no mundo
          folgaTopo:px=>{ folgaTopo=px>0?px:null; },
          caixas:()=>cotasGeo?{telas:cotasGeo.Tk, palcos:cotasGeo.Sk, pessoa:cotasGeo.pes}:null,
          // um ponto do mundo na tela (px do canvas, como no CSS), pela última câmera desenhada; e o aviso a cada desenho
          tela:p=>{ const M=mvpUlt; if(!M) return null; const x=M[0]*p[0]+M[4]*p[1]+M[8]*p[2]+M[12], y=M[1]*p[0]+M[5]*p[1]+M[9]*p[2]+M[13], q=M[3]*p[0]+M[7]*p[1]+M[11]*p[2]+M[15];
            return q>1e-6?[(x/q+1)/2*cv.clientWidth,(1-y/q)/2*cv.clientHeight]:null; },
          quandoDesenha:fn=>{ quandoDesenha=fn; },
          // a câmera: sem argumento, devolve; com uma vista ({alvo, yaw, pitch, dist, fov}), vai até ela
          camera:k=>{ if(k&&Array.isArray(k.alvo)&&[k.yaw,k.pitch,k.dist].every(isFinite)){ if(modo==='pessoa') poeModo('olhar');
              alvo=k.alvo.slice(); yaw=k.yaw; pitch=k.pitch; dist=k.dist; fov=k.fov>0?k.fov:FOV0; mexeu=true;
              if(k.orto&&ORTO[k.orto.vista]){ orto={vista:k.orto.vista, meia:k.orto.meia>0?k.orto.meia:raio}; zRef.orto=ajustaOrto(k.orto.vista,w/Math.max(1,h),true).meia; poeModo('vista'); }   // o 100% é o enquadramento dessa vista
              else if(orto){ orto=null; poeModo('girar'); }
              pede(); }
            return {alvo:alvo.slice(), yaw, pitch, dist, fov, asp:w/Math.max(1,h), orto:orto?{vista:orto.vista, meia:orto.meia}:null}; },
          _cam:()=>({alvo:alvo.slice(), olho:olhoDe(), yaw, pitch, dist, fov, raio, alto:altura()})};
}

window.ProjetechAR={usdz, glb, zip, temAR, abreNoIphone, visor, curvaGeo, mfOnde:mfOndeCena, pessoaUlt:()=>pessoaUlt, _montaCena:monta, _cor:COR, _matPlaca:MAT_GAB, get _logoCostas(){ return LOGO_COSTAS; }};
})();
