//! Identity resolution scoped by workspace membership.
//!
//! `users` carries no row-level security, deliberately: one account can hold
//! memberships in several workspaces, so the table is global and RLS has no
//! workspace column to key on. The consequence is that a uuid-keyed read of
//! `users` is unscoped. Pinning the request's workspace does not help, because
//! the pin constrains the RLS-bearing tables joined alongside it (the role
//! lookup), not the identity row itself. Any authenticated member could
//! therefore read any user in the deployment by uuid, primary email included.
//!
//! The scope has to come from a join. `workspace_members` is the only table
//! that says who belongs where, so identity reads go through it.
//!
//! **Membership status is deliberately ignored here.** These functions resolve
//! *who someone is*, not *what they may do*: a former colleague still has to
//! render as a name on the tickets and comments they left behind. Everything
//! that decides authority reads `workspace_members` with `removed_at IS NULL`
//! instead; see `workspace_members_active_filter_lint`.

use diesel::prelude::*;
use uuid::Uuid;

use crate::db::DbConnection;
use crate::models::User;
use crate::schema::{users, workspace_members};

/// The identity of one user, if they are or ever were a member of this
/// workspace. `Ok(None)` for a stranger, so a caller cannot tell "no such
/// user" from "not someone you can see".
// members-any-status: identity resolution must still name people who have left,
// or their historical tickets and comments render as an unknown user.
pub fn find_member(
    conn: &mut DbConnection,
    workspace_id: i32,
    user_uuid: Uuid,
) -> QueryResult<Option<User>> {
    users::table
        .inner_join(workspace_members::table.on(workspace_members::user_uuid.eq(users::uuid)))
        .filter(workspace_members::workspace_id.eq(workspace_id))
        .filter(users::uuid.eq(user_uuid))
        .select(users::all_columns)
        .first::<User>(conn)
        .optional()
}

/// [`find_member`] for many uuids at once. Strangers are absent from the
/// result rather than reported, matching the singular form: a batch lookup
/// must not become an oracle for which uuids exist in other workspaces.
// members-any-status: as above.
pub fn find_members(
    conn: &mut DbConnection,
    workspace_id: i32,
    user_uuids: &[Uuid],
) -> QueryResult<Vec<User>> {
    if user_uuids.is_empty() {
        return Ok(Vec::new());
    }
    users::table
        .inner_join(workspace_members::table.on(workspace_members::user_uuid.eq(users::uuid)))
        .filter(workspace_members::workspace_id.eq(workspace_id))
        .filter(users::uuid.eq_any(user_uuids))
        .select(users::all_columns)
        .load::<User>(conn)
}
