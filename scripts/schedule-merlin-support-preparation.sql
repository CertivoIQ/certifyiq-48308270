-- Current production schedule: one native worker invocation each hour.
-- Apply only after successful provider preflight and PDF pilot.
begin;
select cron.unschedule(jobid) from cron.job where jobname='certivoiq-merlin-source-preparation';
select cron.schedule('certivoiq-merlin-preparation','7 * * * *','select private.dispatch_merlin_preparation(false);');
select cron.schedule('certivoiq-support-preparation','*/5 * * * *','select private.certivoiq_support_preparation_tick();');
commit;
-- Preflight: select private.dispatch_merlin_preparation(true);
-- Pause AI: select cron.unschedule('certivoiq-merlin-preparation');
-- Source-only fallback (first pause AI):
-- select cron.schedule('certivoiq-merlin-source-preparation','7 * * * *','select private.dispatch_merlin_source_preparation();');
-- Pause support: select cron.unschedule('certivoiq-support-preparation');
