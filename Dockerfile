FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY . .
COPY --from=frontend-builder /app/dist /app/dist

RUN pip install --no-cache-dir fastapi uvicorn pydantic pydantic-settings httpx python-multipart pytest

EXPOSE 8005

ENV PYTHONPATH=.
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8005"]
