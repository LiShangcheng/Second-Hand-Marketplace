FROM python:3.12-slim
WORKDIR /app

# Install dependencies
COPY services/api/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code and assets
COPY services/api /app

ENV FLASK_APP=app.py
ENV PORT=5000
EXPOSE 5000

CMD ["python", "app.py"]
