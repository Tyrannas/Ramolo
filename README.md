# Mobilité & Souplesse — PWA pour vrais débutants

Application web installable (PWA) qui aide les personnes sédentaires à atteindre des **objectifs de
mouvement concrets** — s'asseoir en tailleur, tenir un squat profond, tenir debout sans mal de dos, courir et descendre sans mal aux genoux, se tenir droit sans effort, toucher ses pieds —
plutôt que de proposer des séances d'étirement génériques.

Le différenciateur : un **module de diagnostic** qui identifie *quel* facteur limite chaque objectif
(chevilles ? hanches ? ischio-jambiers ?), puis génère un programme ciblé avec des re-tests
périodiques pour objectiver la progression.

**Aucun compte, aucun serveur.** Toutes les données restent dans l'IndexedDB de l'appareil.

## Démarrer

```bash
npm install
npm run dev          # serveur de développement
npm run build        # build de production (dist/)
npm run preview      # prévisualiser le build
```

## Qualité

```bash
npm test               # les quatre suites ci-dessous
npm run validate-data  # schéma, intégrité référentielle, matrice facteur × objectif
npm run verify-logic   # scoring, profil, flags, générateur de séances
npm run verify-db      # persistance IndexedDB, export/import, sauvegardes v1
npm run verify-render  # rendu réel dans jsdom : premier lancement et rechargement
npm run verify-render-base  # idem, servi depuis /Ramolo/ (routage GitHub Pages)
npm run lint           # typage TypeScript
```

La CI (`.github/workflows/ci.yml`) exécute toutes les suites, puis déploie sur GitHub Pages depuis `main`.

## Architecture

```
public/data/            Contenu statique — SOURCE DE VÉRITÉ du contenu
  factors.json          21 facteurs limitants (taxonomie commune)
  goals.json            6 objectifs, pondération des facteurs, jalons
  tests.json            24 tests d'auto-évaluation, paliers, scoring 0-3
                        et questions `followUp` qualitatives
  exercises.json        93 fiches exercices en français

src/
  types.ts              Modèle de domaine (miroir des JSON)
  db.ts                 Dexie/IndexedDB + export/import JSON
  data/content.ts       Chargement et indexation du contenu
  logic/
    scoring.ts          Valeur brute (cm, s, palier) → score 0-3
    profile.ts          Assessments → profil par facteur + synthèse
    generator.ts        Génération déterministe des séances
    schedule.ts         Re-tests dus, séries, jours d'entraînement
  hooks/                useTodaySession (état agrégé), useWakeLock
  pages/                Onboarding, Today, Diagnostic(+Wizard), Player,
                        Progress, Library, Settings
  components/           Layout, jauges, calendrier, fiches exercices
```

### Décisions notables

**Le contenu pilote le code.** Ajouter un objectif, un test ou un exercice = éditer un JSON. Aucun
identifiant n'est codé en dur côté application ; `validate-data` garantit l'intégrité référentielle
et refuse par exemple un objectif dont un facteur pondéré n'est mesuré par aucun de ses tests.

**Deux sources de score, pas trois.** Seuls le `factor` principal d'un test et les
`factorScoreOverride` des réponses `followUp` produisent un score. `secondaryFactors` est purement
informatif : un squat raté ne dit rien de précis sur *chacun* des facteurs qu'il touche, et le faire
compter brouillerait la discrimination qui fait l'intérêt de l'app (« tes chevilles vont bien — ce
sont tes hanches »). Voir `computeFactorScores`.

**« Non évalué » n'est pas « bon ».** Un facteur qu'aucun test n'a noté s'affiche explicitement
comme non évalué, jauge vide et grisée — jamais pleine par défaut. C'est une règle d'*affichage*,
distincte de la règle de *validation* : un facteur pondéré dans un objectif sans aucune source de
score casse le build (`validate-data`), parce que le diagnostic mentirait.

**Questions de suivi et flags.** Certains tests posent une question qualitative après la mesure.
Une réponse peut noter un autre facteur (`factorScoreOverride` — la fesse arrière du 90/90 est la
seule source pour la rotation interne) et/ou lever un `flag` qui pilote le programme : essuie-glaces
sur rotation interne limitée, flexion de hanche assise et consignes de stance adaptées sur pincement
antérieur, préférence pour les cycles actifs quand la personne répond mieux au travail actif, et
bandeau invitant à consulter sur douleur franche.

