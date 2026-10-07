// Shared by lib/db/removeDemo.ts and scripts/remove-demo-data.mts. No imports, so plain Node can load it.
export const DELETE_DEMO_WORKSPACE = "delete from workspaces where login = 'demo' returning id";
export const DELETE_ORPHAN_SEEDED_USERS = "delete from users u where u.github_id is null and not exists (select 1 from memberships m where m.user_id = u.id) returning id";
