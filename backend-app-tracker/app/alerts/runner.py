"""Background alert scheduler (FEAT-4).

Periodically scans for due alerts and delivers them via the configured notifier.
Started/stopped from the FastAPI lifespan. The actual delivery logic lives in
``alerts.service.process_due_alerts`` so it can be unit-tested without the loop.
"""

import asyncio
import logging
from datetime import datetime, timezone

from app.config import settings
from app.database import get_db
from app.alerts.service import process_due_alerts
from app.notifications.notifier import build_notifier

logger = logging.getLogger("careerlog.alerts")


async def _run_loop() -> None:
    notifier = build_notifier(settings)
    logger.info(
        "Alert scheduler started (every %ss, notifier=%s)",
        settings.alerts_poll_seconds,
        type(notifier).__name__,
    )
    while True:
        try:
            now = datetime.now(tz=timezone.utc)
            sent = await asyncio.to_thread(
                process_due_alerts, get_db(), notifier, now
            )
            if sent:
                logger.info("Delivered %s due alert(s)", sent)
        except Exception:
            logger.exception("Alert scheduler run failed")
        await asyncio.sleep(settings.alerts_poll_seconds)


def start(app) -> None:
    """Start the scheduler task and stash it on app state (if enabled)."""
    if not settings.alerts_enabled:
        logger.info("Alert scheduler disabled (ALERTS_ENABLED=false)")
        app.state.alert_task = None
        return
    app.state.alert_task = asyncio.create_task(_run_loop())


async def stop(app) -> None:
    task = getattr(app.state, "alert_task", None)
    if task is None:
        return
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
