# Projet : PWA « Mobilité & Souplesse pour vrais débutants »

Document de contexte pour continuer le développement. À fournir au modèle en début de session de travail sur l'application. Pour ajouter du contenu (exercices, objectifs, tests), utiliser l'autre document : `AJOUT-CONTENU.md`.

## 1. Vision

PWA statique, sans compte, qui aide les personnes sédentaires à atteindre des **objectifs de mouvement concrets** (s'asseoir en tailleur, tenir debout sans mal de dos, squat profond…) plutôt que des séances de stretching génériques. Différenciateur : un **module de diagnostic** qui identifie le facteur limitant de chaque objectif (ex. squat limité par les chevilles, pas les hanches), génère un programme ciblé, et objective la progression par des re-tests périodiques (3-4 semaines).

Public : débutants complets, assis toute la journée. Ton : bienveillant, sans jargon ni culpabilisation, régressions systématiques. Principe fondateur validé par la recherche : pour le mal de dos du sédentaire, **le renforcement prime sur l'étirement** (~2/3 renfo, 1/3 étirement sur l'objectif "debout") ; le générateur ne doit jamais produire un programme de stretching pur.

## 2. Architecture technique

- **Stack** : Vite + React + TypeScript + MUI (Material UI) + React Router. 100 % statique, hébergement GitHub Pages / Netlify.
- **PWA** : vite-plugin-pwa (Workbox), precache app shell + JSON + images, manifest installable. Vidéos YouTube non disponibles hors-ligne → fallback images/texte.
- **Données de contenu** : JSON statiques dans `/public/data/` (`factors.json`, `goals.json`, `tests.json`, `exercises.json`), validés par script en CI (règles au §5).
- **État utilisateur** : IndexedDB via Dexie.js (`assessments`, `plan`, `sessions`, `settings`). Aucune donnée ne quitte l'appareil. **Export/import JSON obligatoire** (seul backup possible sans compte).
- **i18n** : textes en objets `{ "fr": … }`, prêts pour `"en"`.

## 3. Modèle de données — l'essentiel

