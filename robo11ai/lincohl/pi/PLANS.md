# Lincohl Pi — Reliability Roadmap

## Approach A: Systemd + Watchdog (Implementing Now)

- Systemd service with `Restart=always` and watchdog timer
- Fix mic stream cleanup (currently just sets to None without stopping)
- Add conversation timeout to prevent infinite hang on `wait_for_session_end()`
- Add threading lock around personality PATCH to prevent race conditions
- Heartbeat file written every N seconds for watchdog monitoring

## Approach C: Full Stack Reliability (Future)

Everything in Approach A, plus:

### Internal Health Endpoint
- Lightweight HTTP server on a background thread (e.g., port 8421)
- `GET /health` returns JSON: uptime, current personality, mic status, last hotword time, last conversation time, error count
- Systemd watchdog can use this endpoint instead of a heartbeat file
- Dashboard can poll this endpoint for Pi agent status

### Structured Logging
- Replace basic `logging.basicConfig` with `RotatingFileHandler`
- Log to `~/.lincohl/logs/` with daily rotation, keep 7 days
- Structured JSON log format for machine parsing
- Separate error log for quick triage

### Retry Logic with Backoff
- Exponential backoff on PATCH failures (1s, 2s, 4s, max 30s)
- Retry sync server POST with 3 attempts before giving up
- Circuit breaker: if sync server fails 5x in a row, disable for 5 minutes then re-probe

### Remote Visibility
- Dashboard integration: Pi health status displayed in DevicePanel
- Sync server receives periodic heartbeats from Pi
- Alert mechanism: if no heartbeat for 60s, dashboard shows "Pi offline"

### Metrics (Optional)
- Track: conversations/day, avg latency, hotword false-positive rate, mic restarts
- Store in local SQLite or post to sync server
- Display trends in dashboard analytics tab

---

*Created: 2026-02-19*
*Status: Approach A in progress, Approach C planned for later*
