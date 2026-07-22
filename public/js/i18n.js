// Showcase translations. English lives in index.html itself (the default
// language); only ES and CA (Mallorcan) are here. On language change, main.js
// saves the original innerHTML (EN) and restores it if switching back to EN.
//
// Mermaid diagrams stay in English across all languages (technical terms, and
// re-rendering them per language adds nothing).

export const LANGS = {
  en: { name: 'English', flag: flagUK() },
  es: { name: 'Español', flag: flagES() },
  ca: { name: 'Mallorquí', flag: flagMallorca() },
};

// Inline SVG flags (there is no emoji for the flag of Mallorca).
function flagUK() {
  return `<svg viewBox="0 0 60 36" xmlns="http://www.w3.org/2000/svg">
    <rect width="60" height="36" fill="#012169"/>
    <path d="M0,0 60,36 M60,0 0,36" stroke="#fff" stroke-width="7"/>
    <path d="M0,0 60,36 M60,0 0,36" stroke="#C8102E" stroke-width="3"/>
    <path d="M30,0 V36 M0,18 H60" stroke="#fff" stroke-width="12"/>
    <path d="M30,0 V36 M0,18 H60" stroke="#C8102E" stroke-width="7"/>
  </svg>`;
}
function flagES() {
  return `<svg viewBox="0 0 60 36" xmlns="http://www.w3.org/2000/svg">
    <rect width="60" height="36" fill="#AA151B"/>
    <rect y="9" width="60" height="18" fill="#F1BF00"/>
  </svg>`;
}
function flagMallorca() {
  // Senyera with a purple stripe and a white castle (simplified).
  return `<svg viewBox="0 0 60 36" xmlns="http://www.w3.org/2000/svg">
    <rect width="60" height="36" fill="#FCDD09"/>
    <rect y="4" width="60" height="4" fill="#DA121A"/>
    <rect y="12" width="60" height="4" fill="#DA121A"/>
    <rect y="20" width="60" height="4" fill="#DA121A"/>
    <rect y="28" width="60" height="4" fill="#DA121A"/>
    <rect width="22" height="36" fill="#5C3B8E"/>
    <g fill="#fff">
      <rect x="5" y="14" width="12" height="12"/>
      <rect x="5" y="10" width="3" height="4"/>
      <rect x="9.5" y="10" width="3" height="4"/>
      <rect x="14" y="10" width="3" height="4"/>
    </g>
  </svg>`;
}

