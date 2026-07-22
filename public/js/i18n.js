// Traducciones del showcase. El inglés vive en el propio index.html (idioma
// por defecto); aquí solo están ES y CA (mallorquí). Al cambiar de idioma,
// main.js guarda el innerHTML original (EN) y lo restaura si se vuelve a EN.
//
// Los diagramas Mermaid se quedan en inglés en todos los idiomas (términos
// técnicos, y re-renderizarlos por idioma no aporta).

export const LANGS = {
  en: { name: 'English', flag: flagUK() },
  es: { name: 'Español', flag: flagES() },
  ca: { name: 'Mallorquí', flag: flagMallorca() },
};

// Banderas SVG inline (no existe emoji de la bandera de Mallorca).
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
  // Senyera con franja morada y castillo blanco (simplificado).
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

    // Cadenas generadas desde JS
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
  },

  ca: {
    'subtitle': 'Showcase autoexplicatiu: què conté sa plantilla, com està connectat tot, com es desplega i una demo funcional contra sa base de dades.',
    'tab.arch': '🏗️ Arquitectura',
    'tab.conn': '🔌 Connexions (en viu)',
    'tab.demo': '🧪 Demo CRUD',
    'tab.deploy': '🚀 Desplegament',
    'tab.api': '📚 API &amp; Tests',

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
  },
};

// Cadenas JS por defecto (inglés).
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
};
