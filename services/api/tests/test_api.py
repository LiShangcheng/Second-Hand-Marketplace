import io
import os
import pytest
from services.api.app import create_app


@pytest.fixture()
def client():
    os.environ["USE_MOCK_DB"] = "1"
    app = create_app(testing=True)
    app.config.update({"TESTING": True})
    with app.test_client() as client:
        yield client
    os.environ.pop("USE_MOCK_DB", None)


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
    resp = client.get("/api/users/1/presence")
    assert resp.status_code == 200
    assert resp.get_json()["online"] is False

    resp = client.post("/api/users/1/presence")
    assert resp.status_code == 200
    assert resp.get_json()["online"] is True

    resp = client.delete("/api/users/1/presence")
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


def test_register_validation(client):
    resp = client.post("/api/auth/register", json={"email": "test@nyu.edu"})
    assert resp.status_code == 400
    resp = client.post("/api/auth/register", json={"password": "password123"})
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

    resp = client.post(f"/api/users/{user_id}/avatar")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "user" in data
    assert "avatar" in data["user"]


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

    data = {"avatar": (io.BytesIO(b"fake-image"), "avatar.png")}
    resp = client.post(
        f"/api/users/{user_id}/avatar",
        data=data,
        content_type="multipart/form-data",
    )
    assert resp.status_code == 200
    payload = resp.get_json()
    assert payload["user"]["avatar"].startswith("/static/uploads/")


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


def test_create_thread(client):
    # Create a listing owned by seller_id "2"
    listing_resp = client.post(
        "/api/listings",
        json={
            "title": "Listing for thread",
            "price": 10.0,
            "user_id": "2",
        },
    )
    assert listing_resp.status_code == 201
    listing = listing_resp.get_json()
    listing_id = listing["id"]

    resp = client.post(
        "/api/threads",
        json={
            "buyer_id": "1",
            "seller_id": "2",
            "listing_id": listing_id,
        },
    )
    assert resp.status_code == 201
    data = resp.get_json()
    assert "id" in data
    assert data["buyer_id"] == "1"
    assert data["seller_id"] == "2"
    assert data["listing_id"] == listing_id


def test_create_thread_validation(client):
    resp = client.post("/api/threads", json={})
    assert resp.status_code == 400
    resp = client.post("/api/threads", json={"buyer_id": "1"})
    assert resp.status_code == 400


def test_get_threads(client):
    listing_resp = client.post(
        "/api/listings",
        json={
            "title": "Listing for thread list",
            "price": 12.0,
            "user_id": "2",
        },
    )
    listing_id = listing_resp.get_json()["id"]

    client.post(
        "/api/threads",
        json={
            "buyer_id": "1",
            "seller_id": "2",
            "listing_id": listing_id,
        },
    )

    resp = client.get("/api/threads/1")
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_send_message(client):
    listing_resp = client.post(
        "/api/listings",
        json={
            "title": "Listing for message",
            "price": 18.0,
            "user_id": "2",
        },
    )
    listing_id = listing_resp.get_json()["id"]

    thread_resp = client.post(
        "/api/threads",
        json={
            "buyer_id": "1",
            "seller_id": "2",
            "listing_id": listing_id,
        },
    )
    assert thread_resp.status_code == 201
    thread_id = thread_resp.get_json()["id"]

    resp = client.post(
        "/api/messages",
        json={
            "thread_id": thread_id,
            "sender_id": "1",
            "content": "Hello",
        },
    )
    assert resp.status_code == 201
    data = resp.get_json()
    assert "id" in data
    assert data["content"] == "Hello"


def test_send_message_validation(client):
    resp = client.post("/api/messages", json={"thread_id": "1"})
    assert resp.status_code == 400


def test_send_message_thread_not_found(client):
    resp = client.post(
        "/api/messages",
        json={"thread_id": "999999999999999999999999", "sender_id": "1", "content": "Hi"},
    )
    assert resp.status_code == 404


def test_get_messages(client):
    listing_resp = client.post(
        "/api/listings",
        json={
            "title": "Listing for messages list",
            "price": 22.0,
            "user_id": "2",
        },
    )
    listing_id = listing_resp.get_json()["id"]

    thread_resp = client.post(
        "/api/threads",
        json={
            "buyer_id": "1",
            "seller_id": "2",
            "listing_id": listing_id,
        },
    )
    assert thread_resp.status_code == 201
    thread_id = thread_resp.get_json()["id"]

    client.post(
        "/api/messages",
        json={
            "thread_id": thread_id,
            "sender_id": "1",
            "content": "Test message",
        },
    )

    resp = client.get(f"/api/threads/{thread_id}/messages")
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list)
    assert len(data) > 0


def test_get_messages_forbidden_user(client):
    listing_resp = client.post(
        "/api/listings",
        json={
            "title": "Listing for messages forbidden",
            "price": 22.0,
            "user_id": "2",
        },
    )
    listing_id = listing_resp.get_json()["id"]

    thread_resp = client.post(
        "/api/threads",
        json={
            "buyer_id": "1",
            "seller_id": "2",
            "listing_id": listing_id,
        },
    )
    thread_id = thread_resp.get_json()["id"]

    resp = client.get(f"/api/threads/{thread_id}/messages?user_id=3")
    assert resp.status_code == 403


def test_upload_message_image(client):
    data = {"image": (io.BytesIO(b"fake-image"), "test.png")}
    resp = client.post("/api/messages/upload", data=data, content_type="multipart/form-data")
    assert resp.status_code == 201
    payload = resp.get_json()
    assert payload["url"].startswith("/static/uploads/")


def test_upload_message_image_missing_file(client):
    resp = client.post("/api/messages/upload", data={}, content_type="multipart/form-data")
    assert resp.status_code == 400


def test_unread_count(client):
    resp = client.get("/api/messages/1/unread-count")
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
