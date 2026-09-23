import io
import os
import base64
import hashlib
import hmac
import uuid
from datetime import datetime, timezone
import pytest
from services.api import app as app_module


create_app = app_module.create_app
PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"valid-test-image"


@pytest.fixture()
def client(tmp_path, monkeypatch):
    os.environ["USE_MOCK_DB"] = "1"
    monkeypatch.setattr(app_module, "UPLOAD_DIR", tmp_path)
    app = create_app(testing=True)
    app.config.update({"TESTING": True})
    with app.test_client() as client:
        yield client
    os.environ.pop("USE_MOCK_DB", None)


def create_test_user(client, label):
    return client.application.extensions["database"].create_user(
        email=f"{label}-{uuid.uuid4().hex}@nyu.edu",
        password="password123",
        nickname=label,
        email_verified=True,
    )


def auth_headers(client, user_id, issued_at=None):
    issued_at = issued_at or int(datetime.now(timezone.utc).timestamp())
    token_data = f"{user_id}:{issued_at}"
    payload = base64.urlsafe_b64encode(token_data.encode("utf-8")).decode("ascii").rstrip("=")
    secret = client.application.config["VERIFICATION_SECRET"].encode("utf-8")
    signature = hmac.new(secret, payload.encode("ascii"), hashlib.sha256).hexdigest()
    return {"Authorization": f"Bearer {payload}.{signature}"}


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.get_json()["status"] == "ok"


def test_health_alternative_route(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.get_json()["status"] == "ok"


def test_create_and_list_items(client):
    payload = {"name": "Book", "price": 10.5, "description": "CS"}
    resp = client.post("/api/items", json=payload)
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["name"] == payload["name"]
    assert data["price"] == payload["price"]

    list_resp = client.get("/api/items")
    assert list_resp.status_code == 200
    items = list_resp.get_json()
    assert any(it["name"] == "Book" for it in items)


def test_create_item_validation(client):
    resp = client.post("/api/items", json={"price": 1})
    assert resp.status_code == 400
    resp = client.post("/api/items", json={"name": "", "price": "abc"})
    assert resp.status_code == 400
    resp = client.post("/api/items", json={"name": "Test", "price": "invalid"})
    assert resp.status_code == 400


def test_get_communities(client):
    resp = client.get("/api/communities")
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list)
    assert len(data) > 0


def test_get_community_by_id(client):
    resp = client.get("/api/communities/1")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["id"] == 1


def test_get_community_not_found(client):
    resp = client.get("/api/communities/999")
    assert resp.status_code == 404


def test_user_presence_flow(client):
    user = create_test_user(client, "Presence")
    headers = auth_headers(client, user["id"])
    resp = client.get(f"/api/users/{user['id']}/presence")
    assert resp.status_code == 200
    assert resp.get_json()["online"] is False

    resp = client.post(f"/api/users/{user['id']}/presence", headers=headers)
    assert resp.status_code == 200
    assert resp.get_json()["online"] is True

    resp = client.delete(f"/api/users/{user['id']}/presence", headers=headers)
    assert resp.status_code == 200
    assert resp.get_json()["online"] is False


def test_listings_get(client):
    resp = client.get("/api/listings")
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list)


def test_listings_get_with_filters(client):
    resp = client.get("/api/listings?category=books&community_id=1")
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list)


def test_listings_post_form(client):
    resp = client.post(
        "/api/listings",
        data={
            "title": "Test Book",
            "price": "15.99",
            "description": "Test description",
            "category": "books",
        },
    )
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["title"] == "Test Book"


def test_listings_post_json(client):
    resp = client.post(
        "/api/listings",
        json={
            "title": "Test Item",
            "price": 20.5,
            "description": "Test",
            "category": "electronics",
        },
    )
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["title"] == "Test Item"


