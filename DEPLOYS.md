# Deploy log

Deploys are push-driven: merging or pushing to `main` deploys automatically on
the Hostinger hPanel Node.js runtime (no deploy script, no pm2, no SSH — env
vars live in hPanel). Rollback = revert-and-push. Record one row per deploy
by hand; commit the row before the next push (the worktree must be clean to
deploy).

| Date (UTC)      | Sha                                      | Checks passed | Rollback |
|-----------------|------------------------------------------|---------------|----------|
