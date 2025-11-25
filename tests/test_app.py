import json


def register_user(client, email="user@example.com", password="password123", nickname="Tester"):
    payload = {
        "email": email,
        "password": password,
        "nickname": nickname,
        "community_id": 1,
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 201, response.get_data(as_text=True)
    data = response.get_json()
    return data["user"]


def create_listing(client, user_id, title="Desk Lamp"):
    payload = {
        "user_id": user_id,
        "title": title,
        "price": 15.5,
        "category": "electronics",
        "community_id": 1,
        "description": "A good lamp",
        "images": ["uploads/pic.jpg"],
    }
    response = client.post("/api/listings", json=payload)
    assert response.status_code == 201, response.get_data(as_text=True)
    return response.get_json()


def test_register_and_login_success(client):
    user = register_user(client, email="login@example.com")

    response = client.post(
        "/api/auth/login",
        json={"email": user["email"], "password": "password123"},
    )

    assert response.status_code == 200
    data = response.get_json()
    assert data["user"]["id"] == user["id"]
    assert "token" in data


def test_register_rejects_invalid_email(client):
    response = client.post(
        "/api/auth/register",
        json={
            "email": "not-an-email",
            "password": "password123",
            "nickname": "Bad",
            "community_id": 1,
        },
    )
    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data


def test_listing_view_increments(client):
    user = register_user(client, email="seller@example.com")
    listing = create_listing(client, user["id"])
    listing_id = listing["id"]

    # First detail fetch should bump view_count from 0 to 1
    response = client.get(f"/api/listings/{listing_id}")
    assert response.status_code == 200
    detail = response.get_json()

    assert detail["id"] == listing_id
    assert detail.get("view_count") == 1
    assert detail["images"][0].startswith("/static/uploads/")


def test_favorites_roundtrip(client):
    user = register_user(client, email="fav@example.com")
    listing = create_listing(client, user["id"], title="Chair")
    listing_id = listing["id"]

    add_response = client.post(
        "/api/favorites",
        json={"user_id": user["id"], "listing_id": listing_id},
    )
    assert add_response.status_code == 201

    list_response = client.get(f"/api/users/{user['id']}/favorites")
    assert list_response.status_code == 200
    data = list_response.get_json()

    assert data["favorite_ids"] == [listing_id]
    assert len(data["favorites"]) == 1
    assert data["favorites"][0]["id"] == listing_id


def test_search_requires_query(client):
    response = client.get("/api/listings/search")
    assert response.status_code == 400
    data = response.get_json()
    assert "error" in data
