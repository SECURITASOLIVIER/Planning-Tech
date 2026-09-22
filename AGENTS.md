# AGENTS.md — Super Support IT / Planning-Tech

## Contexte
Ce dépôt héberge une application web ITSM/planning sur GitHub Pages.

Frontend :
- `index.html`
- `app.css`
- `app.js`
- `setup.html`

Backend :
- Supabase project: `super-support-it`
- Project ref: `ilxdqvbcvcwfklvkyfoj`
- Auth: Supabase Auth email/password
- Base PostgreSQL avec RLS
- Rôles applicatifs : `manager` et `technician`

Le frontend peut contenir uniquement la Project URL et la publishable key.
NE JAMAIS exposer de `service_role`, mot de passe DB, JWT secret ou secret serveur dans GitHub.

## Objectif prioritaire
Rendre l'authentification réellement fonctionnelle de bout en bout.

L'écran doit proposer deux accès distincts :
1. Accès Manager
2. Accès Technicien

Le premier compte créé lors de l'initialisation doit devenir Manager.
Ensuite un Manager peut créer des comptes Techniciens et d'autres Managers depuis l'application.

## Droits attendus
### Manager
- voit tous les tickets
- voit tous les techniciens
- voit tous les plannings
- crée / modifie / réaffecte les tickets
- crée / active / désactive les utilisateurs
- configure catégories, types, statuts, priorités et matériel
- voit les KPI
- exporte les données en Excel
- peut rouvrir un ticket clôturé

### Technicien
- ne voit que les tickets dont `assigned_to = auth.uid()`
- ne voit que son planning
- peut travailler uniquement sur ses tickets
- peut ajouter des commentaires
- peut modifier les champs opérationnels autorisés
- ne peut pas créer / réaffecter des comptes
- ne peut pas voir les tickets des autres techniciens
- ne peut pas accéder à la configuration globale

## Commentaires
Chaque commentaire doit enregistrer automatiquement :
- `author_id = auth.uid()`
- le nom affiché du technicien au moment du commentaire
- la date/heure serveur
- le texte

Le technicien ne choisit jamais manuellement l'auteur.

## Tickets
Conserver :
- numéro
- titre
- utilisateur/demandeur
- description
- catégorie
- type
- statut
- priorité
- technicien assigné
- date/heure d'arrivée
- début/fin planifiés
- incident bloquant
- incident parent
- matériel nécessaire
- commentaire de résolution
- historique

Un ticket clôturé ne doit jamais disparaître.
La clôture exige un commentaire de résolution non vide.

## Problème actuel à corriger
Le parcours de création/connexion du premier Manager ne fonctionne pas correctement côté navigateur.

### Travail demandé
1. Reproduire le problème dans le navigateur.
2. Ouvrir la console et l'onglet Network.
3. Identifier l'erreur exacte avant de modifier du code.
4. Vérifier que la bibliothèque Supabase JS charge réellement sur GitHub Pages.
5. Vérifier `signUp`, `signInWithPassword`, la session et le chargement du profil.
6. Vérifier les erreurs CORS / CSP / CDN / GitHub Pages.
7. Vérifier le trigger de création de profil.
8. Vérifier que le premier utilisateur est bien Manager.
9. Vérifier les policies RLS pour Manager et Technicien.
10. Corriger le frontend et, si nécessaire, les migrations Supabase.
11. Tester réellement les scénarios ci-dessous.

## Tests obligatoires avant de considérer le travail terminé
- création du premier Manager
- connexion Manager
- déconnexion / reconnexion Manager
- création d'un Technicien par le Manager
- connexion Technicien
- le Technicien voit uniquement ses tickets
- un Technicien ne peut pas lire un ticket d'un autre technicien via appel API manuel
- commentaire Technicien avec auteur + date/heure
- clôture impossible sans résolution
- clôture possible avec résolution
- ticket clôturé reste visible
- export Excel Manager
- aucune clé secrète dans le dépôt

## Règles de travail
- Ne pas remplacer l'application par un framework lourd sans raison.
- Préserver le design actuel autant que possible.
- Préférer des changements ciblés et testables.
- Ne pas masquer les erreurs : afficher un message utilisateur clair ET logger l'erreur technique en console.
- Après chaque correction, tester dans GitHub Pages et pas seulement en local.
- Ne pas considérer le travail terminé tant que le login n'a pas été vérifié manuellement dans un navigateur.

## Git
Travailler sur une branche dédiée, par exemple :
`fix/auth-manager-technician`

Faire des commits petits et explicites.
Ne pas écraser `main` sans revue.
