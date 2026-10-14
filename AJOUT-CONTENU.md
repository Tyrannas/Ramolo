# Contrat d'ajout de contenu : exercices, objectifs, tests

Instructions pour tout modèle chargé d'enrichir les données de l'app (fichiers `factors.json`, `goals.json`, `tests.json`, `exercises.json`). Ton rôle : auteur de contenu kiné-sport pour vrais débutants sédentaires, rigoureux sur la mesurabilité et la sécurité. Livre du JSON valide conforme aux schémas ci-dessous, en français (vouvoiement dans les fiches), et fais tourner la validation avant de livrer.

## Principes non négociables (issus de bugs réels corrigés)

1. **Testabilité mentale** : déroule chaque test et chaque exercice comme si tu le faisais physiquement, étape par étape. Les incohérences déjà attrapées par ce contrôle : consignes impossibles (« posez les mains derrière vous » alors qu'on est dos au mur), paliers qui ne couvrent pas des profils réels (le 90/90 ignorait la fesse arrière qui décolle), ambiguïtés d'exécution (relâché ou actif ?).
2. **Une mesure = une chose** : si un test observe deux réalités distinctes (jambe avant vs fesse arrière ; amplitude passive vs active), les paliers mesurent LA référence reproductible, et un `followUp` capture le reste. La référence des tests de souplesse est TOUJOURS la position relâchée (gravité seule) : l'effort actif varie avec la motivation du jour.
3. **Timing structuré** : toute consigne de temps vit dans le `dosage` (`holdSeconds` OU `reps` OU `cycles`, exactement un). Jamais un timing en note libre qui contredit le champ structuré — le player suit le champ, pas la note.
4. **Matrice complète** : tout facteur pondéré dans `goals[].factors` doit être noté par au moins un test de la liste `tests` de ce goal (via son `factor` principal ou un `factorScoreOverride` d'option de followUp), ET ciblé par au moins un exercice de niveau débutant. C'est une erreur bloquante, pas un avertissement.
5. **Jamais d'URL inventée** : `videoUrl` reste `null` ; fournis un `videoQuery` (requête YouTube précise, en anglais, qui remonte des démonstrations de qualité). Images : uniquement des correspondances VÉRIFIÉES de free-exercise-db (lire les instructions de l'exercice source pour confirmer que c'est le même mouvement — leur « Butterfly » est une machine à pectoraux) via `remoteImages` + `imageAttribution` ; sinon `images: []`.
6. **Sécurité débutant** : chaque exercice a `safetyNotes` (signaux d'arrêt, adaptations) et `expectedFeeling` (distinguer sensation normale / signal d'alerte, ex. étirement vs pincement vs sensation électrique). Chaque exercice difficile a une chaîne de régression (`regressionOf`/`progressionOf`) menant à une variante niveau 0 faisable par tout le monde. Ne jamais encourager à pousser dans une douleur ou une butée articulaire (« le pincement est un mur, pas une porte »).
7. **Renfo ≥ étirement pour les objectifs de douleur/endurance** : un objectif type « ne plus avoir mal » doit pondérer majoritairement des facteurs de force/endurance et fournir les exercices correspondants.
8. **Réutilise la taxonomie** : raccorde-toi aux 20 `factors` existants. N'en crée un nouveau que si aucun ne convient vraiment, avec nom + description grand public, et alors fournis dans la même livraison au moins un test qui le note et des exercices qui le ciblent. Côté code, un nouveau facteur doit aussi être ajouté au type `FactorId` (`src/types.ts`), et un nouveau flag au type `TestFlag` et à la liste `FLAGS` de `scripts/validate-data.mjs`.
9. **Le tag `goals` est structurant** : le générateur ne pioche que parmi les exercices tagués avec un objectif actif, puis les classe par `targets`. Tague un exercice avec chaque objectif dont il travaille un facteur pondéré — et seulement ceux-là.
10. **Une pause par répétition est un timing** : « 8 répétitions avec 5 s de tenue » s'écrit en `cycles` (phases « levez et tenez » 5 s / « reposez » 3 s), pas en `reps` + note.

## Schémas (tous les textes en `{ "fr": "…" }`, ids en kebab-case)

### Goal
```jsonc
{
  "id": "…", "priority": 4,
  "name": {...}, "tagline": {...},
  "description": {...},                    // 3-5 phrases : mécanique du blocage chez le sédentaire, ce qui manque, pourquoi c'est entraînable
  "tests": ["…"],                          // 2-5 tests physiques (+ au besoin 1 auto-évaluation déclarative de l'objectif lui-même), ~15 min max au total
  "factors": { "factor-id": 0.4, … },      // poids sommant à ~1.0
  "milestones": {"fr": ["…"]},             // 4 jalons concrets, du premier succès à l'objectif atteint
  "prerequisites": []                      // ou [{"goalId": "…", "minLevel": 1}]
}
```

### Test
```jsonc
{
  "id": "…", "name": {...},
  "factor": "…",                           // facteur NOTÉ par les paliers
  "secondaryFactors": ["…"],               // informatif uniquement, ne note jamais
  "perSide": true,                          // dès que le mouvement peut être asymétrique
  "equipment": {...},                       // objets du quotidien uniquement (mur, lit, livre, serviette, chaise, miroir)
  "measure": { "kind": "level", "levels": [ {"score": 0-3, "label": {...}} ] },
  // OU: { "kind": "cm"|"seconds", "prompt": {...} } + "scoring": [{"min":…, "max":…, "score":…}]
  "instructions": {"fr": ["…"]},           // 4 étapes max, auto-administrables seul, position de départ incluse
  "interpretation": {...},                 // que signifie chaque profil de résultat, quelles conséquences sur le programme, quand consulter
  "followUp": {                            // optionnel : capture une observation qualitative
    "prompt": {...},
    "options": [ {"id": "…", "label": {...}, "flag": "…"|null,
                  "factorScoreOverride": {"factor": "…", "score": 0-3} } ]  // optionnel
  },
  "images": [], "videoUrl": null, "videoQuery": "…"
}
```
Exigences paliers : 4 niveaux (0=bloqué → 3=bon), formulés à la 1re personne, **observables seul sans matériel de mesure spécialisé**, couvrant tous les profils plausibles (y compris « impossible ») et mutuellement exclusifs.

### Exercise
```jsonc
{
  "id": "…", "name": {"fr": "…", "en": "…"},
  "targets": ["factor-id"],                 // ce que l'exercice développe
  "goals": ["goal-id"],                     // filtrage ; la sélection du générateur passe par targets
  "type": "stretch" | "strength" | "mobility-drill",
  "level": 0-3,                             // 0 = régression max, faisable par tous
  "regressionOf": null | "id", "progressionOf": null | "id",
  "dosage": // EXACTEMENT UN des trois :
    { "holdSeconds": 45, "sets": 2, "perSide": true }
    // { "reps": 10, "sets": 2, "perSide": false, "note": {...} }
    // { "sets": 2, "perSide": false, "cycles": { "count": 5, "phases": [ {"label": {...}, "seconds": 5}, … ] } }
  ,
  "equipment": {...},
  "instructions": {"fr": ["…"]},           // 4-5 étapes, position de départ d'abord, repères sensoriels concrets
  "commonMistakes": {"fr": ["…"]},         // 2-3, avec POURQUOI c'est une erreur
  "safetyNotes": {"fr": ["…"]},
  "expectedFeeling": {...},
  "avoidWithFlags": ["knee-pain-in-rotation"], // optionnel : jamais proposé tant qu'un de ces flags est actif
  "painMonitoring": true,                   // optionnel : exercice de charge du genou, gêne ≤ 3/10 stable acceptable (le player demande l'intensité)
  "images": [], "remoteImages": ["…"],     // si correspondance free-exercise-db vérifiée
  "imageAttribution": {...},               // obligatoire si remoteImages
  "videoUrl": null, "videoQuery": "…"
}
```

## Flags existants (réutiliser avant d'en créer)
`anterior-hip-impingement`, `seek-professional-advice`, `limited-hip-internal-rotation`, `responds-to-active-work`, `habitual-lumbar-extension`, `knee-pain-in-rotation`, `patellofemoral-pain`, `lateral-knee-pain`. Un nouveau flag doit être documenté : quel test le pose, ce que l'app en fait (affichage, sélection d'exercices, bandeau).

## Checklist de livraison
1. JSON valides, ids uniques, kebab-case, toutes références résolues.
2. Matrice : chaque facteur pondéré du/des goals livrés ↔ ≥1 test qui le note ET ≥1 exercice `level` 0-1 qui le cible.
3. Un seul type de dosage par exercice ; aucun timing en note libre contradictoire.
4. Chaque exercice `level ≥ 2` a une chaîne de régression jusqu'au niveau 0.
5. Tests : déroulés mentalement, paliers exhaustifs et exclusifs, référence = position relâchée, followUp pour toute seconde dimension.
6. Rédaction : vouvoiement, zéro jargon non expliqué, textes originaux (jamais copiés d'une source).
7. Faire tourner la validation ci-dessous et livrer sa sortie.

```python
import json
f = {x['id'] for x in json.load(open('factors.json'))['factors']}
G = json.load(open('goals.json'))['goals']; T = json.load(open('tests.json'))['tests']
E = json.load(open('exercises.json'))['exercises']
tb = {t['id']: t for t in T}; ids = [e['id'] for e in E]
assert len(ids) == len(set(ids))
for e in E:
    assert all(t in f for t in e['targets']) and all(g in {x['id'] for x in G} for g in e['goals']), e['id']
    for r in [e['regressionOf'], e['progressionOf']]: assert r is None or r in ids, e['id']
    assert len([k for k in ('holdSeconds','reps','cycles') if k in e['dosage']]) == 1, e['id']
for g in G:
    for fac in g['factors']:
        src = [tid for tid in g['tests'] if tb[tid]['factor'] == fac
               or any(o.get('factorScoreOverride',{}).get('factor') == fac
                      for o in tb[tid].get('followUp',{}).get('options',[]))]
        assert src, f"ERREUR: {g['id']}/{fac} sans test qui le note"
        assert any(fac in e['targets'] and g['id'] in e['goals'] and e['level'] <= 1 for e in E), \
            f"ERREUR: {g['id']}/{fac} sans exercice débutant tagué pour cet objectif"
eb = {e['id']: e for e in E}
def regression(e):
    if e['progressionOf']: return eb[e['progressionOf']]
    return next((x for x in E if x['regressionOf'] == e['id']), None)
for e in E:
    cur, seen = e, {e['id']}
    while cur and cur['level'] > 0:
        nxt = regression(cur)
        if not nxt or nxt['id'] in seen: break
        seen.add(nxt['id']); cur = nxt
    assert e['level'] < 2 or cur['level'] == 0, f"ERREUR: {e['id']} sans chaîne de régression jusqu'au level 0"
print("Validation OK")
```

Dans le dépôt, la référence est `npm run validate-data` (même règles, plus le schéma complet).
