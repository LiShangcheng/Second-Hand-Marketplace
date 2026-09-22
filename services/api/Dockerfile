FROM python:3.12-slim
WORKDIR /app

# Install dependencies
COPY services/api/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Preserve the repository package layout so both the application and tests can
# import modules as services.api.* inside the image.
COPY pyproject.toml /app/pyproject.toml
COPY services/__init__.py /app/services/__init__.py
COPY services/api /app/services/api

ENV FLASK_APP=services.api.app
ENV PYTHONPATH=/app
ENV PORT=5000
EXPOSE 5000

CMD ["python", "-m", "services.api.app"]
