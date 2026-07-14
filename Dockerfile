FROM node:18-slim

# Install system dependencies including Java JDK for Android builds
RUN apt-get update && apt-get install -y \
    openjdk-17-jdk \
    unzip \
    wget \
    git \
    && rm -rf /var/lib/apt/lists/*

# Environment variables for Android SDK + Java
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV ANDROID_HOME=/opt/android-sdk
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV PATH="${PATH}:${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools:${JAVA_HOME}/bin"

# Install Android SDK command-line tools
RUN mkdir -p ${ANDROID_HOME}/cmdline-tools && \
    wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O /tmp/cmdline-tools.zip && \
    unzip -q /tmp/cmdline-tools.zip -d ${ANDROID_HOME}/cmdline-tools && \
    mv ${ANDROID_HOME}/cmdline-tools/cmdline-tools ${ANDROID_HOME}/cmdline-tools/latest && \
    rm /tmp/cmdline-tools.zip

# Accept Android licenses and install SDK packages
RUN yes | sdkmanager --licenses > /dev/null 2>&1 && \
    sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"

# Set up the Express server
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY . .

# Pre-warm npm + Gradle caches with a dummy Capacitor build so real builds are fast
RUN mkdir -p /tmp/warmup && cd /tmp/warmup && \
    npm init -y && \
    npm install @capacitor/core@^6 @capacitor/android@^6 @capacitor/cli@^6 phaser@^3.80.1 && \
    mkdir -p www && \
    echo '<html><body><h1>Warmup</h1></body></html>' > www/index.html && \
    npx cap init warmup com.megabits.warmup --webDir=www && \
    npx cap add android && \
    cd android && ./gradlew assembleDebug || true && \
    cd / && rm -rf /tmp/warmup

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server.js"]