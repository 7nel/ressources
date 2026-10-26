# RessourceS — écarts assumés par rapport à la charte PL (v2.2)

Outil d'enseignant·es (bureau, tablette), lu de près. Il n'est jamais projeté devant des élèves. Ce fichier complète `../CLAUDE.md`.

| Règle de la charte | Écart | Raison | Date |
|---|---|---|---|
| Texte courant ≥ 18 px, légendes ≥ 16 px | Texte courant 16 px, aucun texte sous 14 px (`.875rem`). Les chiffres des pastilles font aussi 14 px. | Public adulte, lecture de près ; la règle des 18 px vise la projection et les élèves. Décision de Pauline. | 2026-10-18 |
| Noms de variables du socle | Noms hérités gardés : `--card`, `--muted`, `--line`, `--danger`, `--warn`… | Pas de migration sans demande (charte, « Règles de couleur »). | 2026-10-18 |
| Teintes propres | Niveaux de cotation `--l1`…`--l4`, phases `--ph1`…`--ph3`, palette `--cat1`…`--cat8` (couleur par élève et par famille de cours). | Cœur du produit : le sens de la cotation et de la phase. `--cat2` est un violet (`#9b3fb5` clair, `#c274d6` sombre ; ≥ 4,8:1 sur `--card`) : l'ancien orange se confondait avec le niveau 2 et la phase 3, et « Archivé » (badge neutre) n'est plus orange. | 2026-10-18 ; `--cat2` 2026-10-26 |
| Jetons du trait | `--line-ctl` (contour des commandes, ≥ 3:1), `--rule` (filet de structure : encre en clair, encre à 72 % en sombre), `--r-ctl` 8 px, `--r-label` 4 px, `--shadow-float`. Panneaux de données et tuiles à bords droits avec filet de 3 px ; cartes sans tableau, graphique ni champ ouvertes en sections là où `:has()` existe (repli : panneaux). | Direction « Le trait » validée le 2026-10-24 ; l'ombre n'existe plus que sur les couches flottantes. `--line` et `--line-strong` ne servent plus qu'aux séparateurs, aux contours d'étiquettes de données (badge neutre, moyenne) et aux tableaux imprimés. | 2026-10-24 |
| Couleur seule = pas d'information | Les moyennes de la synthèse sont des nombres neutres, sans couleur de niveau. | Une moyenne est une tendance, pas un constat. | 2026-10-18 |

## Décisions d'identité

- 2026-10-18 : le symbole de RessourceS est le monogramme **rS** (r minuscule, S majuscule), tracé à la main avec le trait du monogramme PL (cercle vert, trait blanc de 11 sur 160, bouts ronds). Source : `icons/icon.svg`. Les pistes « parcours » (chemins, tresses) ont été essayées et écartées ; elles ne rendaient pas l'idée à petite taille.
