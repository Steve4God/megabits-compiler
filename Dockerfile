FROM kubilus1/gendev:latest

# Install Node.js 18 from official binary (more reliable than NodeSource on older Ubuntu)
RUN apt-get update && apt-get install -y curl xz-utils && \
    curl -fsSL https://nodejs.org/dist/v18.20.4/node-v18.20.4-linux-x64.tar.xz | tar -xJ -C /usr/local --strip-components=1 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json .
RUN npm install --production

COPY . .

ENV GENDEV=/opt/gendev
ENV GDK=/opt/gendev/sgdk
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server.js"]