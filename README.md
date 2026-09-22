# Super Support IT — Planning / ITSM

Refonte V2 de `Planning-Tech`.

## Stack

- React + TypeScript + Vite
- Supabase Auth + PostgreSQL + RLS + RPC + Realtime
- TanStack Query
- FullCalendar
- Recharts
- SheetJS
- Vitest + Playwright

## Modules

- Dashboard
- Planning Jour / 3 jours / Semaine / Mois
- Tickets ITSM
- Base Clients + contacts
- Utilisateurs Manager / Technicien
- Inventaire avec prix, modèles, quantités, réservations et mouvements
- KPI par période
- Configuration
- Audit
- Export Excel

## Sécurité

Le navigateur utilise uniquement la Project URL Supabase et la publishable key. Les opérations administratives sur Auth doivent passer par les Edge Functions dans `supabase/functions/`.

RLS reste la barrière de sécurité principale :
- Manager : visibilité globale
- Technicien : uniquement ses tickets
- Les champs sensibles d'un ticket sont protégés côté base
- Les commentaires imposent l'identité réelle via `auth.uid()`

## Développement

```bash
npm install
npm run dev
```

Variables optionnelles :

```env
VITE_SUPABASE_URL=https://ilxdqvbcvcwfklvkyfoj.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Une valeur publique de développement est déjà prévue dans `src/lib/supabase.ts`; ne jamais ajouter de `service_role`.

## Build

```bash
npm run build
npm test
```

## Branche

La refonte est développée dans `refactor/react-v1`. La version legacy reste intacte sur `main` tant que la V2 n'est pas validée.
