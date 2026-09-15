FROM python:3.13-slim

WORKDIR /app

COPY index.html script.js styles.css server.py ./
COPY assets/ ./assets/

EXPOSE 8000

# Inside the container, 0.0.0.0 is required for the docker-compose port
# mapping to reach the process at all; override with BIND (see .env) only
# if you know what you're doing.
ENV BIND=0.0.0.0
CMD python3 server.py --root /markdowns --port 8000 --bind "$BIND"
