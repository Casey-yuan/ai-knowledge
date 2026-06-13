FROM docker.m.daocloud.io/pgvector/pgvector:pg16

# Switch to Aliyun mirror for faster downloads in China
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null; \
    sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list 2>/dev/null; \
    true

# Install zhparser directly from PGDG apt repo (no compilation needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-16-zhparser \
    && rm -rf /var/lib/apt/lists/*
