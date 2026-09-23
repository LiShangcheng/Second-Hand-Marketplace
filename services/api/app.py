import os
import base64
import binascii
import hashlib
import hmac
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, render_template, request, send_from_directory
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

load_dotenv()

try:
    from .db import Database
except ImportError:  # pragma: no cover
    from db import Database  # type: ignore


def _find_root() -> Path:
    """Return the directory that contains static/ and templates/."""
    here = Path(__file__).resolve()
    for cand in [here.parent, here.parent.parent, here.parent.parent.parent]:
        if (cand / "static").exists() and (cand / "templates").exists():
            return cand
    return here.parent


ROOT_DIR = _find_root()
STATIC_DIR = ROOT_DIR / "static"
TEMPLATES_DIR = ROOT_DIR / "templates"
UPLOAD_DIR = STATIC_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "marketplace")

BROOKLYN_KEYWORDS = {
    "dibner",
    "metrotech",
    "rogers hall",
    "clark street",
    "tandon",
    "brooklyn",
    "othmer",
    "jersey",
}

WSQ_KEYWORDS = {
    "washington square",
    "bobst",
    "kimmel",
    "palladium",
    "third avenue north",
    "weinstein",
    "washington mews",
    "union square",
    "astor place",
    "lipton",
    "tisch",
    "courant",
    "graduate center",
}

MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_LISTING_IMAGES = 5
IMAGE_EXTENSIONS = {
    "jpeg": {".jpg", ".jpeg"},
    "png": {".png"},
    "webp": {".webp"},
}


def _detect_image_type(data: bytes):
    if data.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if len(data) >= 12 and data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "webp"
    return None


def _validate_image_upload(upload):
    if not upload or not upload.filename:
        return None, "image required", 400

    safe_name = secure_filename(upload.filename)
    extension = Path(safe_name).suffix.lower()
    data = upload.stream.read(MAX_IMAGE_BYTES + 1)
    upload.stream.seek(0)

    if len(data) > MAX_IMAGE_BYTES:
        return None, "each image must be 5MB or smaller", 413

    image_type = _detect_image_type(data)
    if not image_type or extension not in IMAGE_EXTENSIONS[image_type]:
        return None, "only JPG, PNG, and WEBP images are supported", 400

    expected_mime = "image/jpeg" if image_type == "jpeg" else f"image/{image_type}"
    declared_mime = (upload.mimetype or "").lower()
    if declared_mime and declared_mime not in (expected_mime, "application/octet-stream"):
        return None, "image content does not match its file type", 400

    return safe_name, None, None