def test_listing_image_upload_validates_auth_type_and_count(client):
    seller = create_test_user(client, "PhotoSeller")
    headers = auth_headers(client, seller["id"])
    valid_data = {
        "title": "Photo listing",
        "price": "20",
        "user_id": seller["id"],
        "images": [
            (io.BytesIO(PNG_BYTES), "front.png", "image/png"),
            (io.BytesIO(PNG_BYTES), "back.png", "image/png"),
        ],
    }

    valid_resp = client.post(
        "/api/listings",
        data=valid_data,
        headers=headers,
        content_type="multipart/form-data",
    )
    assert valid_resp.status_code == 201
    assert len(valid_resp.get_json()["images"]) == 2

    unauthenticated_resp = client.post(
        "/api/listings",
        data={
            "title": "Unauthorized photo listing",
            "price": "20",
            "user_id": seller["id"],
            "images": (io.BytesIO(PNG_BYTES), "photo.png", "image/png"),
        },
        content_type="multipart/form-data",
    )
    assert unauthenticated_resp.status_code == 401

    too_many_resp = client.post(
        "/api/listings",
        data={
            "title": "Too many photos",
            "price": "20",
            "user_id": seller["id"],
            "images": [
                (io.BytesIO(PNG_BYTES), f"photo-{index}.png", "image/png")
                for index in range(6)
            ],
        },
        headers=headers,
        content_type="multipart/form-data",
    )
    assert too_many_resp.status_code == 400

    invalid_resp = client.post(
        "/api/listings",
        data={
            "title": "Invalid photo",
            "price": "20",
            "user_id": seller["id"],
            "images": (io.BytesIO(b"not-an-image"), "photo.png", "image/png"),
        },
        headers=headers,
        content_type="multipart/form-data",
    )
    assert invalid_resp.status_code == 400


@pytest.mark.parametrize(
    ("meetup_point", "community_id"),
    [
        ("Washington Square Park", "2"),
        ("Lipton Hall", "2"),
        ("Tandon / MetroTech", "1"),
        ("Othmer Hall", "1"),
        ("Jersey Street (Tandon)", "1"),
        ("Clark Street", "1"),
    ],
)
def test_listing_location_infers_consistent_community(client, meetup_point, community_id):
    resp = client.post(
        "/api/listings",
        json={
            "title": f"Item near {meetup_point}",
            "price": 20,
            "meetup_point": meetup_point,
        },
    )

    assert resp.status_code == 201
    assert resp.get_json()["community_id"] == community_id


def test_listings_post_validation(client):
    resp = client.post("/api/listings", json={"title": "Test"})
    assert resp.status_code == 400
    resp = client.post("/api/listings", json={"price": 10})
    assert resp.status_code == 400
    resp = client.post("/api/listings", json={"title": "Test", "price": "invalid"})
    assert resp.status_code == 400


def test_get_listing_by_id(client):
    create_resp = client.post(
        "/api/listings",
        json={
            "title": "Test Listing",
            "price": 25.0,
        },
    )
    assert create_resp.status_code == 201
    item_id = create_resp.get_json()["id"]

    resp = client.get(f"/api/listings/{item_id}")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["id"] == item_id


def test_get_listing_not_found(client):
    resp = client.get("/api/listings/nonexistent")
    assert resp.status_code == 404


def test_update_listing_status(client):
    create_resp = client.post(
        "/api/listings",
        json={
            "title": "Update Listing",
            "price": 30.0,
            "user_id": "9",
        },
    )
    item_id = create_resp.get_json()["id"]

    resp = client.put(
        f"/api/listings/{item_id}",
        json={"user_id": "9", "status": "sold"},
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["status"] == "sold"
    assert data["sold_at"] is not None


def test_update_listing_location_updates_community(client):
    create_resp = client.post(
        "/api/listings",
        json={
            "title": "Location Change",
            "price": 30,
            "user_id": "9",
            "meetup_point": "Washington Square Park",
        },
    )
    item_id = create_resp.get_json()["id"]

    resp = client.put(
        f"/api/listings/{item_id}",
        json={"user_id": "9", "meetup_point": "Othmer Hall"},
    )

    assert resp.status_code == 200
    assert resp.get_json()["meetup_point"] == "Othmer Hall"
    assert resp.get_json()["community_id"] == "1"


def test_update_listing_forbidden(client):
    create_resp = client.post(
        "/api/listings",
        json={
            "title": "Update Listing Forbidden",
            "price": 30.0,
            "user_id": "9",
        },
    )
    item_id = create_resp.get_json()["id"]

    resp = client.put(
        f"/api/listings/{item_id}",
        json={"user_id": "1", "status": "sold"},
    )
    assert resp.status_code == 403


def test_update_listing_validation(client):
    create_resp = client.post(
        "/api/listings",
        json={
            "title": "Update Listing Validation",
            "price": 30.0,
            "user_id": "9",
        },
    )
    item_id = create_resp.get_json()["id"]

    resp = client.put(
        f"/api/listings/{item_id}",
        json={"user_id": "9"},
    )
    assert resp.status_code == 400

    resp = client.put(
        f"/api/listings/{item_id}",
        json={"user_id": "9", "price": "invalid"},
    )
    assert resp.status_code == 400


def test_search_listings(client):
    resp = client.get("/api/listings/search?q=test")
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list)


def test_get_user_listings(client):
    resp = client.get("/api/users/1/listings")
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list)


