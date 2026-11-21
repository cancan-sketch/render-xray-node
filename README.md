# render-xray-node

Personal xray node wrapper for a Render free web service.

Deploy on Render as a Web Service:
- Build command: `npm install`
- Start command: `npm start`
- Environment variables:
  - `UUID` — a VLESS UUID (generate one, never commit it)
  - `WS_PATH` — WebSocket path, e.g. `/vless`
  - `PORT` — provided by Render automatically

Render terminates TLS at the edge (`https://<service>.onrender.com`), xray listens plain WebSocket inside.

No credentials are stored in this repository.
