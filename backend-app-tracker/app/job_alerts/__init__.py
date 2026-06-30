"""Saved discovery searches with job alerts (FEAT-22).

A job alert is a saved discovery query (the same filters the Discover tab uses).
When new postings matching the query are ingested, the owner is notified via the
existing notifier. "New" means ingested since the alert was last checked, so a
seeker only hears about genuinely fresh roles.

The alert-matching core (``process_due_job_alerts`` / ``check_alert``) is pure
service logic so it can be unit-tested without the background loop; the running
loop piggybacks on the existing alerts scheduler.
"""
