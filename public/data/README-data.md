# Données de contenu (objectifs : tailleur, dos debout, deep squat, genoux, posture, toucher ses pieds)

## Contenu

| Fichier | Contenu |
|---|---|
| `factors.json` | 21 facteurs limitants (taxonomie commune aux tests, objectifs et exercices) |
| `goals.json` | 6 objectifs avec pondération des facteurs, tests associés et jalons |
| `tests.json` | 24 tests d'auto-évaluation avec instructions, paliers/mesures, scoring 0-3, interprétation et questions `followUp` |
| `exercises.json` | 93 fiches exercices complètes en français |

Pour ajouter du contenu, suivre le contrat de `AJOUT-CONTENU.md` (racine du dépôt) puis lancer `npm run validate-data`.

## Conventions

- **Scores et niveaux** : les tests rendent un score 0-3 (bloqué → bon). Les exercices ont un `level` 0-3 ; le générateur sélectionne `level ≈ score du facteur` (score 0 → régressions).
- **Matrice de diagnostic (build, niveau ERREUR)** : tout facteur pondéré dans `goals[].factors` doit être noté par au moins un test de la liste `goals[].tests` de ce même objectif, via son `factor` principal ou un `factorScoreOverride` de followUp. Un facteur pondéré sans source de score est une erreur de contenu à corriger, pas un avertissement.
- **Tests partagés entre objectifs** : les résultats sont stockés par test, pas par objectif. Si plusieurs objectifs actifs référencent le même test (ex. `toe-touch-standing` pour tailleur ET squat), le wizard ne le fait passer qu'une fois et son score alimente tous les objectifs concernés.
- **`secondaryFactors`** est purement informatif (affichage, pédagogie) : il ne produit jamais de score et ne compte pas dans la matrice. Seuls le `factor` principal et les `factorScoreOverride` notent.
- **Facteur sans mesure = « non évalué » (règle d'AFFICHAGE, cas distinct)** : un facteur pour lequel aucun test n'a produit de score ne doit JAMAIS s'afficher avec une jauge pleine ou la mention « Bon » — afficher explicitement « non évalué » (jauge vide/grisée).
- **`followUp`** : question qualitative posée juste après la mesure. Une option peut porter un `flag` (pilote le programme) et/ou un `factorScoreOverride` ({factor, score}) qui alimente la jauge du facteur, en moyenne avec les autres sources. Une option sans l'un ni l'autre est informative (elle documente la lecture croisée).
- **Trois types de dosage**, exclusifs, que le player gère tous : `holdSeconds` (tenue simple, chrono descendant), `reps` (compteur de répétitions, sans chrono) et `cycles` (timer d'intervalles : `count` × la séquence de `phases`, chaque phase avec `label` et `seconds`, bip et label à chaque changement ; durée d'une série = count × somme des phases). Toute consigne de timing — y compris une pause ou une tenue à chaque répétition — DOIT être dans le dosage structuré : un exercice en répétitions avec pause devient un `cycles`. Les notes ne servent qu'au contexte ; le validateur refuse une note qui contient un timing.
- **Chaînes de progression** : `regressionOf` / `progressionOf` relient les variantes (ex. `plank-knees` → `plank`, `kneeling-hip-flexor-stretch` → `couch-stretch`, `assisted-squat-hold` → `elevated-heel-squat` → `free-squat-hold` → `goblet-squat-pause`). Tout exercice de level ≥ 2 doit mener, de régression en régression, à une variante level 0 (vérifié au build).
- **`perSide: true`** : dosage et mesure à faire pour chaque côté ; l'app stocke gauche/droite séparément (les asymétries font partie du diagnostic).
- **`goals`** sur chaque exercice : le générateur ne pioche QUE parmi les exercices tagués avec un objectif actif, puis les classe par `targets`. Le tag est donc structurant : un exercice pertinent pour un objectif doit le lister, et un tag sans facteur pondéré correspondant ne sert à rien (l'exercice ne sera jamais choisi pour cet objectif).
- **i18n** : tous les textes sont des objets `{ "fr": … }`, prêts à recevoir `"en"`.

## Vidéos et images

`videoUrl` est volontairement `null` partout : inventer des URLs YouTube produirait des liens morts ou hors sujet. Chaque fiche a un champ **`videoQuery`**, une requête YouTube précise (chaînes attendues : Squat University, Tom Merrick, GMB Fitness…) que l'app ouvre en recherche. La curation vidéo est une tâche dédiée : ouvrir chaque `videoQuery`, choisir une vidéo, coller l'URL d'embed (`https://www.youtube.com/embed/<id>`).

13 exercices portent un champ **`remoteImages`** : illustrations en domaine public issues de [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (URLs vérifiées, attribution dans `imageAttribution`). À terme, les télécharger dans `/public/images/` au build pour le hors-ligne. Les autres gardent `images: []`.

## Logique de diagnostic embarquée

- **Test 90/90** : les paliers mesurent la jambe AVANT (rotation externe, celle du tailleur) ; le `followUp` note la fesse ARRIÈRE (rotation interne, via `factorScoreOverride`) et peut poser `limited-hip-internal-rotation` → mention au profil et essuie-glaces au programme, sans bloquer le tailleur.
- **Amplitude passive vs active** : les paliers des tests de souplesse mesurent toujours la position RELÂCHÉE (reproductible). Le `followUp` du papillon peut poser `responds-to-active-work` : le générateur privilégie alors les exercices en `cycles` (contracté-relâché) sur les tenues passives longues.
- **Tailleur** : `wall-cross-legged` est le test de référence. Si `toe-touch-standing` est bas ET que l'utilisateur « tombe en arrière », le message pointe les **ischio-jambiers/bascule du bassin**, pas seulement « les hanches ».
- **Dos debout** : `standing-tolerance` (déclaratif, en minutes debout immobile avant la gêne — la mesure directe de l'objectif) × `thomas-test` (paliers = hauteur de cuisse, psoas ; followUp = genou qui se tend, quadriceps, abaisse le score) × `plank-hold` × `single-leg-bridge-hold` (chronométré bassin horizontal ; followUp = effort senti derrière la cuisse ou dans le dos → les fessiers compensés sont notés bas) × `side-lying-hip-abduction-test` (moyen fessier, talon contre le mur comme repère de compensation) × `standing-pelvic-tilt-control`. Le followUp du test de bascule porte sur la position HABITUELLE (« savoir basculer » ≠ « rester neutre par défaut ») et peut poser `habitual-lumbar-extension` → bascule au mur et reset debout au programme. Profil type que la batterie doit savoir nommer : bons tests de capacité, mais tolérance statique basse (marche indolore, immobilité douloureuse) → facteur limitant = tolérance debout, programme orienté stratégies de changement d'appui.
- **Deep squat** : `deep-squat-baseline` note l'ÉQUILIBRE au point le plus bas de la personne, quelle que soit sa profondeur (followUp informatif : profondeur, talons) ; `knee-to-wall` note la cheville ; `heel-elevated-squat` note la flexion de hanche en paliers absolus, talons surélevés et support autorisé (cheville et équilibre neutralisés) ; `knee-hug-supine-test` isole la hanche. Le followUp comparatif du squat talons surélevés documente la lecture croisée chevilles / hanches.
- **Embranchement pincement de hanche** : le `followUp` de `knee-hug-supine-test` peut poser `anterior-hip-impingement` (affichage des `impingementFriendlySetup` sur les squats, inclusion de `seated-active-hip-flexion`, règle « on travaille sous la butée, jamais dedans ») ou `seek-professional-advice` (bandeau invitant à consulter avant de travailler le squat en amplitude).

- **Genou en torsion (tailleur)** : le `followUp` de `wall-cross-legged` demande si une douleur est ressentie DANS un genou (et non une tension de hanche) et peut poser `knee-pain-in-rotation`. Les positions au sol qui tordent le genou portent `avoidWithFlags: ["knee-pain-in-rotation"]` : le générateur les écarte, y compris quand un autre flag voudrait les imposer ; la hanche se travaille alors par `seated-chair-hip-rotations`, le figure 4 couché et l'huître. Bandeau d'avertissement au profil, avec invitation à consulter si la douleur dure.
- **Genoux en course et en descente** : `knee-load-tolerance-test` (déclaratif, par genou) avec un followUp sur l'endroit de la douleur — devant/sous la rotule → `patellofemoral-pain`, extérieur → `lateral-knee-pain`, intérieur → conseil de consulter dans l'interprétation ; `step-down-test` (filmé de face : genou dans l'axe, bassin, buste) ; `wall-sit-test` (chronométré, arrêt si douleur > 3/10). `patellofemoral-pain` impose les isométriques (lever de jambe tendue, chaise au mur), `lateral-knee-pain` le travail de hanche (abduction couchée, élévation du bassin).
- **Règle de douleur des exercices du genou** (`painMonitoring: true`) : signaler une douleur ouvre un choix « légère (≤ 3/10) et stable » — acceptable, aucun effet sur le masquage — ou « nette / qui augmente » — traitée comme une douleur ordinaire (régression, puis masquage si récurrent). Cette tolérance ne s'applique jamais aux douleurs de torsion du genou.

- **Posture** : pas de « posture parfaite » — l’objectif est de pouvoir se redresser sans effort et de changer souvent de position. `wall-posture-test` (tête au mur sans lever le menton → mobilité du haut du dos), `wall-angel-test` (épaules), `prone-y-hold-test` (chronométré ; effort senti dans le cou ou le bas du dos → score de force du haut du dos revu à la baisse), `neck-flexor-test` (endurance des fléchisseurs profonds du cou), `standing-pelvic-tilt-control`. Pondération à 50 % sur la force (haut du dos, cou).

- **Toucher ses pieds** : `fingertip-floor-distance` (cm, échelle inversée : 0 cm = 3 ; followUp genoux fléchis informatif) note les ischio-jambiers, `hip-hinge-test` (bâton, trois contacts) la charnière/bascule du bassin, `seated-slump-test` (par côté : la tension change-t-elle en relevant la tête ?) la mobilité du nerf sciatique. Un nerf qui freine se travaille par glissements (`sciatic-nerve-slider`), pas par des étirements plus forts. Le renforcement en amplitude (soulevés de terre jambes tendues, glissements de talons) complète les étirements.

## Sécurité

Chaque fiche a `safetyNotes` et `expectedFeeling` (distinguer étirement normal / signal d'alerte). Règles app : douleur signalée sur un exercice → proposer sa régression ; douleur récurrente → masquage et invitation à consulter. L'onboarding rappelle que les tests sont indicatifs et ne remplacent pas un avis médical.
