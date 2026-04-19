# Avnik - Base React Whiteboard Setup

This is the initial production-oriented base for the Avnik meeting application rebuild.

Current scope is intentionally limited to:
- React application scaffold (TypeScript)
- Redux store foundation with typed hooks
- Excalidraw whiteboard module as the primary full-screen background area
- Video conference UI shell (layout only, no media)

Real-time meeting features (WebRTC, chat backend, screen share, file share, etc.) are not implemented yet.

## Tech Stack

- React (Vite)
- TypeScript
- Redux Toolkit
- React Redux
- Excalidraw (`@excalidraw/excalidraw`)

## Project Structure

```text
src/
  app/
    StoreProvider.tsx
    store.ts
    hooks.ts
  features/
    whiteboard/
      WhiteboardModule.tsx
      whiteboard.css
      whiteboardSlice.ts
    videoConference/
      VideoConferenceModule.tsx
      MeetingIcons.tsx
      videoConference.css
      videoConferenceSlice.ts
  App.tsx
  App.css
  main.tsx
  index.css
  vite-env.d.ts
```

## Run Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Runs `tsc --noEmit` then Vite production build.

## Typecheck only

```bash
npm run typecheck
```

## Notes

- Whiteboard is rendered as the full app workspace.
- Redux is wired with `RootState` / `AppDispatch` and `useAppSelector` / `useAppDispatch` in `src/app/hooks.ts`.
- This baseline stays minimal so future feature integration stays controlled.
