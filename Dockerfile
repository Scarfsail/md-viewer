FROM python:3.13-slim

WORKDIR /app

COPY index.html script.js styles.css server.py ./
COPY assets/ ./assets/

EXPOSE 8000

CMD ["python3", "server.py", "--root", "/markdowns", "--port", "8000", "--bind", "0.0.0.0"]
