select cron.schedule('certivoiq-absence-watchdog', '*/15 * * * *', 'select private.certivoiq_absence_watchdog();');
-- Pause: select cron.unschedule('certivoiq-absence-watchdog');