def create_app(testing: bool = False):
    app = Flask(__name__, static_folder=str(STATIC_DIR), template_folder=str(TEMPLATES_DIR))
    app.wsgi_app = ProxyFix(app.wsgi_app)

    db = Database(MONGO_URI, MONGO_DB, use_mock=testing)
    app.extensions["database"] = db
    app.config.setdefault("VERIFICATION_SECRET", os.getenv("VERIFICATION_SECRET", "local-development-secret"))
    app.config.setdefault("AUTH_TOKEN_TTL_SECONDS", int(os.getenv("AUTH_TOKEN_TTL_SECONDS", "604800")))
    app.config.setdefault("MAX_CONTENT_LENGTH", MAX_LISTING_IMAGES * MAX_IMAGE_BYTES + 1024 * 1024)
    if not testing:
        db.seed_if_empty()

    cors_origin = os.getenv("CORS_ORIGIN", "http://localhost:3000")

    @app.before_request
    def handle_preflight():
        if request.method == "OPTIONS":
            resp = app.make_response("")
            resp.status_code = 204
            return resp

    @app.after_request
    def add_cors_headers(response):
        response.headers.setdefault("Access-Control-Allow-Origin", cors_origin)
        response.headers.setdefault("Access-Control-Allow-Headers", "Content-Type, Authorization")
        response.headers.setdefault("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        response.headers.setdefault("Access-Control-Allow-Credentials", "true")
        return response

    @app.errorhandler(413)
    def request_too_large(_error):
        return jsonify({"error": "upload is too large"}), 413

    reports = []
    presence_store = {}
    communities = [
        {"id": 1, "name": "NYU Brooklyn Campus", "type": "university"},
        {"id": 2, "name": "NYU Washington Square", "type": "university"},
    ]

    def _next_id(collection):
        return str(len(collection) + 1)

    def _normalize_optional(value):
        if value in (None, "", "None", "null", "undefined"):
            return None
        return value

    def _presence_payload(user_id: str):
        last_seen = presence_store.get(user_id)
        online = False
        if last_seen:
            online = (datetime.now(timezone.utc) - last_seen).total_seconds() <= 120
        return {
            "user_id": user_id,
            "online": online,
            "last_seen": last_seen.isoformat().replace("+00:00", "Z") if last_seen else None,
        }

    def _infer_community_id(meetup_point: str):
        if not meetup_point:
            return None
        lower = meetup_point.lower()
        if any(key in lower for key in BROOKLYN_KEYWORDS):
            return "1"
        if any(key in lower for key in WSQ_KEYWORDS):
            return "2"
        return None

    def _normalize_email(raw_email):
        email = (raw_email or "").lower().strip()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            return None
        return email

    def _issue_auth_token(user_id: str) -> str:
        issued_at = int(datetime.now(timezone.utc).timestamp())
        token_data = f"{user_id}:{issued_at}"
        payload = base64.urlsafe_b64encode(token_data.encode("utf-8")).decode("ascii").rstrip("=")
        secret = app.config["VERIFICATION_SECRET"].encode("utf-8")
        signature = hmac.new(secret, payload.encode("ascii"), hashlib.sha256).hexdigest()
        return f"{payload}.{signature}"

    def _authenticated_user_id():
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return None
        token = header.removeprefix("Bearer ").strip()
        try:
            payload, signature = token.split(".", 1)
            secret = app.config["VERIFICATION_SECRET"].encode("utf-8")
            expected = hmac.new(secret, payload.encode("ascii"), hashlib.sha256).hexdigest()
            if not hmac.compare_digest(signature, expected):
                return None
            padded = payload + "=" * (-len(payload) % 4)
            decoded = base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8")
            user_id, issued_at_raw = decoded.rsplit(":", 1)
            issued_at = int(issued_at_raw)
        except (ValueError, UnicodeDecodeError, binascii.Error):
            return None
        now = int(datetime.now(timezone.utc).timestamp())
        if issued_at > now + 60 or now - issued_at > app.config["AUTH_TOKEN_TTL_SECONDS"]:
            return None
        return user_id if db.get_user(user_id) else None

    def _require_auth(expected_user_id=None):
        user_id = _authenticated_user_id()
        if not user_id:
            return None, (jsonify({"error": "authentication required"}), 401)
        if expected_user_id is not None and str(user_id) != str(expected_user_id):
            return None, (jsonify({"error": "forbidden"}), 403)
        return user_id, None

    def _auth_payload(user):
        safe_user = db.get_user(user["id"])
        token = _issue_auth_token(user["id"])
        return {"token": token, "user": safe_user}

    @app.route("/api/health")
    @app.route("/health")
    def health():
        return jsonify({"status": "ok"}), 200

    # ---- Communities ----

    @app.route("/api/communities", methods=["GET"])
    def get_communities():
        return jsonify(communities), 200

    @app.route("/api/communities/<int:community_id>", methods=["GET"])
    def get_community(community_id):
        for c in communities:
            if c["id"] == community_id:
                return jsonify(c), 200
        return jsonify({"error": "Not found"}), 404

    # ---- Presence ----

    @app.route("/api/users/<user_id>/presence", methods=["GET", "POST", "DELETE"])
    def user_presence(user_id):
        if request.method != "GET":
            _, auth_error = _require_auth(user_id)
            if auth_error:
                return auth_error
        if request.method == "POST":
            presence_store[user_id] = datetime.now(timezone.utc)
        elif request.method == "DELETE":
            presence_store.pop(user_id, None)
        return jsonify(_presence_payload(user_id)), 200

    # ---- Listings ----

    @app.route("/api/listings", methods=["GET", "POST"])
    def listings():
        if request.method == "GET":
            filters = {
                "category": request.args.get("category"),
                "community_id": request.args.get("community_id"),
                "q": request.args.get("q"),
                "status": request.args.get("status") or "active",
            }
            items = db.list_items(filters)
            return jsonify(items), 200

        image_uploads = []
        if request.form:
            form = request.form
            title = form.get("title", "").strip()
            price = form.get("price")
            category = form.get("category") or "other"
            description = form.get("description", "")
            meetup_point = form.get("meetup_point", "")
            user_id = form.get("user_id") or "1"
            course_code = form.get("course_code")
            community_id = form.get("community_id")
            if request.files:
                image_uploads = [f for f in request.files.getlist("images") if f and f.filename]
        else:
            payload = request.get_json(force=True, silent=True) or {}
            title = (payload.get("title") or payload.get("name") or "").strip()
            price = payload.get("price")
            category = payload.get("category") or "other"
            description = payload.get("description", "")
            meetup_point = payload.get("meetup_point", "")
            user_id = payload.get("user_id") or "1"
            course_code = payload.get("course_code")
            community_id = payload.get("community_id")

        if not community_id:
            community_id = _infer_community_id(meetup_point)
        if community_id:
            community_id = str(community_id)

        if not title or price is None:
            return jsonify({"error": "title and price are required"}), 400
        try:
            price_val = float(price)
        except (TypeError, ValueError):
            return jsonify({"error": "price must be a number"}), 400

        images = []
        if image_uploads:
            _, auth_error = _require_auth(user_id)
            if auth_error:
                return auth_error
            if len(image_uploads) > MAX_LISTING_IMAGES:
                return jsonify({"error": f"up to {MAX_LISTING_IMAGES} images are allowed"}), 400
            validated_uploads = []
            for upload in image_uploads:
                filename, error, status = _validate_image_upload(upload)
                if error:
                    return jsonify({"error": error}), status
                validated_uploads.append((upload, filename))
            for upload, filename in validated_uploads:
                unique_name = f"{uuid.uuid4().hex}_{filename}"
                upload.save(UPLOAD_DIR / unique_name)
                images.append(f"/static/uploads/{unique_name}")

        user_info = db.get_user(user_id) or {
            "id": user_id,
            "nickname": "Seller",
            "verify_status": "email_verified",
        }
        listing = db.create_item(
            title=title,
            price=price_val,
            description=description,
            category=category,
            meetup_point=meetup_point,
            user_id=user_id,
            user=user_info,
            course_code=course_code,
            community_id=community_id,
            images=images if images else None,
        )
        return jsonify(listing), 201

    @app.route("/api/listings/<item_id>", methods=["GET", "PUT"])
    def get_listing(item_id):
        if request.method == "PUT":
            image_uploads = []
            if request.form or request.files:
                data = request.form
                status = data.get("status")
                user_id = str(data.get("user_id") or "")
                title = (data.get("title") or data.get("name") or "").strip()
                price = data.get("price")
                category = data.get("category")
                description = data.get("description")
                meetup_point = data.get("meetup_point")
                if request.files:
                    image_uploads = [f for f in request.files.getlist("images") if f and f.filename]
            else:
                data = request.get_json(force=True, silent=True) or {}
                status = data.get("status")
                user_id = str(data.get("user_id") or "")
                title = (data.get("title") or data.get("name") or "").strip()
                price = data.get("price")
                category = data.get("category")
                description = data.get("description")
                meetup_point = data.get("meetup_point")

            listing = db.get_item(item_id)
            if not listing:
                return jsonify({"error": "Not found"}), 404

            listing_owner = str(listing.get("user_id") or listing.get("user", {}).get("id") or "")
            if listing_owner and listing_owner != user_id:
                return jsonify({"error": "Forbidden"}), 403

            images = []
            validated_uploads = []
            if image_uploads:
                _, auth_error = _require_auth(user_id)
                if auth_error:
                    return auth_error
                if len(image_uploads) > MAX_LISTING_IMAGES:
                    return jsonify({"error": f"up to {MAX_LISTING_IMAGES} images are allowed"}), 400
                for upload in image_uploads:
                    filename, error, status = _validate_image_upload(upload)
                    if error:
                        return jsonify({"error": error}), status
                    validated_uploads.append((upload, filename))

            updates = {}
            if status:
                updates["status"] = status
                if status == "sold":
                    updates["sold_at"] = datetime.now(timezone.utc).isoformat()
                else:
                    updates["sold_at"] = None
            if "title" in data or "name" in data:
                if not title:
                    return jsonify({"error": "title is required"}), 400
                updates["title"] = title
                updates["name"] = title
            if "price" in data:
                try:
                    updates["price"] = float(price)
                except (TypeError, ValueError):
                    return jsonify({"error": "price must be a number"}), 400
            if "category" in data:
                updates["category"] = category
            if "description" in data:
                updates["description"] = description
            if "meetup_point" in data:
                updates["meetup_point"] = meetup_point
                updates["community_id"] = _infer_community_id(meetup_point)
            for upload, filename in validated_uploads:
                unique_name = f"{uuid.uuid4().hex}_{filename}"
                upload.save(UPLOAD_DIR / unique_name)
                images.append(f"/static/uploads/{unique_name}")
            if images:
                updates["images"] = images

            if not updates:
                return jsonify({"error": "No fields to update"}), 400

            updated = db.update_item(item_id, updates)
            if not updated:
                return jsonify({"error": "Update failed"}), 400

            if status == "sold":
                # Remove from favorites so "My Wish" no longer shows sold-out items.
                db.remove_favorites_by_listing(item_id)

            refreshed = db.get_item(item_id)
            return jsonify(refreshed), 200

        item = db.get_item(item_id)
        if not item:
            return jsonify({"error": "Not found"}), 404
        return jsonify(item), 200

    @app.route("/api/listings/search", methods=["GET"])
    def search_listings():
        q = request.args.get("q")
        status = request.args.get("status") or "active"
        items = db.list_items({"q": q, "status": status})
        return jsonify(items), 200

    @app.route("/api/users/<user_id>/listings", methods=["GET"])
    def get_user_listings(user_id):
        status = request.args.get("status") or "all"
        items = db.list_items({"user_id": user_id, "status": status})
        return jsonify(items), 200

    # ---- Auth (demo) ----

    @app.route("/api/auth/register", methods=["POST"])
    def register():
        payload = request.get_json(force=True, silent=True) or {}
        email = _normalize_email(payload.get("email"))
        password = payload.get("password") or ""
        nickname = payload.get("nickname") or "User"
        community_id = payload.get("community_id")
        if not payload.get("email") or not password:
            return jsonify({"error": "email and password required"}), 400
        if not email:
            return jsonify({"error": "a valid email address is required"}), 400

        created = db.create_user(
            email=email,
            password=password,
            nickname=nickname,
            community_id=community_id,
            email_verified=True,
        )
        if not created:
            return jsonify({"error": "email already registered"}), 400
        return jsonify(_auth_payload(db.get_user_by_email(email))), 201

    @app.route("/api/auth/login", methods=["POST"])
    def login():
        payload = request.get_json(force=True, silent=True) or {}
        email = (payload.get("email") or "").lower().strip()
        password = payload.get("password") or ""
        user_doc = db.get_user_by_email(email)
        if user_doc and user_doc.get("password") == password:
            return jsonify(_auth_payload(user_doc)), 200
        return jsonify({"error": "Invalid credentials"}), 401

    @app.route("/api/auth/me", methods=["GET"])
    def current_session():
        user_id, auth_error = _require_auth()
        if auth_error:
            return auth_error
        return jsonify(db.get_user(user_id)), 200

    @app.route("/api/users/<user_id>", methods=["GET", "PUT"])
    def get_user(user_id):
        if request.method == "PUT":
            payload = request.get_json(force=True, silent=True) or {}
            updates = {}
            if "nickname" in payload:
                updates["nickname"] = payload.get("nickname")
            if "community_id" in payload:
                updates["community_id"] = payload.get("community_id")
            if "email" in payload:
                email = _normalize_email(payload.get("email"))
                if not email:
                    return jsonify({"error": "a valid email address is required"}), 400
                existing = db.get_user_by_email(email)
                if existing and str(existing.get("id")) != str(user_id):
                    return jsonify({"error": "email already registered"}), 400
                updates["email"] = email
            if "password" in payload:
                password = payload.get("password") or ""
                if not password:
                    return jsonify({"error": "password required"}), 400
                updates["password"] = password
            if not updates:
                return jsonify({"error": "No fields to update"}), 400
            updated = db.update_user(user_id, updates)
            if not updated:
                return jsonify({"error": "Update failed"}), 400
            fresh = db.get_user(user_id)
            return jsonify(fresh), 200

        user = db.get_user(user_id)
        if not user:
            return jsonify({"error": "Not found"}), 404
        return jsonify(user), 200

    @app.route("/api/users/<user_id>/avatar", methods=["POST"])
    def upload_avatar(user_id):
        _, auth_error = _require_auth(user_id)
        if auth_error:
            return auth_error
        user = db.get_user(user_id)
        if not user:
            return jsonify({"error": "Not found"}), 404
        upload = request.files.get("avatar")
        filename, error, status = _validate_image_upload(upload)
        if error:
            return jsonify({"error": error}), status
        unique_name = f"{uuid.uuid4().hex}_{filename}"
        upload.save(UPLOAD_DIR / unique_name)
        avatar_url = f"/static/uploads/{unique_name}"

        db.update_user(user_id, {"avatar": avatar_url})
        fresh = db.get_user(user_id)
        return jsonify({"user": fresh}), 200

    # ---- Favorites (Mongo) ----

    @app.route("/api/favorites", methods=["POST"])
    def add_favorite():
        payload = request.get_json(force=True, silent=True) or {}
        user_id = payload.get("user_id")
        listing_id = payload.get("listing_id")
        if not user_id or not listing_id or user_id == "None" or listing_id == "None":
            return jsonify({"error": "user_id and listing_id required"}), 400
        user_id = str(user_id)
        listing_id = str(listing_id)
        ok = db.add_favorite(user_id, listing_id)
        if not ok:
            return jsonify({"error": "failed to add favorite"}), 400
        return jsonify({"ok": True}), 201

    @app.route("/api/favorites/<listing_id>", methods=["DELETE"])
    def remove_favorite(listing_id):
        user_id = request.args.get("user_id")
        if not user_id:
            return jsonify({"error": "user_id required"}), 400
        db.remove_favorite(user_id, listing_id)
        return jsonify({"ok": True}), 200

    @app.route("/api/users/<user_id>/favorites", methods=["GET"])
    def get_user_favorites(user_id):
        fav_ids = db.list_favorite_ids(user_id)
        items = [db.get_item(fid) for fid in fav_ids]
        items = [i for i in items if i and (i.get("status") or "active") == "active"]
        fav_ids = [i["id"] for i in items]
        return jsonify({"favorites": items, "favorite_ids": fav_ids}), 200

    # ---- Threads & messages ----

    @app.route("/api/threads", methods=["POST"])
    def create_thread():
        payload = request.get_json(force=True, silent=True) or {}
        raw_buyer_id = payload.get("buyer_id")
        raw_seller_id = payload.get("seller_id")
        raw_listing_id = payload.get("listing_id")
        buyer_name = payload.get("buyer_name") or payload.get("buyer_nickname")
        seller_name = payload.get("seller_name") or payload.get("seller_nickname")

        buyer_id = _normalize_optional(raw_buyer_id)
        seller_id = _normalize_optional(raw_seller_id)
        listing_id = _normalize_optional(raw_listing_id)

        if not buyer_id or not seller_id or not listing_id:
            return jsonify({"error": "buyer_id, seller_id, listing_id required"}), 400

        buyer_id = str(buyer_id)
        seller_id = str(seller_id)
        listing_id = str(listing_id)

        _, auth_error = _require_auth(buyer_id)
        if auth_error:
            return auth_error

        listing = db.get_item(listing_id)
        if not listing:
            return jsonify({"error": "listing not found"}), 404

        listing_seller_id = str(listing.get("user_id") or "")
        if listing_seller_id and listing_seller_id != seller_id:
            return jsonify({"error": "seller_id does not match listing owner"}), 400

        if buyer_id == seller_id:
            return jsonify({"error": "buyer and seller cannot be the same user"}), 400

        existing_thread = db.find_thread(buyer_id, seller_id, listing_id)
        if existing_thread:
            return jsonify(existing_thread), 200

        # Fallback names from known users or listing if not provided
        if not buyer_name:
            buyer_user = db.get_user(buyer_id)
            buyer_name = (buyer_user or {}).get("nickname") or f"User {buyer_id}"
        if not seller_name:
            seller_user = db.get_user(seller_id)
            seller_name = (
                listing.get("user", {}).get("nickname")
                or (seller_user or {}).get("nickname")
                or f"User {seller_id}"
            )

        thread = db.create_thread(
            buyer_id=buyer_id,
            seller_id=seller_id,
            listing_id=listing_id,
            buyer_name=buyer_name,
            seller_name=seller_name,
        )
        return jsonify(thread), 201

    @app.route("/api/threads/<user_id>", methods=["GET"])
    def get_threads(user_id):
        _, auth_error = _require_auth(user_id)
        if auth_error:
            return auth_error
        user_threads = db.list_threads_for_user(user_id)
        return jsonify(user_threads), 200

    @app.route("/api/threads/<thread_id>/messages", methods=["GET"])
    def get_thread_messages(thread_id):
        """
        Optional query param: user_id – if provided, mark messages to this user as read.
        """
        authenticated_user_id, auth_error = _require_auth()
        if auth_error:
            return auth_error

        thread = db.get_thread(thread_id)
        if not thread:
            return jsonify({"error": "thread not found"}), 404

        if authenticated_user_id not in (thread.get("buyer_id"), thread.get("seller_id")):
            return jsonify({"error": "forbidden"}), 403

        user_id = request.args.get("user_id")

        if user_id and user_id != authenticated_user_id:
            return jsonify({"error": "forbidden"}), 403

        msgs = db.list_messages_for_thread(thread_id)

        if user_id:
            db.mark_thread_messages_read(thread_id, user_id)

        return jsonify(msgs), 200

    @app.route("/api/messages", methods=["POST"])
    def send_message():
        """
        Body: { thread_id, sender_id, content }.
        Receiver is inferred from thread.
        """
        payload = request.get_json(force=True, silent=True) or {}
        raw_thread_id = payload.get("thread_id")
        raw_sender_id = payload.get("sender_id")
        content = (payload.get("content") or "").strip()

        thread_id = _normalize_optional(raw_thread_id)
        sender_id = _normalize_optional(raw_sender_id)

        if not thread_id or not sender_id or not content:
            return jsonify({"error": "thread_id, sender_id and content required"}), 400

        thread_id = str(thread_id)
        sender_id = str(sender_id)

        _, auth_error = _require_auth(sender_id)
        if auth_error:
            return auth_error

        thread = db.get_thread(thread_id)
        if not thread:
            return jsonify({"error": "thread not found"}), 404

        if sender_id not in (thread["buyer_id"], thread["seller_id"]):
            return jsonify({"error": "sender is not part of this thread"}), 403

        if sender_id == thread["buyer_id"]:
            receiver_id = thread["seller_id"]
        else:
            receiver_id = thread["buyer_id"]

        message = db.create_message(
            thread_id=thread_id,
            sender_id=sender_id,
            receiver_id=receiver_id,
            content=content,
        )
        return jsonify(message), 201

    @app.route("/api/messages/upload", methods=["POST"])
    def upload_message_image():
        _, auth_error = _require_auth()
        if auth_error:
            return auth_error
        upload = request.files.get("image")
        filename, error, status = _validate_image_upload(upload)
        if error:
            return jsonify({"error": error}), status
        unique_name = f"{uuid.uuid4().hex}_{filename}"
        dest = UPLOAD_DIR / unique_name
        upload.save(dest)
        return jsonify({"url": f"/static/uploads/{unique_name}"}), 201

    @app.route("/api/messages/<user_id>/unread-count", methods=["GET"])
    def unread_count(user_id):
        _, auth_error = _require_auth(user_id)
        if auth_error:
            return auth_error
        count = db.count_unread_messages(str(user_id))
        return jsonify({"unread": count}), 200

    # ---- Reports & stats ----

    @app.route("/api/reports", methods=["POST", "GET"])
    def handle_reports():
        if request.method == "POST":
            payload = request.get_json(force=True, silent=True) or {}
            reports.append(payload)
            return jsonify({"ok": True}), 201
        return jsonify(reports), 200

    @app.route("/api/stats/dashboard", methods=["GET"])
    def dashboard_stats():
        return jsonify(
            {
                "listings": len(db.list_items()),
                "users": db.count_users(),
                "favorites": db.count_favorites(),
            }
        ), 200

    @app.route("/api/stats/categories", methods=["GET"])
    def category_stats():
        items = db.list_items()
        counts = {}
        for item in items:
            cat = item.get("category") or "other"
            counts[cat] = counts.get(cat, 0) + 1
        return jsonify(counts), 200

    @app.route("/api/items", methods=["GET", "POST"])
    def items():
        if request.method == "GET":
            return jsonify(db.list_items()), 200

        payload = request.get_json(force=True, silent=True) or {}
        name = (payload.get("name") or "").strip()
        price = payload.get("price")
        if not name or price is None:
            return jsonify({"error": "name and price are required"}), 400
        try:
            price_val = float(price)
        except (TypeError, ValueError):
            return jsonify({"error": "price must be a number"}), 400

        item = db.create_item(
            title=name,
            name=name,
            price=price_val,
            description=payload.get("description", ""),
        )
        return jsonify(item), 201

    # ---- Pages ----

    @app.route("/")
    def index():
        if (TEMPLATES_DIR / "index.html").exists():
            return render_template("index.html")
        return send_from_directory(app.static_folder, "index.html")

    @app.route("/login")
    def login_page():
        return render_template("login.html")

    @app.route("/register")
    def register_page():
        return render_template("register.html")

    @app.route("/static/<path:filename>")
    def static_files(filename):
        return send_from_directory(app.static_folder, filename)

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=True)