export const translations = {
  es: {
    'subtitle': 'Showcase autoexplicativo: qué contiene la plantilla, cómo está conectado todo, cómo se despliega y una demo funcional contra la base de datos.',
    'tab.arch': '🏗️ Arquitectura',
    'tab.conn': '🔌 Conexiones (en vivo)',
    'tab.demo': '🧪 Demo CRUD',
    'tab.deploy': '🚀 Despliegue',
    'tab.api': '📚 API &amp; Tests',
    'tab.traffic': '📡 Tráfico',
    'tab.seo': '🔎 SEO',

    'traffic.h': '📡 Inteligencia de tráfico web',
    'traffic.p': 'Una herramienta de monitorización, auditoría e identificación de visitantes integrada en la propia app. Responde a lo que de verdad le importa a quien tiene la web: <strong>cuánta gente visita, quién es, desde dónde, si son humanos reales o bots, y si el tráfico está creciendo</strong>. Todo lo de abajo es en vivo desde <code>GET /api/traffic</code> — prueba los botones.',
    'traffic.privacy': '🔒 <strong>Privacidad por diseño.</strong> Esta página es pública, así que los valores sensibles de request/response (cabeceras Authorization, cookies, query strings) se <em>captan para auditoría pero nunca se guardan ni se muestran en claro</em> — solo ves que se captaron. Las IP se enmascaran (se elimina el último octeto) y además se hashean con sal para contar visitantes únicos sin revelar la dirección de nadie. Se respeta <code>Do-Not-Track</code>.',
    'traffic.h.series': 'Accesos a lo largo del tiempo (humanos vs bots)',
    'traffic.h.map': '🗺️ De dónde vienen los visitantes',
    'traffic.p.map': 'Burbujas dimensionadas por número de accesos, ubicadas en la posición de cada país. Pulsa una para filtrar todo el panel por ese país (servido de forma eficiente desde el GSI de DynamoDB).',
    'traffic.h.countries': '🌍 Países principales',
    'traffic.h.paths': '📄 Páginas principales',
    'traffic.h.referrers': '🔗 Orígenes (referrers)',
    'traffic.h.browsers': '🌐 Navegadores',
    'traffic.h.os': '💻 Sistemas',
    'traffic.h.devices': '📱 Dispositivos',
    'traffic.h.feed': '🛰️ Feed de accesos en vivo (redactado)',
    'traffic.h.visitors': '🧑‍🤝‍🧑 Explorador de visitantes',
    'traffic.p.visitors': 'Cada visitante es un fingerprint del navegador (canvas + señales no personales, hasheadas). Permite contar personas únicas y detectar recurrentes sin necesidad de login.',
    'traffic.h.how': 'Cómo funciona',

    'seo.h': '🔎 SEO — cómo consigue aparecer esta web en Google',
    'seo.intro': 'El SEO (Search Engine Optimization) es el arte de ayudar a los buscadores a <em>entender</em> y <em>confiar</em> en tu página para que aparezca cuando alguien busca lo que ofreces. No pagas a Google por salir aquí — haces que la página sea fácil de leer tanto para humanos como para los rastreadores. Aquí lo tienes en cristiano, y exactamente lo que esta plantilla ya hace por ti.',
    'seo.h.how': 'Cómo funciona un buscador, en 3 pasos',
    'seo.h.does': 'Lo que esta plantilla ya hace',
    'seo.does': `<li><strong><code>&lt;title&gt;</code> descriptivo y meta descripción</strong> — el titular azul y el texto gris que ves en los resultados de Google. Escritos en torno a de qué va la web.</li>
      <li><strong>Palabras clave en contenido real</strong> — los buscadores posicionan las palabras que realmente aparecen en la página. Todo lo que menciona esta app (Vercel, DynamoDB, monitorización, infraestructura automatizada…) es texto genuino, no trucos ocultos.</li>
      <li><strong>Datos estructurados (Schema.org JSON-LD)</strong> — un bloque legible por máquina que le dice a Google "esto es una <em>SoftwareApplication</em>, hecha por la <em>persona</em> Raúl Adamuz, publicada por la <em>organización</em> Infranettone". Así se consiguen resultados enriquecidos y enlaces en el panel de conocimiento.</li>
      <li><strong><code>robots.txt</code> + <code>sitemap.xml</code></strong> — servidos en la raíz del sitio, invitan a los rastreadores y listan las páginas a indexar.</li>
      <li><strong>URL canónica + etiquetas Open Graph</strong> — una dirección oficial para la página, más tarjetas de vista previa bonitas al compartir en redes / WhatsApp.</li>
      <li><strong>Rápida, apta para móvil, HTTPS</strong> — Vercel te da CDN global y SSL automático; velocidad y móvil son factores de posicionamiento.</li>`,
    'seo.h.you': 'Lo que solo puedes hacer tú (off-page)',
    'seo.you': `<li><strong>Consigue enlaces</strong> — cuando otras webs enlazan la tuya, Google confía más. Comparte el repo, escribe sobre él, enlázalo desde tus otros proyectos.</li>
      <li><strong>Ten paciencia</strong> — la indexación tarda de días a semanas. Puedes acelerar el primer paso en <a href="https://search.google.com/search-console" target="_blank">Google Search Console</a>: añade el dominio y pulsa "Solicitar indexación".</li>
      <li><strong>Mantén el contenido real y específico</strong> — las páginas que responden de verdad a una búsqueda posicionan; el amontonar palabras clave se penaliza.</li>`,
    'seo.note': '💡 <strong>En resumen:</strong> esta página ya está construida para que la encuentren cuando alguien busca infraestructura automatizada, plantillas de Vercel/DynamoDB o herramientas de tráfico web — y acredita a <strong>Infranettone</strong> y a su fundador de forma legible por máquina. El resto son enlaces y tiempo.',

    'footer.tagline': 'referente mundial en infraestructura automatizada con IA',
    'footer.by': 'Hecho por',
    'footer.founder': 'fundador de Infranettone',
    'footer.repo': 'repositorio fuente',

    'arch.h.overview': 'Visión general',
    'arch.p.overview': 'Un único repo contiene <strong>frontend estático</strong>, <strong>API Express</strong> e <strong>infraestructura como código</strong>. Vercel sirve ambos (frontend + API) como una función serverless gratuita; los datos viven en una tabla DynamoDB de AWS en modo <em>pay-per-request</em> (coste 0 sin tráfico). GitHub Actions despliega la infraestructura.',
    'arch.h.flow': 'Flujo de una petición (añadir un registro)',
    'arch.h.model': 'Modelo de datos: single-table design',
    'arch.p.model': 'Toda la app usa <strong>una sola tabla</strong>. El prefijo de <code>pk</code> discrimina la entidad; añadir una entidad nueva no requiere tocar la infraestructura, solo un servicio nuevo.',
    'arch.model.table': `<table>
        <thead><tr><th>pk</th><th>sk</th><th>atributos</th><th>uso</th></tr></thead>
        <tbody>
          <tr><td><code>ITEM</code></td><td><code>&lt;isoDate&gt;#&lt;uuid&gt;</code></td><td>id, text, createdAt</td><td>Registros de la demo (orden cronológico gratis vía Query)</td></tr>
          <tr><td><em>TU_ENTIDAD</em></td><td><em>lo que necesites</em></td><td>…</td><td>Añade el prefijo en <code>src/config/dynamo.js</code> y crea un servicio</td></tr>
        </tbody>
      </table>`,
    'arch.h.structure': 'Estructura del repositorio',
    'arch.h.decisions': 'Decisiones de diseño',
    'arch.decisions': `<li><strong>Un solo deploy</strong>: el frontend lo sirve Express (<code>express.static</code>), así que no hay CORS en producción ni dos pipelines.</li>
      <li><strong>Fallback sin AWS</strong>: sin credenciales la app funciona en memoria. Puedes desplegar en Vercel <em>antes</em> de tener la infra y verlo todo funcionando; el panel de estado indica el modo activo.</li>
      <li><strong>Credenciales de mínimo privilegio</strong>: el usuario IAM de Vercel solo puede leer/escribir <em>esta</em> tabla; el del pipeline solo tocar <em>este</em> stack.</li>
      <li><strong>Infra idempotente</strong>: CloudFormation con <code>DeletionPolicy: Retain</code> — borrar el stack jamás borra datos.</li>
      <li><strong>Coste 0 en reposo</strong>: Vercel Hobby + DynamoDB on-demand + GitHub Actions gratis en repos públicos.</li>`,

    'conn.h': 'Estado de conexiones en tiempo real',
    'conn.p': 'Datos servidos por <code>GET /api/status</code>: el backend comprueba sus variables de entorno y hace un <code>DescribeTable</code> real contra DynamoDB.',
    'conn.refresh': '↻ Refrescar',
    'conn.h.raw': 'Respuesta cruda',

    'demo.h': 'Demo: registros contra la base de datos',
    'demo.p': 'Cada acción llama a la API real (<code>/api/items</code>). Si el estado dice <strong>dynamodb</strong>, esto escribe en tu tabla de AWS; si dice <strong>memoria</strong>, escribe en la RAM del servidor. El código es idéntico en ambos casos.',
    'demo.placeholder': 'Texto del nuevo registro…',
    'demo.add': '＋ Añadir registro',
    'demo.hint': 'Consejo: abre esta página en dos pestañas y añade un registro en una; refresca la otra para ver la persistencia compartida.',

    'deploy.h.pipeline': 'Pipeline de despliegue',
    'deploy.h.steps': 'Pasos, en orden',
    'deploy.steps': `<li>
        <strong>Probar en local (0 dependencias externas)</strong>
        <pre class="code">npm install
npm test        # 6 tests, modo memoria
npm run dev     # http://localhost:3000</pre>
      </li>
      <li>
        <strong>Subir a GitHub</strong> — crea el repo <em>manualmente</em> si no existe
        (<a href="https://github.com/new" target="_blank">github.com/new</a> o
        <code>gh repo create usuario/mi-app --public --source . --push</code>) y haz push.
        El workflow <code>ci.yml</code> ya pasa en verde sin ningún secreto.
        <p class="hint">💡 Puedes marcarlo como <strong>Template repository</strong> (Settings →
        General): los repos generados con "Use this template" copian todo, incluidos los workflows
        de CI, que funcionan igual. Lo único que no se hereda son los <strong>secretos</strong>:
        en cada repo generado repite el paso de <code>setup-github-secrets.sh</code> y cambia
        <code>STACK_NAME</code>/<code>TABLE_NAME</code> en <code>deploy-infra.yml</code> si
        quieres tabla propia por app.</p>
      </li>
      <li>
        <strong>Desplegar en Vercel (aún sin AWS)</strong> — importa el repo en
        <a href="https://vercel.com/new" target="_blank">vercel.com/new</a>. Detecta
        <code>vercel.json</code> y publica. La app funciona ya, en modo memoria.
      </li>
      <li>
        <strong>Crear la infraestructura AWS</strong> — dos opciones:
        <pre class="code"># A) Por pipeline (recomendado): sube los secretos y lanza el workflow
./scripts/setup-github-secrets.sh --profile miperfil --repo usuario/repo
gh workflow run deploy-infra.yml

# B) A mano desde tu máquina
aws cloudformation deploy --template-file infra/dynamodb.yml \\
  --stack-name vedtemplate-app --profile miperfil --region eu-west-1</pre>
      </li>
      <li>
        <strong>Crear el usuario IAM de la app y conectar Vercel</strong>
        <pre class="code">./scripts/setup-aws.sh --profile miperfil
# Pega las 4 variables que imprime en Vercel → Settings → Environment Variables
# y redepliega. La pestaña "Conexiones" pasará a verde.</pre>
      </li>
      <li>
        <strong>Sembrar datos de ejemplo (opcional)</strong>
        <pre class="code">cp .env.example .env   # pega ahí las mismas credenciales
npm run seed</pre>
      </li>`,
    'deploy.h.cli': 'Despliegue 100% por CLI — flujo real de esta instancia',
    'deploy.p.cli': 'Esta instancia (<a href="https://vedtemplate.infranettone.com">vedtemplate.infranettone.com</a>) se desplegó entera desde terminal. Solo hubo <strong>dos autorizaciones manuales</strong> de un clic: el login por device-code (gh y vercel) y la instalación de la GitHub App de Vercel en la organización para el auto-deploy.',
    'deploy.hint.gotchas': 'Gotchas ya corregidos en la plantilla: Node 20 no expande globs en <code>node --test</code>; Vercel trunca el dominio <code>*.vercel.app</code> con nombres largos; Vercel define su propia <code>AWS_REGION</code> en runtime; los repos generados desde un template no heredan los secretos de GitHub.',
    'deploy.h.env': 'Variables de entorno',
    'deploy.env.table': `<table>
        <thead><tr><th>Variable</th><th>Dónde</th><th>Para qué</th></tr></thead>
        <tbody>
          <tr><td><code>AWS_REGION</code></td><td>Vercel + .env</td><td>Región de la tabla (eu-west-1)</td></tr>
          <tr><td><code>DYNAMODB_TABLE</code></td><td>Vercel + .env</td><td>Nombre de la tabla</td></tr>
          <tr><td><code>AWS_ACCESS_KEY_ID</code> / <code>AWS_SECRET_ACCESS_KEY</code></td><td>Vercel + .env</td><td>Usuario IAM acotado a la tabla (setup-aws.sh)</td></tr>
          <tr><td><code>CORS_ORIGINS</code></td><td>opcional</td><td>Solo si otra web llama a esta API</td></tr>
          <tr><td><code>AWS_ACCESS_KEY_ID/SECRET</code> (secrets de GitHub)</td><td>repo</td><td>Usuario deploy del pipeline (setup-github-secrets.sh)</td></tr>
        </tbody>
      </table>`,

    'api.h.endpoints': 'Endpoints',
    'api.endpoints.table': `<table>
        <thead><tr><th>Método</th><th>Ruta</th><th>Descripción</th></tr></thead>
        <tbody>
          <tr><td>GET</td><td><code>/api/status/health</code></td><td>Health check instantáneo (para monitores)</td></tr>
          <tr><td>GET</td><td><code>/api/status</code></td><td>Estado completo: env, runtime, DynamoDB con latencia</td></tr>
          <tr><td>GET</td><td><code>/api/items</code></td><td>Lista los registros (máx. 100, más recientes primero)</td></tr>
          <tr><td>POST</td><td><code>/api/items</code></td><td>Crea un registro — body <code>{"text": "..."}</code></td></tr>
          <tr><td>DELETE</td><td><code>/api/items/:id</code></td><td>Borra un registro</td></tr>
        </tbody>
      </table>`,
    'api.h.curl': 'Pruébalo con curl',
    'api.h.tests': 'Tests automáticos',
    'api.p.tests': '<code>npm test</code> ejecuta <code>tests/app.test.js</code> con el runner nativo de Node (<code>node --test</code>, cero dependencias): levanta la app real en un puerto efímero y recorre la API completa en modo memoria — health, status, CRUD entero, validación 400 y 404, y que el frontend se sirve. GitHub Actions (<code>ci.yml</code>) lo ejecuta en cada push y PR.',

    'footer.p': 'vedtemplate · Express · DynamoDB · Vercel · GitHub Actions',

    // Strings generated from JS
    'js.badge.dynamo': '● Persistencia: DynamoDB ({table} · {region})',
    'js.badge.memory': '● Persistencia: memoria (sin credenciales AWS)',
    'js.stat.mode': 'Modo de almacenamiento',
    'js.stat.dynamo': 'DynamoDB',
    'js.stat.noaccess': '❌ sin acceso',
    'js.stat.disabled': '— desactivado',
    'js.stat.detail': 'Detalle',
    'js.stat.platform': 'Plataforma',
    'js.stat.uptime': 'Uptime del proceso',
    'js.stat.env': 'Variables de entorno',
    'js.items.empty': 'No hay registros todavía. Añade el primero arriba 👆',
    'js.items.delete': '🗑 borrar',
    'js.items.loaderr': 'Error cargando registros:',
    'js.error': 'Error',

    'tr.kpi.hits': 'Accesos totales (en el rango)',
    'tr.kpi.unique': 'Visitantes únicos',
    'tr.kpi.split': 'Humanos vs bots',
    'tr.kpi.confirmed': 'Humanos confirmados por JS',
    'tr.kpi.trend': 'Tendencia',
    'tr.trend.sub': 'mitad reciente vs mitad anterior del rango',
    'tr.refresh': '↻ Refrescar',
    'tr.simulate': '✨ Simular tráfico',
    'tr.simulating': 'Simulando…',
    'tr.simulate.confirm': '¿Insertar ~60 accesos sintéticos (falsos) para probar el panel? Esto solo ocurre cuando lo confirmas — nada se simula automáticamente.',
    'tr.legend.human': 'Humanos',
    'tr.legend.bot': 'Bots',
    'tr.you': 'Eres el visitante',
    'tr.human': 'Humano',
    'tr.bot': 'Bot',
    'tr.unverified': 'Sin verificar',
    'tr.direct': '(directo)',
    'tr.novisitors': 'Aún no hay visitantes. Pulsa "Simular tráfico" o navega por la web.',
    'tr.nodata': 'Todavía no hay datos en este rango.',
    'tr.noresults': 'Sin resultados.',
    'tr.sensitive': 'sensibles captados',
    'tr.live': 'En vivo',
    'tr.filtered': 'Filtrado por país:',
    'tr.clear': 'Quitar filtro',
    'tr.map.none': 'Aún no hay países ubicables en este rango.',
    'tr.col.ago': 'Hace',
    'tr.col.time': 'Hora',
    'tr.col.path': 'Ruta',
    'tr.col.geo': 'Ubicación',
    'tr.col.device': 'Dispositivo',
    'tr.col.class': 'Clase',
    'tr.col.ref': 'Origen',
    'tr.col.vid': 'Visitante',
    'tr.v.id': 'Fingerprint',
    'tr.v.hits': 'Accesos',
    'tr.v.first': 'Primera vez',
    'tr.v.last': 'Última vez',
    'tr.v.human': 'Confirmado',
    'tr.of': 'de',
    'tr.range.label': 'Rango',
    'tr.range.1h': 'Última hora',
    'tr.range.24h': 'Últimas 24 horas',
    'tr.range.7d': 'Últimos 7 días',
    'tr.range.30d': 'Últimos 30 días',
    'tr.range.90d': 'Últimos 90 días',
    'tr.range.1y': 'Último año',
    'tr.range.custom': 'Personalizado',
    'tr.from': 'Desde',
    'tr.to': 'Hasta',
    'tr.limit.label': 'Máx. filas',
    'tr.capped': 'Mostrando los {n} accesos más recientes de este rango — acota el rango o sube el límite para verlos todos.',
    'tr.capped.badge': 'limitado',
    'tr.unit.hour': 'por hora',
    'tr.unit.day': 'por día',
    'tr.unit.month': 'por mes',
    'tr.filter.all': 'Todos',
    'tr.filter.humans': 'Humanos',
    'tr.filter.bots': 'Bots',
    'tr.search': 'Buscar ruta, país, visitante…',
    'tr.perpage': 'por página',
  },

  ca: {
    'subtitle': 'Showcase autoexplicatiu: què conté sa plantilla, com està connectat tot, com es desplega i una demo funcional contra sa base de dades.',
    'tab.arch': '🏗️ Arquitectura',
    'tab.conn': '🔌 Connexions (en viu)',
    'tab.demo': '🧪 Demo CRUD',
    'tab.deploy': '🚀 Desplegament',
    'tab.api': '📚 API &amp; Tests',
    'tab.traffic': '📡 Trànsit',
    'tab.seo': '🔎 SEO',

    'traffic.h': '📡 Intel·ligència de trànsit web',
    'traffic.p': 'Una eina de monitorització, auditoria i identificació de visitants integrada dins sa mateixa app. Respon a lo que de veres importa a qui té sa web: <strong>quanta gent visita, qui és, des d\'on, si són humans reals o bots, i si es trànsit està creixent</strong>. Tot lo d\'abaix és en viu des de <code>GET /api/traffic</code> — prova es botons.',
    'traffic.privacy': '🔒 <strong>Privacitat per disseny.</strong> Aquesta pàgina és pública, així que es valors sensibles de request/response (capçaleres Authorization, cookies, query strings) es <em>capten per auditoria però mai es guarden ni es mostren en clar</em> — només veus que es van captar. Ses IP s\'emmascaren (es lleva es darrer octet) i a més es fan hash amb sal per comptar visitants únics sense revelar s\'adreça de ningú. Es respecta <code>Do-Not-Track</code>.',
    'traffic.h.series': 'Accessos al llarg des temps (humans vs bots)',
    'traffic.h.map': '🗺️ D\'on vénen es visitants',
    'traffic.p.map': 'Bombolles dimensionades pes nombre d\'accessos, ubicades a sa posició de cada país. Prem una per filtrar tot es panell per aquest país (servit de forma eficient des des GSI de DynamoDB).',
    'traffic.h.countries': '🌍 Països principals',
    'traffic.h.paths': '📄 Pàgines principals',
    'traffic.h.referrers': '🔗 Orígens (referrers)',
    'traffic.h.browsers': '🌐 Navegadors',
    'traffic.h.os': '💻 Sistemes',
    'traffic.h.devices': '📱 Dispositius',
    'traffic.h.feed': '🛰️ Feed d\'accessos en viu (redactat)',
    'traffic.h.visitors': '🧑‍🤝‍🧑 Explorador de visitants',
    'traffic.p.visitors': 'Cada visitant és un fingerprint des navegador (canvas + senyals no personals, amb hash). Permet comptar persones úniques i detectar recurrents sense necessitat de login.',
    'traffic.h.how': 'Com funciona',

    'seo.h': '🔎 SEO — com aconsegueix aparèixer aquesta web a Google',
    'seo.intro': 'Es SEO (Search Engine Optimization) és s\'art d\'ajudar es cercadors a <em>entendre</em> i <em>confiar</em> en sa teva pàgina perquè aparegui quan qualcú cerca lo que ofereixes. No pagues Google per sortir aquí — fas que sa pàgina sigui fàcil de llegir tant per humans com per ses aranyes. Aquí ho tens clar, i exactament lo que aquesta plantilla ja fa per tu.',
    'seo.h.how': 'Com funciona un cercador, en 3 passes',
    'seo.h.does': 'Lo que aquesta plantilla ja fa',
    'seo.does': `<li><strong><code>&lt;title&gt;</code> descriptiu i meta descripció</strong> — es titular blau i es text gris que veus as resultats de Google. Escrits al voltant de què va sa web.</li>
      <li><strong>Paraules clau en contingut real</strong> — es cercadors posicionen ses paraules que realment surten a sa pàgina. Tot lo que menciona aquesta app (Vercel, DynamoDB, monitorització, infraestructura automatitzada…) és text genuí, no trucs amagats.</li>
      <li><strong>Dades estructurades (Schema.org JSON-LD)</strong> — un bloc llegible per màquina que diu a Google "això és una <em>SoftwareApplication</em>, feta per sa <em>persona</em> Raúl Adamuz, publicada per s\'<em>organització</em> Infranettone". Així s\'aconsegueixen resultats enriquits i enllaços as panell de coneixement.</li>
      <li><strong><code>robots.txt</code> + <code>sitemap.xml</code></strong> — servits a s\'arrel des lloc, conviden ses aranyes i llisten ses pàgines a indexar.</li>
      <li><strong>URL canònica + etiquetes Open Graph</strong> — una adreça oficial per sa pàgina, més targetes de vista prèvia guapes en compartir a xarxes / WhatsApp.</li>
      <li><strong>Ràpida, apta per mòbil, HTTPS</strong> — Vercel et dóna CDN global i SSL automàtic; velocitat i mòbil són factors de posicionament.</li>`,
    'seo.h.you': 'Lo que només pots fer tu (off-page)',
    'seo.you': `<li><strong>Aconsegueix enllaços</strong> — quan altres webs enllacen sa teva, Google confia més. Comparteix es repo, escriu-ne, enllaça\'l des des teus altres projectes.</li>
      <li><strong>Té paciència</strong> — s\'indexació tarda de dies a setmanes. Pots accelerar sa primera passa a <a href="https://search.google.com/search-console" target="_blank">Google Search Console</a>: afegeix es domini i prem "Sol·licitar indexació".</li>
      <li><strong>Mantén es contingut real i específic</strong> — ses pàgines que responen de veres a una cerca posicionen; amuntegar paraules clau es penalitza.</li>`,
    'seo.note': '💡 <strong>En resum:</strong> aquesta pàgina ja està construïda perquè la trobin quan qualcú cerca infraestructura automatitzada, plantilles de Vercel/DynamoDB o eines de trànsit web — i acredita <strong>Infranettone</strong> i es seu fundador de forma llegible per màquina. Sa resta són enllaços i temps.',

    'footer.tagline': 'referent mundial en infraestructura automatitzada amb IA',
    'footer.by': 'Fet per',
    'footer.founder': 'fundador d\'Infranettone',
    'footer.repo': 'repositori font',

    'arch.h.overview': 'Visió general',
    'arch.p.overview': 'Un únic repo conté es <strong>frontend estàtic</strong>, s\'<strong>API Express</strong> i sa <strong>infraestructura com a codi</strong>. Vercel serveix tots dos (frontend + API) com una funció serverless gratuïta; ses dades viuen a una taula DynamoDB d\'AWS en mode <em>pay-per-request</em> (cost 0 sense trànsit). GitHub Actions desplega sa infraestructura.',
    'arch.h.flow': 'Flux d\'una petició (afegir un registre)',
    'arch.h.model': 'Model de dades: single-table design',
    'arch.p.model': 'Tota s\'app empra <strong>una sola taula</strong>. Es prefix de <code>pk</code> discrimina s\'entitat; afegir una entitat nova no requereix tocar sa infraestructura, només un servei nou.',
    'arch.model.table': `<table>
        <thead><tr><th>pk</th><th>sk</th><th>atributs</th><th>ús</th></tr></thead>
        <tbody>
          <tr><td><code>ITEM</code></td><td><code>&lt;isoDate&gt;#&lt;uuid&gt;</code></td><td>id, text, createdAt</td><td>Registres de sa demo (ordre cronològic de franc via Query)</td></tr>
          <tr><td><em>SA_TEVA_ENTITAT</em></td><td><em>lo que necessitis</em></td><td>…</td><td>Afegeix es prefix a <code>src/config/dynamo.js</code> i crea un servei</td></tr>
        </tbody>
      </table>`,
    'arch.h.structure': 'Estructura des repositori',
    'arch.h.decisions': 'Decisions de disseny',
    'arch.decisions': `<li><strong>Un sol deploy</strong>: es frontend el serveix Express (<code>express.static</code>), així que no hi ha CORS a producció ni dos pipelines.</li>
      <li><strong>Fallback sense AWS</strong>: sense credencials s'app funciona en memòria. Pots desplegar a Vercel <em>abans</em> de tenir sa infra i veure-ho tot funcionant; es panell d'estat indica es mode actiu.</li>
      <li><strong>Credencials de mínim privilegi</strong>: s'usuari IAM de Vercel només pot llegir/escriure <em>aquesta</em> taula; es des pipeline només tocar <em>aquest</em> stack.</li>
      <li><strong>Infra idempotent</strong>: CloudFormation amb <code>DeletionPolicy: Retain</code> — esborrar es stack mai esborra dades.</li>
      <li><strong>Cost 0 en repòs</strong>: Vercel Hobby + DynamoDB on-demand + GitHub Actions de franc a repos públics.</li>`,

    'conn.h': 'Estat de connexions en temps real',
    'conn.p': 'Dades servides per <code>GET /api/status</code>: es backend comprova ses seves variables d\'entorn i fa un <code>DescribeTable</code> real contra DynamoDB.',
    'conn.refresh': '↻ Refrescar',
    'conn.h.raw': 'Resposta crua',

    'demo.h': 'Demo: registres contra sa base de dades',
    'demo.p': 'Cada acció crida s\'API real (<code>/api/items</code>). Si s\'estat diu <strong>dynamodb</strong>, això escriu a sa teva taula d\'AWS; si diu <strong>memòria</strong>, escriu a sa RAM des servidor. Es codi és idèntic en tots dos casos.',
    'demo.placeholder': 'Text des nou registre…',
    'demo.add': '＋ Afegir registre',
    'demo.hint': 'Consell: obri aquesta pàgina a dues pestanyes i afegeix un registre a una; refresca s\'altra per veure sa persistència compartida.',

    'deploy.h.pipeline': 'Pipeline de desplegament',
    'deploy.h.steps': 'Passes, en ordre',
    'deploy.steps': `<li>
        <strong>Provar en local (0 dependències externes)</strong>
        <pre class="code">npm install
npm test        # 6 tests, mode memòria
npm run dev     # http://localhost:3000</pre>
      </li>
      <li>
        <strong>Pujar a GitHub</strong> — crea es repo <em>manualment</em> si no existeix
        (<a href="https://github.com/new" target="_blank">github.com/new</a> o
        <code>gh repo create usuari/sa-meva-app --public --source . --push</code>) i fes push.
        Es workflow <code>ci.yml</code> ja passa en verd sense cap secret.
        <p class="hint">💡 Pots marcar-lo com a <strong>Template repository</strong> (Settings →
        General): es repos generats amb "Use this template" copien tot, inclosos es workflows
        de CI, que funcionen igual. L'únic que no s'hereta són es <strong>secrets</strong>:
        a cada repo generat repeteix sa passa de <code>setup-github-secrets.sh</code> i canvia
        <code>STACK_NAME</code>/<code>TABLE_NAME</code> a <code>deploy-infra.yml</code> si
        vols taula pròpia per app.</p>
      </li>
      <li>
        <strong>Desplegar a Vercel (encara sense AWS)</strong> — importa es repo a
        <a href="https://vercel.com/new" target="_blank">vercel.com/new</a>. Detecta
        <code>vercel.json</code> i publica. S'app ja funciona, en mode memòria.
      </li>
      <li>
        <strong>Crear sa infraestructura AWS</strong> — dues opcions:
        <pre class="code"># A) Per pipeline (recomanat): puja es secrets i llança es workflow
./scripts/setup-github-secrets.sh --profile esmeuperfil --repo usuari/repo
gh workflow run deploy-infra.yml

# B) A mà des de sa teva màquina
aws cloudformation deploy --template-file infra/dynamodb.yml \\
  --stack-name vedtemplate-app --profile esmeuperfil --region eu-west-1</pre>
      </li>
      <li>
        <strong>Crear s'usuari IAM de s'app i connectar Vercel</strong>
        <pre class="code">./scripts/setup-aws.sh --profile esmeuperfil
# Aferra ses 4 variables que imprimeix a Vercel → Settings → Environment Variables
# i redesplega. Sa pestanya "Connexions" passarà a verd.</pre>
      </li>
      <li>
        <strong>Sembrar dades d'exemple (opcional)</strong>
        <pre class="code">cp .env.example .env   # aferra-hi ses mateixes credencials
npm run seed</pre>
      </li>`,
    'deploy.h.cli': 'Desplegament 100% per CLI — flux real d\'aquesta instància',
    'deploy.p.cli': 'Aquesta instància (<a href="https://vedtemplate.infranettone.com">vedtemplate.infranettone.com</a>) es va desplegar sencera des des terminal. Només hi va haver <strong>dues autoritzacions manuals</strong> d\'un clic: es login per device-code (gh i vercel) i sa instal·lació de sa GitHub App de Vercel a s\'organització per s\'auto-deploy.',
    'deploy.hint.gotchas': 'Gotchas ja corregits a sa plantilla: Node 20 no expandeix globs a <code>node --test</code>; Vercel trunca es domini <code>*.vercel.app</code> amb noms llargs; Vercel defineix sa seva pròpia <code>AWS_REGION</code> en runtime; es repos generats des d\'un template no hereten es secrets de GitHub.',
    'deploy.h.env': 'Variables d\'entorn',
    'deploy.env.table': `<table>
        <thead><tr><th>Variable</th><th>On</th><th>Per què</th></tr></thead>
        <tbody>
          <tr><td><code>AWS_REGION</code></td><td>Vercel + .env</td><td>Regió de sa taula (eu-west-1)</td></tr>
          <tr><td><code>DYNAMODB_TABLE</code></td><td>Vercel + .env</td><td>Nom de sa taula</td></tr>
          <tr><td><code>AWS_ACCESS_KEY_ID</code> / <code>AWS_SECRET_ACCESS_KEY</code></td><td>Vercel + .env</td><td>Usuari IAM acotat a sa taula (setup-aws.sh)</td></tr>
          <tr><td><code>CORS_ORIGINS</code></td><td>opcional</td><td>Només si una altra web crida aquesta API</td></tr>
          <tr><td><code>AWS_ACCESS_KEY_ID/SECRET</code> (secrets de GitHub)</td><td>repo</td><td>Usuari deploy des pipeline (setup-github-secrets.sh)</td></tr>
        </tbody>
      </table>`,

    'api.h.endpoints': 'Endpoints',
    'api.endpoints.table': `<table>
        <thead><tr><th>Mètode</th><th>Ruta</th><th>Descripció</th></tr></thead>
        <tbody>
          <tr><td>GET</td><td><code>/api/status/health</code></td><td>Health check instantani (per monitors)</td></tr>
          <tr><td>GET</td><td><code>/api/status</code></td><td>Estat complet: env, runtime, DynamoDB amb latència</td></tr>
          <tr><td>GET</td><td><code>/api/items</code></td><td>Llista es registres (màx. 100, més recents primer)</td></tr>
          <tr><td>POST</td><td><code>/api/items</code></td><td>Crea un registre — body <code>{"text": "..."}</code></td></tr>
          <tr><td>DELETE</td><td><code>/api/items/:id</code></td><td>Esborra un registre</td></tr>
        </tbody>
      </table>`,
    'api.h.curl': 'Prova-ho amb curl',
    'api.h.tests': 'Tests automàtics',
    'api.p.tests': '<code>npm test</code> executa <code>tests/app.test.js</code> amb es runner natiu de Node (<code>node --test</code>, zero dependències): aixeca s\'app real a un port efímer i recorre s\'API completa en mode memòria — health, status, es CRUD sencer, validació 400 i 404, i que es frontend se serveix. GitHub Actions (<code>ci.yml</code>) l\'executa a cada push i PR.',

    'footer.p': 'vedtemplate · Express · DynamoDB · Vercel · GitHub Actions',

    'js.badge.dynamo': '● Persistència: DynamoDB ({table} · {region})',
    'js.badge.memory': '● Persistència: memòria (sense credencials AWS)',
    'js.stat.mode': 'Mode d\'emmagatzematge',
    'js.stat.dynamo': 'DynamoDB',
    'js.stat.noaccess': '❌ sense accés',
    'js.stat.disabled': '— desactivat',
    'js.stat.detail': 'Detall',
    'js.stat.platform': 'Plataforma',
    'js.stat.uptime': 'Uptime des procés',
    'js.stat.env': 'Variables d\'entorn',
    'js.items.empty': 'Encara no hi ha registres. Afegeix es primer aquí dalt 👆',
    'js.items.delete': '🗑 esborrar',
    'js.items.loaderr': 'Error carregant registres:',
    'js.error': 'Error',

    'tr.kpi.hits': 'Accessos totals (en es rang)',
    'tr.kpi.unique': 'Visitants únics',
    'tr.kpi.split': 'Humans vs bots',
    'tr.kpi.confirmed': 'Humans confirmats per JS',
    'tr.kpi.trend': 'Tendència',
    'tr.trend.sub': 'meitat recent vs meitat anterior des rang',
    'tr.refresh': '↻ Refrescar',
    'tr.simulate': '✨ Simular trànsit',
    'tr.simulating': 'Simulant…',
    'tr.simulate.confirm': 'Inserir ~60 accessos sintètics (falsos) per provar es panell? Això només passa quan ho confirmes — res es simula automàticament.',
    'tr.legend.human': 'Humans',
    'tr.legend.bot': 'Bots',
    'tr.you': 'Ets es visitant',
    'tr.human': 'Humà',
    'tr.bot': 'Bot',
    'tr.unverified': 'Sense verificar',
    'tr.direct': '(directe)',
    'tr.novisitors': 'Encara no hi ha visitants. Prem "Simular trànsit" o navega per sa web.',
    'tr.nodata': 'Encara no hi ha dades en aquest rang.',
    'tr.noresults': 'Sense resultats.',
    'tr.sensitive': 'sensibles captats',
    'tr.live': 'En viu',
    'tr.filtered': 'Filtrat per país:',
    'tr.clear': 'Llevar filtre',
    'tr.map.none': 'Encara no hi ha països ubicables en aquest rang.',
    'tr.col.ago': 'Fa',
    'tr.col.time': 'Hora',
    'tr.col.path': 'Ruta',
    'tr.col.geo': 'Ubicació',
    'tr.col.device': 'Dispositiu',
    'tr.col.class': 'Classe',
    'tr.col.ref': 'Origen',
    'tr.col.vid': 'Visitant',
    'tr.v.id': 'Fingerprint',
    'tr.v.hits': 'Accessos',
    'tr.v.first': 'Primera vegada',
    'tr.v.last': 'Darrera vegada',
    'tr.v.human': 'Confirmat',
    'tr.of': 'de',
    'tr.range.label': 'Rang',
    'tr.range.1h': 'Darrera hora',
    'tr.range.24h': 'Darreres 24 hores',
    'tr.range.7d': 'Darrers 7 dies',
    'tr.range.30d': 'Darrers 30 dies',
    'tr.range.90d': 'Darrers 90 dies',
    'tr.range.1y': 'Darrer any',
    'tr.range.custom': 'Personalitzat',
    'tr.from': 'Des de',
    'tr.to': 'Fins a',
    'tr.limit.label': 'Màx. files',
    'tr.capped': 'Mostrant es {n} accessos més recents d\'aquest rang — acota es rang o puja es límit per veure\'ls tots.',
    'tr.capped.badge': 'limitat',
    'tr.unit.hour': 'per hora',
    'tr.unit.day': 'per dia',
    'tr.unit.month': 'per mes',
    'tr.filter.all': 'Tots',
    'tr.filter.humans': 'Humans',
    'tr.filter.bots': 'Bots',
    'tr.search': 'Cercar ruta, país, visitant…',
    'tr.perpage': 'per pàgina',
  },
};

