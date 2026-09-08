-- Apply only after source worker preflight and pilot pass.
select cron.schedule('certivoiq-support-preparation','*/5 * * * *','select private.certivoiq_support_preparation_tick();');
select cron.schedule('certivoiq-merlin-source-preparation','7 * * * *','select private.dispatch_merlin_source_preparation();');
-- AI extraction intentionally NOT scheduled until credentials and pilot pass.
-- Preflight: select private.dispatch_merlin_preparation(true);
-- Single extraction pilot: select private.dispatch_merlin_preparation(false);
-- Pause: select cron.unschedule('certivoiq-merlin-source-preparation');
-- Pause: select cron.unschedule('certivoiq-support-preparation');
