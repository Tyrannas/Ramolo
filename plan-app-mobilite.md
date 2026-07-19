# Plan de développement — App PWA "Mobilité & Souplesse pour vrais débutants"

## 1. Vision et positionnement

Une PWA statique, sans compte, qui aide les personnes sédentaires à atteindre des **objectifs de mouvement concrets** (s'asseoir en tailleur sans douleur, toucher ses pieds, tenir un squat profond, corriger sa posture, progresser vers le pancake) plutôt que de proposer des "séances de stretching" génériques.

Le différenciateur clé : un **module de diagnostic** qui identifie, pour chaque objectif, *quelle* articulation ou *quel* groupe musculaire est le facteur limitant (ex. pour l'asian squat : chevilles ? hanches ? les deux ?), puis génère un programme ciblé, avec re-tests périodiques pour objectiver la progression.

Public cible : débutants complets, sédentaires, souvent en position assise toute la journée. Ton de l'app : bienveillant, sans jargon, sans culpabilisation, avec régressions systématiques pour chaque exercice ("si c'est trop dur, faites ceci").

---

## 2. Les objectifs (goals) de la v1

Chaque objectif est une fiche avec : description, prérequis physiques, tests de diagnostic associés, exercices associés, critère de réussite mesurable.

| ID | Objectif | Prérequis physiques principaux |
|---|---|---|
| `deep-squat` | Tenir un squat profond talons au sol (asian squat) | Dorsiflexion cheville, flexion hanche, mobilité thoracique |
| `cross-legged` | S'asseoir en tailleur dos droit, sans tomber en arrière | Rotation externe de hanche, souplesse adducteurs, bascule du bassin (ischio-jambiers) |
| `toe-touch` | Toucher ses pieds jambes tendues | Ischio-jambiers, chaîne postérieure, bascule pelvienne |
| `pancake` | Pancake (écart facial assis + inclinaison avant) | Adducteurs, ischio-jambiers, flexion de hanche — objectif "avancé", dépend de `toe-touch` |
| `posture` | Posture debout/assise neutre, réduire le dos voûté | Extension thoracique, ouverture des épaules, force du haut du dos, position de tête |
| `long-standing` | Tenir debout longtemps sans douleur lombaire (concerts, files) | Gainage, endurance fessiers/lombaires, mobilité du psoas |

Structure extensible : ajouter un objectif = ajouter un JSON, sans toucher au code.

**Graphe de dépendances** : certains objectifs se débloquent logiquement (`pancake` suggéré après un niveau minimal sur `toe-touch` et `cross-legged`). À encoder en `prerequisites: [{goalId, minLevel}]`.

---

## 3. Module diagnostic (le cœur de l'app)

### 3.1 Principe

Pour chaque objectif, un **wizard de tests auto-administrés** (2 à 5 tests, ~5 min), chacun avec :
- instructions illustrées + vidéo,
- un résultat **mesurable** (cm, paliers A/B/C/D),
- une interprétation : quel facteur limitant ce test isole.

Le croisement des résultats produit un **profil de limitations** (ex. "cheville droite limitée, hanches OK") qui pondère la sélection d'exercices.

### 3.2 Tests par objectif (sourcés)

**Deep squat / asian squat**
1. *Knee-to-wall test* (weight-bearing lunge test) — test validé cliniquement de la dorsiflexion de cheville : pied à distance croissante du mur, toucher le mur avec le genou sans décoller le talon. Mesure en cm orteil→mur ; le standard courant est ~10-12 cm (5 pouces). Fait par côté → détecte les asymétries. Sources : Squat University (squatuniversity.com, "How to Screen Ankle Mobility"), littérature sur le Weight-Bearing Lunge Test.
2. *Squat talons surélevés* (livre/cale sous les talons) — si le squat devient possible talons surélevés, la limitation est distale (chevilles) ; sinon chercher côté hanches.
3. *Squat avec contrepoids* (tenir un poids ou se tenir à un meuble) — si possible avec contrepoids mais pas sans, le problème est plus un déficit de contrôle/équilibre que de mobilité pure.
4. *Test de flexion de hanche au sol* (genou vers poitrine, allongé) — isole la hanche sans la cheville.

**Tailleur (cross-legged)**
1. *Test 90/90* — assis, jambes en Z à 90/90 ; capacité à tenir le buste droit et à alterner les côtés → rotation interne/externe de hanche, comparaison droite/gauche.
2. *Papillon* — assis plantes de pieds jointes : hauteur des genoux par rapport aux hanches (palier A : genoux sous les hanches → D : genoux au niveau des épaules).
3. *Assis dos au mur jambes croisées* — le bassin part-il en rétroversion (dos rond, on "tombe en arrière") ? → ischio-jambiers/bascule pelvienne vs hanches.

**Toucher ses pieds**
1. *Toe touch debout* — mesure doigts→sol en cm (ou paliers : mi-tibia / chevilles / orteils / paume au sol).
2. *Sit-and-reach* (assis jambes tendues, mains vers les pieds) — protocole classique d'évaluation de la chaîne postérieure.
3. *Variante genoux fléchis* — si toucher devient facile genoux légèrement fléchis → ischio-jambiers ; si toujours difficile → mobilité lombaire/bascule du bassin.

**Pancake**
1. *Angle d'écart* assis dos au mur (estimation par paliers, ou photo).
2. *Inclinaison avant en écart* : paliers (mains au sol devant / coudes au sol / poitrine au sol).
3. Réutilise les résultats `toe-touch` (ischios) pour départager adducteurs vs chaîne postérieure.

**Posture**
1. *Test du mur* — debout dos au mur : occiput, omoplates, sacrum en contact ? Distance nuque→mur.
2. *Wall angel* — dos au mur, glisser les bras en "W→Y" sans décoller lombaires/poignets : paliers de réussite → mobilité thoracique + épaules.
3. *Rotation thoracique assise* (bâton/manche à balai sur les épaules, rotation max estimée).

**Tenir debout longtemps**
1. *Planche* (temps de tenue, paliers).
2. *Pont fessier unilatéral* (tenue 30 s par côté sans crampe d'ischios).
3. *Test du psoas* (Thomas test modifié, allongé au bord d'un lit : la cuisse libre reste-t-elle horizontale ?).

### 3.3 Scoring

Chaque test rend un score 0–3 (bloqué / limité / fonctionnel / bon). Le profil par objectif = moyenne pondérée des tests. L'app affiche des jauges **par facteur** (chevilles, hanches-rotation, hanches-flexion, chaîne postérieure, adducteurs, thoracique, gainage), pas seulement par objectif — c'est ce qui permet le message "ton squat est limité par tes chevilles, pas tes hanches".

**Re-test** : proposé toutes les 3-4 semaines par objectif actif ; l'historique des scores est la colonne vertébrale du suivi de progression.

---

## 4. Sourcing des exercices

### 4.1 Bases de données libres (données + images)

| Source | Contenu | Licence | Intérêt |
|---|---|---|---|
| [free-exercise-db (yuhonas)](https://github.com/yuhonas/free-exercise-db) | 800+ exos JSON + images, schéma propre (`level`, `primaryMuscles`, `instructions`, `images`) | Domaine public | Base de schéma + fonds d'exercices de renfo ; images hébergeables via raw.githubusercontent |
| [wger.de](https://github.com/wger-project/wger) | Base communautaire, API REST, images/vidéos, **traductions FR** | CC par exercice (attribution à conserver, champ `license` dans l'API) | Bonne couverture mobilité/rééducation, multilingue |
| [exercemus/exercises](https://github.com/exercemus/exercises) | Curation wger + exercises.json en un seul JSON minifié | MIT (code), licence propre à chaque exercice | Point de départ pratique |
| [ExerciseDB open source](https://github.com/exercisedb/exercisedb-api) | 1300+ exos, GIFs/vidéos | Open source (vérifier la licence des médias avant usage) | GIFs de démonstration |

⚠️ Ces bases sont orientées musculation : elles couvriront bien le volet renforcement (`posture`, `long-standing`) mais **la mobilité ciblée débutant devra être en partie rédigée à la main** (~60-80 exercices maison). C'est un travail éditorial assumé : c'est là que l'app crée sa valeur.

### 4.2 Vidéos

Stratégie recommandée : **embeds YouTube** (via l'iframe officielle, aucune question de droits) avec fallback image/texte hors-ligne. Chaînes de référence, orientées mobilité et progressions débutant :
- **Squat University** (Dr Aaron Horschig, kiné) — squat, chevilles, hanches, dos.
- **Tom Merrick / Bodyweight Warrior** — routines toe touch, pancake, squat ; progressions très claires.
- **GMB Fitness** — mobilité débutant, approche douce.
- **Emmet Louis**, **Kit Laughlin** — stretching plus avancé (pancake).

Dans le JSON : `videoUrl` (embed YouTube) + `videoTimestamp` optionnel + `images[]` locales pour le mode hors-ligne. Prévoir le champ `sourceAttribution`.

### 4.3 Rédaction des fiches

Chaque fiche exercice contient : consignes pas-à-pas, erreurs fréquentes, **régression** (variante plus facile) et **progression** (plus dure), dosage par défaut (durée/répétitions/tenue), sensation attendue ("étirement, jamais de douleur vive"). Contenu rédigé en propre (pas copié), en français.

---

## 5. Modèle de données (JSON statiques + état local)

### 5.1 Fichiers statiques (dans `/public/data/`)

```jsonc
// exercises.json — un exercice
{
  "id": "couch-stretch",
  "name": { "fr": "Étirement du psoas au canapé", "en": "Couch stretch" },
  "targets": ["hip-flexors"],            // facteurs travaillés (taxonomie ci-dessous)
  "type": "stretch",                     // stretch | strength | mobility-drill | test-retest
  "level": 1,                            // 0 = régression max, 3 = avancé
  "regressionOf": null, "progressionOf": "kneeling-hip-flexor-stretch",
  "dosage": { "holdSeconds": 60, "sets": 2, "perSide": true },
  "instructions": { "fr": ["…", "…"] },
  "commonMistakes": { "fr": ["…"] },
  "safetyNotes": { "fr": ["Jamais de douleur vive au genou…"] },
  "images": ["couch-stretch/0.webp"],
  "videoUrl": "https://www.youtube.com/embed/XXXX",
  "sourceAttribution": { "text": "…", "url": "…", "license": "CC-BY-SA" }
}
```

```jsonc
// factors.json — taxonomie des facteurs limitants
["ankle-dorsiflexion", "hip-flexion", "hip-external-rotation", "hip-internal-rotation",
 "hamstrings", "adductors", "hip-flexors", "thoracic-extension", "shoulder-mobility",
 "core-endurance", "glute-strength", "balance-control"]
```

```jsonc
// tests.json — un test de diagnostic
{
  "id": "knee-to-wall",
  "name": { "fr": "Test genou-mur (cheville)" },
  "factor": "ankle-dorsiflexion",
  "perSide": true,
  "measure": { "kind": "cm", "prompt": { "fr": "Distance max orteil→mur (cm)" } },
  "scoring": [ { "min": 0, "max": 4, "score": 0 }, { "min": 4, "max": 8, "score": 1 },
               { "min": 8, "max": 11, "score": 2 }, { "min": 11, "score": 3 } ],
  "instructions": { "fr": ["…"] }, "images": ["…"], "videoUrl": "…"
}
```

```jsonc
// goals.json — un objectif
{
  "id": "deep-squat",
  "name": { "fr": "Squat profond talons au sol" },
  "tests": ["knee-to-wall", "heel-elevated-squat", "counterweight-squat", "supine-hip-flexion"],
  "factors": { "ankle-dorsiflexion": 0.4, "hip-flexion": 0.3, "balance-control": 0.2, "thoracic-extension": 0.1 },
  "milestones": { "fr": ["Squat tenu 10 s avec support", "…", "Squat libre 1 min"] },
  "prerequisites": []
}
```

### 5.2 État utilisateur (local, pas de compte)

Stockage **IndexedDB** (via Dexie.js) — localStorage en fallback pour les préférences :
- `assessments` : {date, testId, side, rawValue, score}
- `plan` : objectifs actifs, jours d'entraînement choisis, durée de séance cible
- `sessions` : {date, exercices effectués, ressenti 1-5, douleurs signalées}
- `settings` : langue, rappels, unités

**Export/import JSON obligatoire** (bouton "sauvegarder mes données") : sans compte, c'est le seul backup et le seul moyen de migrer de téléphone. Simple `Blob` téléchargé / fichier importé.

---

## 6. Génération des programmes

Algorithme simple et déterministe (pas d'IA nécessaire) :
1. L'utilisateur choisit 1-3 objectifs actifs + nb de jours/semaine (2-5) + durée cible (10/20/30 min).
2. Pour chaque objectif, les facteurs sont pondérés par `goals.factors` × (3 − score du facteur) → les facteurs les plus faibles reçoivent le plus de volume.
3. Sélection d'exercices couvrant ces facteurs, au `level` correspondant au score (score 0 → régressions), en respectant la durée cible via les dosages.
4. Rotation légère d'une séance à l'autre pour éviter la monotonie ; toujours ≥1 exercice de renforcement (pas que du stretching passif).
5. Toutes les 3-4 semaines : séance spéciale "re-test" injectée automatiquement.

Règle de sécurité codée en dur : signalement de douleur sur un exercice → proposer la régression, puis masquer l'exercice et afficher le conseil de consulter si récurrent.

---

## 7. Architecture technique

- **Stack** : Vite + React + TypeScript + **MUI (Material UI)** + React Router. 100 % statique.
- **PWA** : `vite-plugin-pwa` (Workbox) — precache de l'app shell + des JSON + des images ; les vidéos YouTube ne sont pas dispo hors-ligne, d'où les images de fallback. `manifest.webmanifest` (installable, standalone, icônes maskable).
- **Stockage** : Dexie.js (IndexedDB). Aucune donnée ne quitte l'appareil — argument de confidentialité à afficher fièrement.
- **i18n** : FR d'abord, structure `{ "fr": …, "en": … }` prête pour l'anglais.
- **Timer de séance** : écran "player" (exercice courant, chrono de tenue, bips, bouton régression), Wake Lock API pour empêcher l'écran de s'éteindre.
- **Hébergement** : GitHub Pages ou Netlify/Cloudflare Pages. CI simple (lint des JSON contre les schémas + build).
- **Qualité données** : JSON Schema pour `exercises/tests/goals` + validation en CI (approche identique à free-exercise-db).

---

## 8. Écrans (v1)

1. **Onboarding** (3 écrans) : promesse, disclaimer santé, choix des objectifs.
2. **Diagnostic** : wizard test par test (vidéo, instructions, saisie du résultat), résultat = profil visuel (jauges par facteur) + phrase de synthèse par objectif.
3. **Accueil / Aujourd'hui** : séance du jour, streak, prochain re-test.
4. **Player de séance** : plein écran, chrono, navigation exo précédent/suivant, "trop dur → régression", feedback fin de séance.
5. **Progression** : courbes par test (cm, paliers) + calendrier de régularité, comparaison avant/après.
6. **Bibliothèque** : tous les exercices filtrables par facteur/objectif/niveau.
7. **Réglages** : export/import des données, langue, rappels (notifications locales si permission), à-propos + attributions de licences.

---

## 9. Plan de développement pour Opus (phases livrables)

**Phase 0 — Socle** : scaffold Vite+TS+MUI+Router, vite-plugin-pwa, thème, layout mobile-first, déploiement CI.
**Phase 1 — Données** : JSON Schemas, `factors/goals/tests` complets, 30 exercices seed (5 par objectif), validation CI. *Livrable testable : bibliothèque navigable.*
**Phase 2 — Diagnostic** : wizard de tests, scoring, profil par facteurs, persistance Dexie. *Livrable : je me diagnostique et je vois mon profil.*
**Phase 3 — Programme + Player** : génération de séances, player avec chrono, log de séance. *Livrable : je peux m'entraîner.*
**Phase 4 — Progression** : re-tests planifiés, graphiques d'évolution, calendrier de régularité, export/import.
**Phase 5 — Contenu + polish** : passer à 60-80 exercices, vidéos sourcées, mode hors-ligne vérifié (Lighthouse PWA), notifications de rappel, page attributions.

Chaque phase = un état utilisable de bout en bout ; le contenu (JSON) peut évoluer en continu indépendamment du code.

---

## 10. Points d'attention

- **Disclaimer santé** dès l'onboarding : l'app ne remplace pas un avis médical ; douleur aiguë, irradiation, engourdissements → consulter. Les tests sont des auto-évaluations indicatives, pas des diagnostics cliniques.
- **Licences** : conserver les attributions wger/CC par exercice (page dédiée + champ `sourceAttribution`) ; les GIFs de certains datasets ont des conditions propres (ex. médias Gym visual) — vérifier avant d'embarquer des médias, préférer domaine public + embeds YouTube.
- **Ne pas copier les textes** des sources : rédiger les consignes en propre.
- **Éviter le piège "que du stretching"** : pour la posture et la tenue debout, le renforcement est plus déterminant que l'étirement ; le générateur doit mixer les deux.
- **Mesures honnêtes** : privilégier les mesures objectives (cm au mur, doigts-sol) aux auto-notations subjectives — c'est ce qui rend la progression visible et motivante.
