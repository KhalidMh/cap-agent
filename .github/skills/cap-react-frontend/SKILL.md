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
└── vite.config.ts
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
- Prefer explicit props typing over `React.FC`:

```tsx
interface ProductCardProps {
  name: string;
  price: number;
  currency: string;
  onSelect: (id: string) => void;
}

export function ProductCard({ name, price, currency, onSelect }: ProductCardProps) {
  return (
    <div onClick={() => onSelect(name)} role="button" tabIndex={0}>
      <h3>{name}</h3>
      <span>{price} {currency}</span>
    </div>
  );
}
```

## Hooks

- Prefix custom hooks with `use` (e.g. `useProducts`, `useAuth`).
- Keep hooks in `src/hooks/`.
- Never call hooks conditionally.
- Extract data fetching into custom hooks:

```tsx
// src/hooks/useProducts.ts
import { useState, useEffect } from 'react';
import { getProducts } from '../services/products';
import type { Product } from '../types/product';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProducts()
      .then(data => { if (!cancelled) setProducts(data); })
      .catch(err => { if (!cancelled) setError(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { products, loading, error };
}
```

## Routing (React Router)

- Define routes in a central `router.tsx` or inside `App.tsx`.
- Use `<Outlet />` for nested layouts.
- Use `useParams()`, `useSearchParams()`, `useNavigate()` — never `window.location`.
- Protect routes with auth wrappers, not inline checks.

## Consuming CAP OData Services

The React frontend communicates with the CAP backend via OData V4.

- Create API client functions in `src/services/`.
- Use the AppRouter's proxy path (e.g. `/odata/v4/catalog/`) — never hardcode full backend URLs.
- Handle OData error responses.
- Type all API responses with TypeScript interfaces matching CDS entities.

```tsx
// src/services/products.ts
import type { Product } from '../types/product';

const BASE = '/odata/v4/catalog';

export async function getProducts(top = 50, skip = 0): Promise<Product[]> {
  const res = await fetch(`${BASE}/Products?$top=${top}&$skip=${skip}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed: ${res.status}`);
  }
  const data = await res.json();
  return data.value;
}

export async function getProduct(id: string): Promise<Product> {
  const res = await fetch(`${BASE}/Products(${id})`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Not found: ${res.status}`);
  }
  return res.json();
}

export async function createProduct(product: Omit<Product, 'ID'>): Promise<Product> {
  const res = await fetch(`${BASE}/Products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Create failed: ${res.status}`);
  }
  return res.json();
}
```

## Vite Proxy for Local Dev

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/odata': {
        target: 'http://localhost:4004',
        changeOrigin: true,
      },
    },
  },
});
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
- Missing cleanup in `useEffect` (race conditions on unmount).
