// Public Hostinger evaluation must never request internal model diagnostics.
delete process.env.EVAL_DIAGNOSTICS_TOKEN
await import('./run-evals.mjs')
