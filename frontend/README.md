# CouponKeeper Frontend

React + Vite frontend for the CouponKeeper FastAPI backend.

## Local Development
1. Start the FastAPI backend on http://localhost:8000.
2. From this folder, run `npm run dev`.
3. Open http://localhost:5173.

The Vite dev server proxies `/api/v1/*` requests to the backend URL in `VITE_API_URL` (default: `http://localhost:8000`).

## Notes
- Frontend app entry is `src/App.tsx`.
- API requests are sent to FastAPI endpoints under `/api/v1`.