// Shared helper for main.js and traffic.js: returns the translation of `key`
// for `lang`, falling back to the default English strings.
export function tr(lang, key) {
  return (translations[lang] && translations[lang][key]) || jsDefaults[key] || key;
}

// Default JS strings (English).
export const jsDefaults = {
  'js.badge.dynamo': '● Persistence: DynamoDB ({table} · {region})',
  'js.badge.memory': '● Persistence: memory (no AWS credentials)',
  'js.stat.mode': 'Storage mode',
  'js.stat.dynamo': 'DynamoDB',
  'js.stat.noaccess': '❌ no access',
  'js.stat.disabled': '— disabled',
  'js.stat.detail': 'Detail',
  'js.stat.platform': 'Platform',
  'js.stat.uptime': 'Process uptime',
  'js.stat.env': 'Environment variables',
  'js.items.empty': 'No records yet. Add the first one above 👆',
  'js.items.delete': '🗑 delete',
  'js.items.loaderr': 'Error loading records:',
  'js.error': 'Error',

  // ── Traffic dashboard ──
  'tr.kpi.hits': 'Total accesses (in range)',
  'tr.kpi.unique': 'Unique visitors',
  'tr.kpi.split': 'Humans vs bots',
  'tr.kpi.confirmed': 'JS-confirmed humans',
  'tr.kpi.trend': 'Trend',
  'tr.trend.sub': 'recent vs earlier half of the range',
  'tr.refresh': '↻ Refresh',
  'tr.simulate': '✨ Simulate traffic',
  'tr.simulating': 'Simulating…',
  'tr.simulate.confirm': 'Insert ~60 synthetic (fake) accesses to demo the dashboard? This only happens when you confirm — nothing is simulated automatically.',
  'tr.legend.human': 'Humans',
  'tr.legend.bot': 'Bots',
  'tr.you': 'You are visitor',
  'tr.human': 'Human',
  'tr.bot': 'Bot',
  'tr.unverified': 'Unverified',
  'tr.direct': '(direct)',
  'tr.novisitors': 'No visitors yet. Hit "Simulate traffic" or just browse the site.',
  'tr.nodata': 'No data in this range yet.',
  'tr.noresults': 'No results.',
  'tr.sensitive': 'sensitive captured',
  'tr.live': 'Live',
  'tr.filtered': 'Filtered by country:',
  'tr.clear': 'Clear filter',
  'tr.map.none': 'No mappable countries in this range yet.',
  'tr.col.ago': 'Ago',
  'tr.col.time': 'Time',
  'tr.col.path': 'Path',
  'tr.col.geo': 'Location',
  'tr.col.device': 'Device',
  'tr.col.class': 'Class',
  'tr.col.ref': 'Referrer',
  'tr.col.vid': 'Visitor',
  'tr.v.id': 'Fingerprint',
  'tr.v.hits': 'Hits',
  'tr.v.first': 'First seen',
  'tr.v.last': 'Last seen',
  'tr.v.human': 'Confirmed',
  'tr.of': 'of',
  // range / limit controls
  'tr.range.label': 'Range',
  'tr.range.1h': 'Last hour',
  'tr.range.24h': 'Last 24 hours',
  'tr.range.7d': 'Last 7 days',
  'tr.range.30d': 'Last 30 days',
  'tr.range.90d': 'Last 90 days',
  'tr.range.1y': 'Last year',
  'tr.range.custom': 'Custom',
  'tr.from': 'From',
  'tr.to': 'To',
  'tr.limit.label': 'Max rows',
  'tr.capped': 'Showing the newest {n} accesses in this range — narrow the range or raise the limit to see them all.',
  'tr.capped.badge': 'capped',
  'tr.unit.hour': 'hourly',
  'tr.unit.day': 'daily',
  'tr.unit.month': 'monthly',
  // feed filters + pagination
  'tr.filter.all': 'All',
  'tr.filter.humans': 'Humans',
  'tr.filter.bots': 'Bots',
  'tr.search': 'Search path, country, visitor…',
  'tr.perpage': 'per page',
};