- **`factors`** : 20 facteurs limitants (cheville, flexion/rotations de hanche, adducteurs, ischio-jambiers, psoas, contrôle du bassin, gainage, fessiers, stabilité latérale du bassin, tolérance debout statique, équilibre, quadriceps, contrôle du genou, tolérance du genou à l’effort, mobilité du haut du dos, mobilité des épaules, force du haut du dos, endurance du cou). Taxonomie pivot : tests, objectifs et exercices s'y raccordent tous.
- **`goals`** : 5 objectifs (`cross-legged`, `long-standing`, `deep-squat`, `resilient-knees`, `posture`) avec pondération des facteurs (`factors: {id: poids}`), liste de tests, jalons (`milestones`), prérequis possibles entre objectifs.
- **`tests`** : 21 tests auto-administrés (dont deux déclaratifs : tolérance debout, tolérance du genou à l’effort, mobilité du haut du dos, mobilité des épaules, force du haut du dos, endurance du cou). Mesure `level` (paliers descriptifs), `cm` ou `seconds` + `scoring` par plages → score 0-3. `perSide` pour les asymétries. Champ `followUp` optionnel : question qualitative post-test dont les options peuvent porter un `flag` et/ou un `factorScoreOverride` ({factor, score}).
- **`exercises`** : 86 fiches complètes FR (instructions pas-à-pas, erreurs fréquentes, `safetyNotes`, `expectedFeeling`, chaînes `regressionOf`/`progressionOf`). **Trois types de dosage exclusifs** que le player gère : `holdSeconds`, `reps`, `cycles` (timer d'intervalles à phases labellisées — bip + label à chaque phase). 13 fiches illustrées via `remoteImages` (free-exercise-db, domaine public, URLs vérifiées, `imageAttribution`) ; à télécharger au build dans `/public/images/` pour l'offline. `videoUrl` volontairement `null` partout + champ `videoQuery` (requête YouTube précise) : la curation vidéo est une tâche manuelle dédiée, ne jamais inventer d'URL.

## 4. Logique de diagnostic et personnalisation

- Profil affiché **par facteur** (jauges), pas seulement par objectif. Un facteur sans score = « non évalué » (jauge grisée), jamais « Bon » par défaut.
- Résultats stockés **par test** ; un test partagé entre objectifs actifs ne passe qu'une fois dans le wizard.
- **Flags actifs** : `anterior-hip-impingement` (pincement antérieur de hanche → afficher `impingementFriendlySetup` sur les exercices de squat, inclure `seated-active-hip-flexion`, règle « on travaille sous la butée ») ; `seek-professional-advice` (bandeau consulter avant de travailler en amplitude) ; `limited-hip-internal-rotation` (mentionné au profil, essuie-glaces au programme, non bloquant pour le tailleur) ; `responds-to-active-work` (privilégier les exercices à cycles actifs sur les tenues passives) ; `habitual-lumbar-extension` (posé par la question « position habituelle » du test de bascule du bassin → bascule au mur et reset debout au programme, note au profil) ; `knee-pain-in-rotation` (douleur DANS le genou au test tailleur → les exercices `avoidWithFlags` qui tordent le genou sont exclus, bandeau d'avertissement) ; `patellofemoral-pain` / `lateral-knee-pain` (objectif genou → isométriques / travail de hanche imposés). Les exercices de charge du genou portent `painMonitoring` : gêne ≤ 3/10 stable acceptable, le player demande l'intensité.
- **Générateur** (déterministe) : volume par facteur ∝ poids du goal × (3 − score) ; exercices de `level` ≈ score ; ≥1 exercice de renforcement par séance ; douleur signalée → régression, puis masquage + conseil de consulter si récurrent ; séance re-test injectée toutes les 3-4 semaines.

## 5. Règles de validation (CI, niveau ERREUR)

1. JSON valides, ids uniques, toutes références résolues (`targets`→factors, `goals`, `regressionOf`/`progressionOf`→exercices, `goals[].tests`→tests).
2. **Matrice de diagnostic complète** : chaque facteur pondéré dans `goals[].factors` est noté par ≥1 test de la liste `goals[].tests` de ce goal (via `factor` principal ou `factorScoreOverride`). Prouvé pour les 12 pondérations actuelles.
3. Exactement **un** type de dosage par exercice. Tout timing vit dans le dosage structuré, jamais uniquement en note libre.
4. Chaque facteur pondéré d'un goal a ≥1 exercice qui le cible (`targets`) au niveau débutant.

## 6. État et reste à faire

Fait : phases 0 à 4 du plan — onboarding avec disclaimer santé, diagnostic avec profil par facteur, générateur, player (3 dosages), progression (re-tests, courbes, calendrier), export/import, réglages avec attributions. Corrections intégrées suite aux tests utilisateur réels : test tailleur au mur en deux étapes, test 90/90 à double mesure (paliers = jambe avant / followUp = fesse arrière), passif (référence) vs actif (followUp), dosage `cycles` pour le contracté-relâché.

Audit d'octobre 2026 : paliers réécrits selon « une mesure = une chose » (`thomas-test` : cuisse / genou en followUp ; `single-leg-bridge-hold` chronométré ; `heel-elevated-squat` en paliers absolus ; `deep-squat-baseline` = équilibre à sa propre profondeur) ; pauses par répétition passées en `cycles` ; validateur durci (matrice sans `secondaryFactors`, flags connus, chaîne de régression jusqu'au level 0, exercice débutant tagué par objectif, timing en note = erreur) ; garantie « ≥1 renfo » robuste en séance courte. Lot 1 « dos debout » (retour d'usage : bons scores mais 1 h debout immobile douloureuse, marche indolore, cambrure par défaut) : facteurs `lateral-hip-stability` et `standing-endurance`, tests d'abduction couchée et de tolérance debout, question « position habituelle » → flag `habitual-lumbar-extension`, 7 exercices (stratégies debout, moyen fessier). Lot 2 : 11 exercices — contracté-relâché en cycles (ischios, psoas, rotateurs, adducteurs), renfos du tailleur (serrage adducteurs, Copenhague court, 90/90 lift-offs), niveaux manquants (ischios L2, bassin L1-L2, adducteurs L1). Lot 3 : 11 exercices — renfos et équilibre du squat (descente lente, relevés de pointes, fente genou au-delà des orteils), premiers niveaux 3 (squat, gainage, ischios, tailleur), pont L1, bassin et tolérance debout L2.

À faire : re-tester physiquement la consigne « bas du dos au contact du mur » de `wall-cross-legged` (ambiguë : dos droit neutre = sacrum + omoplates au mur) ; re-tester sur soi l’objectif genou (descente de marche filmée, chaise au mur, dialogue de douleur du player) et le flag tailleur ; tester l’objectif posture ; objectifs suivants : toe-touch → pancake ; puis nouveaux objectifs dans l'ordre posture → toe-touch → pancake via `AJOUT-CONTENU.md` ; curation vidéo ; illustrations des ~20 exercices sans correspondance open source ; images hors-ligne ; rappels programmés.

## 7. Méthode de travail éprouvée

Contenu et code évoluent indépendamment, les schémas JSON servent de contrat, la validation croisée attrape les incohérences des deux côtés. Les retours d'usage réel du propriétaire du projet ont déjà corrigé 5 bugs de contenu : les faire tester sur soi est le meilleur contrôle qualité. En cas d'ambiguïté entre une règle du README et une implémentation : privilégier la règle la plus stricte et demander.
