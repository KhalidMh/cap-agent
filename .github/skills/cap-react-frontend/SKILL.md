---
name: cap-react-frontend
description: React frontend development inside an SAP CAP project. Use when working with React components, hooks, routing, TypeScript interfaces, API consumption from CAP OData/REST services, or any code under the app/ directory.
---

# React Frontend (TypeScript)

This project uses React with TypeScript as a custom frontend inside a CAP application, located in the `app/` directory.

## Context7 — Docs Lookup

When answering React-related questions, fetch docs from Context7:

- **React**: `context7/query-docs` with `context7CompatibleLibraryID` = `/reactjs/react.dev`
- **React Router**: `context7/query-docs` with `context7CompatibleLibraryID` = `/remix-run/react-router`

Do this automatically before answering. Do NOT skip.

## Project Structure

```
app/
├── public/
├── src/
│   ├── components/       # Reusable UI components
│   ├── pages/            # Route-level components
│   ├── hooks/            # Custom hooks
│   ├── services/         # API client / OData helpers
│   ├── types/            # TypeScript interfaces and types
│   ├── utils/            # Pure utility functions
│   ├── App.tsx
│   └── main.tsx
├── tsconfig.json
├── package.json
└── vite.config.ts        # or equivalent bundler config
```

## TypeScript Conventions

- All components use `.tsx` extension.
- Define props as explicit `interface` — never use `any`.
- Export types from `src/types/` and import where needed.
- Use `type` for unions/aliases, `interface` for object shapes.
- Enable `strict` mode in `tsconfig.json`.

## Component Patterns

- Use **functional components** only — no class components.
- Prefer named exports over default exports for components.
- Keep components small — extract logic into custom hooks.
- Co-locate component-specific types in the same file if not shared.
- Use `React.FC` sparingly — prefer explicit props typing:

```tsx
interface ProductCardProps {
  name: string;
  price: number;
  onSelect: (id: string) => void;
}

export function ProductCard({ name, price, onSelect }: ProductCardProps) {
  return (
    <div onClick={() => onSelect(name)}>
      <h3>{name}</h3>
      <span>{price}</span>
    </div>
  );
}
```

## Hooks

- Prefix custom hooks with `use` (e.g. `useProducts`, `useAuth`).
- Keep hooks in `src/hooks/`.
- Never call hooks conditionally.
- Extract data fetching into custom hooks — keep components presentational.

## Routing (React Router)

- Define routes in a central `router.tsx` or inside `App.tsx`.
- Use `<Outlet />` for nested layouts.
- Use `useParams()`, `useSearchParams()`, `useNavigate()` — never `window.location`.
- Protect routes with auth wrappers, not inline checks.

## Consuming CAP OData Services

The React frontend communicates with the CAP backend via OData V4 (or REST if configured).

- Create API client functions in `src/services/`.
- Use the AppRouter's proxy path (e.g. `/odata/v4/catalog/`) — never hardcode full backend URLs.
- Handle OData error responses (`error.message` from the JSON body).
- Type all API responses with TypeScript interfaces matching CDS entities.

```tsx
// src/services/products.ts
const BASE = '/odata/v4/catalog';

export async function getProducts(): Promise<Product[]> {
  const res = await fetch(`${BASE}/Products`);
  if (!res.ok) throw new Error(`Failed to fetch products: ${res.status}`);
  const data = await res.json();
  return data.value;
}

export async function getProduct(id: string): Promise<Product> {
  const res = await fetch(`${BASE}/Products(${id})`);
  if (!res.ok) throw new Error(`Product not found: ${res.status}`);
  return res.json();
}
```

## State Management

- Use `useState` / `useReducer` for local state.
- Lift state to the nearest common ancestor — avoid prop drilling beyond 2 levels.
- For deeply shared state, use React Context sparingly.
- Do NOT introduce a state library (Redux, Zustand) unless complexity demands it.

## Error Handling

- Wrap route-level components with error boundaries.
- Show user-friendly error messages — never raw stack traces.
- Log errors to console in development only.

## Anti-Patterns

- `any` type anywhere — always define proper types.
- Fetching data directly in component body instead of `useEffect` or a custom hook.
- Hardcoded backend URLs instead of relative proxy paths.
- Massive components (200+ lines) — split into smaller pieces.
- Business logic in components — move to hooks or `src/utils/`.
- `index.tsx` files that re-export everything — keep imports explicit.
