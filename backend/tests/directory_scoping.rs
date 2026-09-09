//! Identity resolution is scoped by workspace membership.
//!
//! `users` has no row-level security, deliberately: an account spans
//! workspaces, so there is no workspace column for RLS to key on. That makes a
//! uuid-keyed read of `users` unscoped, and pinning the request's workspace
//! does not fix it, because the pin constrains the RLS-bearing tables joined
//! alongside the identity row rather than the row itself.
//!
//! These drive `repository::directory` directly, since it is the join that
//! carries the property.

#![allow(clippy::expect_used)]

use backend::db::DbConnection;
use backend::repository::directory;
use backend::repository::workspaces::{add_membership, remove_membership, SeatWriteAuthority};
use backend::sync::actor::ActorContext;
use backend::sync::session::with_actor_context;

mod common;

fn join(conn: &mut DbConnection, workspace_id: i32, user: uuid::Uuid, role: &str) {
    let actor = ActorContext::user(user, None).with_workspace(workspace_id);
    with_actor_context::<_, diesel::result::Error>(conn, &actor, |c| {
        add_membership(
            c,
            workspace_id,
            user,
            role,
            SeatWriteAuthority::ControlPlane,
        )?;
        Ok(())
    })
    .expect("add membership");
}

#[test]
fn a_member_of_another_workspace_does_not_resolve() {
    common::ensure_test_keyring();
    let test_db = common::TestDb::new();
    let pool = test_db.pool_with_size(2);
    let mut conn = pool.get().expect("conn");

    let ours = common::mint_workspace(&mut conn, "acme-dir-ours", "Ours");
    let theirs = common::mint_workspace(&mut conn, "acme-dir-theirs", "Theirs");
    let colleague = common::insert_user(&mut conn, "Our Colleague");
    let stranger = common::insert_user(&mut conn, "Their Employee");

    join(&mut conn, ours, colleague.uuid, "agent");
    join(&mut conn, theirs, stranger.uuid, "agent");

    assert!(
        directory::find_member(&mut conn, ours, colleague.uuid)
            .expect("query")
            .is_some(),
        "a member of this workspace resolves"
    );
    assert!(
        directory::find_member(&mut conn, ours, stranger.uuid)
            .expect("query")
            .is_none(),
        "someone else's employee must not resolve by uuid alone"
    );
}

#[test]
fn a_batch_lookup_is_not_a_cheaper_oracle() {
    common::ensure_test_keyring();
    let test_db = common::TestDb::new();
    let pool = test_db.pool_with_size(2);
    let mut conn = pool.get().expect("conn");

    let ours = common::mint_workspace(&mut conn, "acme-dir-batch", "Ours Batch");
    let theirs = common::mint_workspace(&mut conn, "acme-dir-batch-x", "Theirs Batch");
    let colleague = common::insert_user(&mut conn, "Batch Colleague");
    let stranger = common::insert_user(&mut conn, "Batch Stranger");

    join(&mut conn, ours, colleague.uuid, "agent");
    join(&mut conn, theirs, stranger.uuid, "agent");

    let found =
        directory::find_members(&mut conn, ours, &[colleague.uuid, stranger.uuid]).expect("query");
    let uuids: Vec<uuid::Uuid> = found.iter().map(|u| u.uuid).collect();
    assert!(uuids.contains(&colleague.uuid));
    assert!(
        !uuids.contains(&stranger.uuid),
        "batching must not resolve what the singular lookup hides"
    );
}

/// The reason `removed_at` had to land before this join could. Identity
/// resolution deliberately ignores membership status, or every person who has
/// ever left renders as an unknown user on the tickets and comments they left
/// behind.
#[test]
fn a_former_colleague_still_resolves() {
    common::ensure_test_keyring();
    let test_db = common::TestDb::new();
    let pool = test_db.pool_with_size(2);
    let mut conn = pool.get().expect("conn");

    let ws = common::mint_workspace(&mut conn, "acme-dir-former", "Ours Former");
    let leaver = common::insert_user(&mut conn, "Former Colleague");
    join(&mut conn, ws, leaver.uuid, "agent");

    let actor = ActorContext::user(leaver.uuid, None).with_workspace(ws);
    with_actor_context::<_, diesel::result::Error>(&mut conn, &actor, |c| {
        remove_membership(c, ws, leaver.uuid, SeatWriteAuthority::ControlPlane)?;
        Ok(())
    })
    .expect("remove");

    assert!(
        directory::find_member(&mut conn, ws, leaver.uuid)
            .expect("query")
            .is_some(),
        "a former member's name must still resolve, or their history renders blank"
    );
}