def test_register(client):
    resp = client.post(
        "/api/auth/register",
        json={
            "email": "test@nyu.edu",
            "password": "password123",
            "nickname": "TestUser",
        },
    )
    assert resp.status_code == 201
    data = resp.get_json()
    assert "token" in data
    assert "user" in data
    assert data["user"]["email"] == "test@nyu.edu"
    assert data["user"]["email_verified"] is True

    session_resp = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {data['token']}"},
    )
    assert session_resp.status_code == 200
    assert session_resp.get_json()["email"] == "test@nyu.edu"


def test_register_validation(client):
    resp = client.post("/api/auth/register", json={"email": "test@nyu.edu"})
    assert resp.status_code == 400
    resp = client.post("/api/auth/register", json={"password": "password123"})
    assert resp.status_code == 400
    resp = client.post(
        "/api/auth/register",
        json={"email": "test@gmail.com", "password": "password123"},
    )
    assert resp.status_code == 400
    resp = client.post(
        "/api/auth/register",
        json={"email": "foo@bar@nyu.edu", "password": "password123"},
    )
    assert resp.status_code == 400


def test_login(client):
    client.post(
        "/api/auth/register",
        json={
            "email": "login@nyu.edu",
            "password": "password123",
            "nickname": "LoginUser",
        },
    )
    resp = client.post(
        "/api/auth/login",
        json={
            "email": "login@nyu.edu",
            "password": "password123",
        },
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert "token" in data
    assert "user" in data


def test_login_invalid_credentials(client):
    resp = client.post(
        "/api/auth/login",
        json={
            "email": "wrong@nyu.edu",
            "password": "wrongpassword",
        },
    )
    assert resp.status_code == 401


def test_current_session_requires_valid_token(client):
    user = create_test_user(client, "SessionUser")

    missing_resp = client.get("/api/auth/me")
    assert missing_resp.status_code == 401

    invalid_resp = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid"})
    assert invalid_resp.status_code == 401

    expired_at = int(datetime.now(timezone.utc).timestamp()) - client.application.config["AUTH_TOKEN_TTL_SECONDS"] - 1
    expired_resp = client.get("/api/auth/me", headers=auth_headers(client, user["id"], expired_at))
    assert expired_resp.status_code == 401

    valid_resp = client.get("/api/auth/me", headers=auth_headers(client, user["id"]))
    assert valid_resp.status_code == 200
    assert valid_resp.get_json()["id"] == user["id"]


def test_get_user(client):
    register_resp = client.post(
        "/api/auth/register",
        json={
            "email": "user@nyu.edu",
            "password": "password123",
            "nickname": "TestUser",
        },
    )
    user_id = register_resp.get_json()["user"]["id"]

    resp = client.get(f"/api/users/{user_id}")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["id"] == user_id


def test_update_user(client):
    register_resp = client.post(
        "/api/auth/register",
        json={
            "email": "update@nyu.edu",
            "password": "password123",
            "nickname": "OldName",
        },
    )
    user_id = register_resp.get_json()["user"]["id"]

    resp = client.put(f"/api/users/{user_id}", json={"nickname": "NewName"})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["nickname"] == "NewName"


def test_update_user_email_without_reverification(client):
    original_email = "change-email@nyu.edu"
    new_email = "changed-email@nyu.edu"
    register_resp = client.post(
        "/api/auth/register",
        json={
            "email": original_email,
            "password": "password123",
            "nickname": "EmailUser",
        },
    )
    user_id = register_resp.get_json()["user"]["id"]

    resp = client.put(f"/api/users/{user_id}", json={"email": new_email})
    assert resp.status_code == 200
    assert resp.get_json()["email"] == new_email
    assert resp.get_json()["email_verified"] is True


def test_update_user_validation(client):
    register_resp = client.post(
        "/api/auth/register",
        json={
            "email": "validation@nyu.edu",
            "password": "password123",
            "nickname": "TestUser",
        },
    )
    user_id = register_resp.get_json()["user"]["id"]

    resp = client.put(f"/api/users/{user_id}", json={})
    assert resp.status_code == 400

    resp = client.put(f"/api/users/{user_id}", json={"email": "bad@example.com"})
    assert resp.status_code == 400


def test_get_user_not_found(client):
    resp = client.get("/api/users/999")
    assert resp.status_code == 404


def test_upload_avatar(client):
    register_resp = client.post(
        "/api/auth/register",
        json={
            "email": "avatar@nyu.edu",
            "password": "password123",
            "nickname": "AvatarUser",
        },
    )
    user_id = register_resp.get_json()["user"]["id"]

    resp = client.post(f"/api/users/{user_id}/avatar", headers=auth_headers(client, user_id))
    assert resp.status_code == 400
    assert resp.get_json()["error"] == "image required"


def test_upload_avatar_with_file(client):
    register_resp = client.post(
        "/api/auth/register",
        json={
            "email": "avatarfile@nyu.edu",
            "password": "password123",
            "nickname": "AvatarFileUser",
        },
    )
    user_id = register_resp.get_json()["user"]["id"]

    data = {"avatar": (io.BytesIO(PNG_BYTES), "avatar.png", "image/png")}
    resp = client.post(
        f"/api/users/{user_id}/avatar",
        data=data,
        headers=auth_headers(client, user_id),
        content_type="multipart/form-data",
    )
    assert resp.status_code == 200
    payload = resp.get_json()
    assert payload["user"]["avatar"].startswith("/static/uploads/")


def test_upload_avatar_requires_matching_user(client):
    owner = create_test_user(client, "AvatarOwner")
    attacker = create_test_user(client, "AvatarAttacker")
    data = {"avatar": (io.BytesIO(PNG_BYTES), "avatar.png", "image/png")}

    resp = client.post(
        f"/api/users/{owner['id']}/avatar",
        data=data,
        headers=auth_headers(client, attacker["id"]),
        content_type="multipart/form-data",
    )

    assert resp.status_code == 403


def test_add_favorite(client):
    listing_resp = client.post(
        "/api/listings",
        json={
            "title": "Favorite Item",
            "price": 30.0,
        },
    )
    listing_id = listing_resp.get_json()["id"]

    resp = client.post(
        "/api/favorites",
        json={
            "user_id": "1",
            "listing_id": listing_id,
        },
    )
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["ok"] is True


def test_add_favorite_validation(client):
    resp = client.post("/api/favorites", json={})
    assert resp.status_code == 400
    resp = client.post("/api/favorites", json={"user_id": "1"})
    assert resp.status_code == 400
    resp = client.post("/api/favorites", json={"listing_id": "1"})
    assert resp.status_code == 400


def test_remove_favorite(client):
    listing_resp = client.post(
        "/api/listings",
        json={
            "title": "Remove Item",
            "price": 40.0,
        },
    )
    listing_id = listing_resp.get_json()["id"]
    client.post("/api/favorites", json={"user_id": "1", "listing_id": listing_id})

    resp = client.delete(f"/api/favorites/{listing_id}?user_id=1")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["ok"] is True


def test_remove_favorite_validation(client):
    resp = client.delete("/api/favorites/1")
    assert resp.status_code == 400


def test_get_user_favorites(client):
    listing_resp = client.post(
        "/api/listings",
        json={
            "title": "Favorite Item 2",
            "price": 50.0,
        },
    )
    listing_id = listing_resp.get_json()["id"]
    client.post("/api/favorites", json={"user_id": "2", "listing_id": listing_id})

    resp = client.get("/api/users/2/favorites")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "favorites" in data
    assert "favorite_ids" in data


def create_chat_thread(client, title="Chat listing"):
    buyer = create_test_user(client, "Buyer")
    seller = create_test_user(client, "Seller")
    listing_resp = client.post(
        "/api/listings",
        json={
            "title": title,
            "price": 10.0,
            "user_id": seller["id"],
        },
    )
    thread_resp = client.post(
        "/api/threads",
        json={
            "buyer_id": buyer["id"],
            "seller_id": seller["id"],
            "listing_id": listing_resp.get_json()["id"],
        },
        headers=auth_headers(client, buyer["id"]),
    )
    return buyer, seller, listing_resp, thread_resp


def test_create_thread(client):
    buyer, seller, listing_resp, resp = create_chat_thread(client, "Listing for thread")
    assert resp.status_code == 201
    data = resp.get_json()
    assert "id" in data
    assert data["buyer_id"] == buyer["id"]
    assert data["seller_id"] == seller["id"]
    assert data["listing_id"] == listing_resp.get_json()["id"]


def test_chat_rejects_unauthenticated_and_impersonated_requests(client):
    buyer, seller, _, thread_resp = create_chat_thread(client, "Protected chat")
    thread_id = thread_resp.get_json()["id"]

    unauthenticated = client.get(f"/api/threads/{thread_id}/messages")
    assert unauthenticated.status_code == 401

    impersonated = client.post(
        "/api/messages",
        json={
            "thread_id": thread_id,
            "sender_id": seller["id"],
            "content": "Forged sender",
        },
        headers=auth_headers(client, buyer["id"]),
    )
    assert impersonated.status_code == 403


def test_create_thread_validation(client):
    resp = client.post("/api/threads", json={})
    assert resp.status_code == 400
    resp = client.post("/api/threads", json={"buyer_id": "1"})
    assert resp.status_code == 400


def test_get_threads(client):
    buyer, _, _, _ = create_chat_thread(client, "Listing for thread list")

    resp = client.get(f"/api/threads/{buyer['id']}", headers=auth_headers(client, buyer["id"]))
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_send_message(client):
    buyer, _, _, thread_resp = create_chat_thread(client, "Listing for message")
    assert thread_resp.status_code == 201
    thread_id = thread_resp.get_json()["id"]

    resp = client.post(
        "/api/messages",
        json={
            "thread_id": thread_id,
            "sender_id": buyer["id"],
            "content": "Hello",
        },
        headers=auth_headers(client, buyer["id"]),
    )
    assert resp.status_code == 201
    data = resp.get_json()
    assert "id" in data
    assert data["content"] == "Hello"


def test_send_message_validation(client):
    resp = client.post("/api/messages", json={"thread_id": "1"})
    assert resp.status_code == 400


def test_send_message_thread_not_found(client):
    user = create_test_user(client, "MissingThread")
    resp = client.post(
        "/api/messages",
        json={"thread_id": "999999999999999999999999", "sender_id": user["id"], "content": "Hi"},
        headers=auth_headers(client, user["id"]),
    )
    assert resp.status_code == 404


def test_get_messages(client):
    buyer, _, _, thread_resp = create_chat_thread(client, "Listing for messages list")
    assert thread_resp.status_code == 201
    thread_id = thread_resp.get_json()["id"]

    client.post(
        "/api/messages",
        json={
            "thread_id": thread_id,
            "sender_id": buyer["id"],
            "content": "Test message",
        },
        headers=auth_headers(client, buyer["id"]),
    )

    resp = client.get(
        f"/api/threads/{thread_id}/messages",
        headers=auth_headers(client, buyer["id"]),
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list)
    assert len(data) > 0


def test_get_messages_forbidden_user(client):
    _, _, _, thread_resp = create_chat_thread(client, "Listing for messages forbidden")
    thread_id = thread_resp.get_json()["id"]
    outsider = create_test_user(client, "Outsider")

    resp = client.get(
        f"/api/threads/{thread_id}/messages?user_id={outsider['id']}",
        headers=auth_headers(client, outsider["id"]),
    )
    assert resp.status_code == 403


def test_upload_message_image(client):
    user = create_test_user(client, "ImageSender")
    data = {"image": (io.BytesIO(PNG_BYTES), "test.png", "image/png")}
    resp = client.post(
        "/api/messages/upload",
        data=data,
        headers=auth_headers(client, user["id"]),
        content_type="multipart/form-data",
    )
    assert resp.status_code == 201
    payload = resp.get_json()
    assert payload["url"].startswith("/static/uploads/")


def test_upload_message_image_missing_file(client):
    user = create_test_user(client, "MissingImage")
    resp = client.post(
        "/api/messages/upload",
        data={},
        headers=auth_headers(client, user["id"]),
        content_type="multipart/form-data",
    )
    assert resp.status_code == 400


def test_upload_message_image_rejects_invalid_and_oversized_files(client):
    user = create_test_user(client, "InvalidImage")
    headers = auth_headers(client, user["id"])

    invalid_resp = client.post(
        "/api/messages/upload",
        data={"image": (io.BytesIO(b"not-an-image"), "fake.png", "image/png")},
        headers=headers,
        content_type="multipart/form-data",
    )
    assert invalid_resp.status_code == 400

    oversized_resp = client.post(
        "/api/messages/upload",
        data={
            "image": (
                io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"x" * app_module.MAX_IMAGE_BYTES),
                "large.png",
                "image/png",
            )
        },
        headers=headers,
        content_type="multipart/form-data",
    )
    assert oversized_resp.status_code == 413


def test_unread_count(client):
    user = create_test_user(client, "Unread")
    resp = client.get(
        f"/api/messages/{user['id']}/unread-count",
        headers=auth_headers(client, user["id"]),
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert "unread" in data


def test_handle_reports_post(client):
    resp = client.post("/api/reports", json={"reason": "spam"})
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["ok"] is True


def test_handle_reports_get(client):
    client.post("/api/reports", json={"reason": "spam"})
    resp = client.get("/api/reports")
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list)


def test_dashboard_stats(client):
    resp = client.get("/api/stats/dashboard")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "listings" in data
    assert "users" in data
    assert "favorites" in data


def test_category_stats(client):
    client.post(
        "/api/listings",
        json={
            "title": "Category Test",
            "price": 15.0,
            "category": "books",
        },
    )
    resp = client.get("/api/stats/categories")
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, dict)
