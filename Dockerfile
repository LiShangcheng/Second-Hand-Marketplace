FROM node:20-alpine AS web-build

WORKDIR /web

COPY services/web/package*.json ./
RUN npm ci

COPY services/web ./
RUN npm run build


FROM python:3.12-slim

WORKDIR /app

# This root-level Dockerfile lets hosting platforms build the API with the
# repository root as the Docker build context.
COPY services/api/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY pyproject.toml /app/pyproject.toml
COPY services/__init__.py /app/services/__init__.py
COPY services/api /app/services/api
COPY --from=web-build /web/dist/ /app/services/api/static/

ENV FLASK_APP=services.api.app
ENV PYTHONPATH=/app
ENV PORT=5000

EXPOSE 5000

CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT:-5000} --workers 1 --threads 4 --worker-tmp-dir /dev/shm --access-logfile - --error-logfile - services.api.wsgi:app"]