**Trois types de dosage exclusifs.** `holdSeconds` (chrono descendant), `reps` (compteur) et
`cycles` (timer d'intervalles : `count` × phases, chaque changement de phase annoncé par un bip et
son label). Tout timing vit dans le dosage structuré, jamais seulement dans une note en texte libre
— une note contredisant le champ structuré a déjà produit un chrono faux et un budget de séance
sous-évalué de 3×.

**Générateur déterministe, pas d'IA.** Chaque facteur reçoit un volume proportionnel à
`poids_objectif × (3 − score)` : les plus faibles passent en premier. La sélection respecte le budget
temps et impose au moins un exercice de renforcement (piège du « que du stretching »). Jamais plus
d'un niveau au-dessus du score du facteur *le plus faible* que l'exercice sollicite : un exercice
choisi pour un facteur fort ne doit pas surcharger un facteur bloqué qu'il étire aussi. La variété
vient de `rotation = nombre de séances terminées` : chaque facteur tourne dans son propre groupe
d'exercices quasi équivalents (à un niveau près du meilleur choix), décalé selon son rang, et le
renfo imposé comme le complément de fin tournent aussi — les combinaisons se répètent donc bien moins
vite que si tous les facteurs tournaient au même pas. La séance du jour reste reproductible entre
l'écran d'accueil et le player sans état partagé ; une séance abandonnée ne fait pas avancer la
rotation.

**Vidéos : recherches YouTube, pas d'embeds.** Les fiches portent un champ `videoQuery` plutôt qu'une
URL inventée ; l'app ouvre une recherche ciblée. Aucun lien mort, aucune question de droits. Passer à
de vrais embeds = remplir `videoUrl` (tâche de contenu, sans changement de code).

**Sécurité codée en dur.** Signaler une douleur propose la régression ; deux signalements sur les six
dernières séances masquent automatiquement l'exercice (réversible dans les réglages) et l'app invite
à consulter.

### Hors-ligne

`vite-plugin-pwa` (Workbox) précache l'app shell *et* les JSON de contenu : l'application est
pleinement utilisable hors connexion, à l'exception des démonstrations vidéo (externes par nature).

## Déploiement

Publié sur **https://tyrannas.github.io/Ramolo/** par `.github/workflows/ci.yml` : chaque push sur
`main` rejoue les suites de tests puis déploie `dist/`. Les pull requests sont vérifiées sans être
déployées.

Réglage requis une seule fois : dans *Settings → Pages* du dépôt, choisir **GitHub Actions** comme
source (et non « Deploy from a branch »).

Trois détails rendent le sous-chemin `/Ramolo/` fonctionnel, et chacun est vérifié en CI :

- **`base`** vaut `/Ramolo/` en build et `/` en dev (`vite.config.ts`). Un `BASE_PATH=/` en variable
  d'environnement permet de builder pour un domaine racine sans toucher au code.
- **`404.html`** est une copie de `index.html`, générée au build. GitHub Pages ne sait pas réécrire
  les routes d'une SPA : sans ce fichier, ouvrir `/Ramolo/diagnostic` directement, rafraîchir la page
  ou partager un lien renverrait un vrai 404. `.nojekyll` est ajouté dans la foulée.
- **`routerBasename`** (`src/basename.ts`) alimente le `basename` de React Router. Il vit dans son
  propre module parce que le point d'entrée et les tests de rendu doivent en partager exactement la
  valeur : un basename appliqué d'un côté seulement produit une page blanche en production alors que
  tous les tests passent à la racine. `verify-render-base` rejoue donc le parcours complet servi
  depuis `/Ramolo/`.

## État par rapport au plan

Phases 0 à 4 implémentées et vérifiées. Reste la phase 5 (contenu) :

- ajouter le 7e objectif, `pancake` (prérequis : `toe-touch` et `cross-legged` ; il réutilise surtout les facteurs
  existants : ischio-jambiers, adducteurs, bassin) ;
- curation des vidéos (`videoQuery` → `videoUrl`) ; télécharger les `remoteImages` dans
  `/public/images/` au build, pour que les 13 illustrations existantes marchent hors-ligne ;
- audit Lighthouse PWA et vérification hors-ligne sur appareil réel ;
- rappels programmés (aujourd'hui : notifications locales seulement quand l'app est ouverte).
