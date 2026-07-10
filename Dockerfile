FROM kubilus1/gendev:latest

# Install Node.js 18 from official binary (more reliable than NodeSource on older Ubuntu)
RUN apt-get update && apt-get install -y curl xz-utils && \
    curl -fsSL https://nodejs.org/dist/v16.20.2/node-v16.20.2-linux-x64.tar.xz | tar -xJ -C /usr/local --strip-components=1 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json .
RUN npm install --production

COPY . .

ENV GENDEV=/opt/gendev
ENV GDK=/opt/gendev/sgdk
ENV NODE_ENV=production

# Verify SGDK files exist at build time (shows in build logs)
RUN ls -la /opt/gendev/ && ls -la /opt/gendev/sgdk/mkfiles/ || echo "SGDK mkfiles not found"

# Reset the gendev image's ENTRYPOINT (which defaults to running make)
ENTRYPOINT []

EXPOSE 3000

CMD ["node", "server.js"]