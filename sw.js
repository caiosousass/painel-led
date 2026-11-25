/* Projetech · Painel de LED — service worker.
 * Rede primeiro (nunca serve versão velha quando há internet) e cache como reserva:
 * sem sinal no galpão o app abre do mesmo jeito. Os DADOS ficam no IndexedDB, não aqui. */
const CACHE = 'painel-led-v25';
const ARQUIVOS = [
  './', 'index.html', 'manifest.json', 'css/app.css', 'logo.png', 'logo-mark.png',
  'fonts/montserrat-400.woff2', 'fonts/montserrat-700.woff2', 'icons/icon-192.png',
  'js/app.js', 'js/motor.js', 'js/permissoes.js', 'js/dados.js', 'js/seed.js', 'js/historico.js', 'js/config.js', 'js/os.js', 'js/pdf.js',
  'js/ui/base.js', 'js/ui/inicio.js', 'js/ui/listas.js', 'js/ui/lista.js', 'js/ui/evento.js', 'js/ui/projsala.js', 'js/ui/receber.js', 'js/cabeamento.js', 'js/ui/separar.js', 'js/ui/retorno.js',
  'js/ui/estoque.js', 'js/ui/manutencao.js', 'js/ui/bancada.js', 'js/ui/regras.js', 'js/ui/catalogo.js',
  'js/ui/ajustes.js', 'js/ui/equipe.js', 'js/ui/imprimir.js', 'js/ui/relatorio.js', 'js/ui/graficos.js', 'js/ui/tres.js', 'vendor/ar.js', 'js/ui/projeto.js', 'vendor/supabase.min.js', 'vendor/jspdf.umd.min.js'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copia = res.clone(); caches.open(CACHE).then(c => c.put(req, copia)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
});
