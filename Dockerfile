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
RUN echo "=== /opt/gendev ===" && ls -la /opt/gendev/ && \
    echo "=== sgdkv1.62 ===" && ls -la /opt/gendev/sgdkv1.62/ && \
    echo "=== mkfiles ===" && ls -la /opt/gendev/sgdkv1.62/mkfiles/ || echo "SGDK mkfiles not found"

# Download gendev makefiles from GitHub in case they're missing from the pre-built image
RUN MKF=/opt/gendev/sgdkv1.62/mkfiles && \
    mkdir -p $MKF && \
    curl -fsSL https://raw.githubusercontent.com/kubilus1/gendev/master/sgdk/mkfiles/Makefile.rom -o $MKF/Makefile.rom && \
    curl -fsSL https://raw.githubusercontent.com/kubilus1/gendev/master/sgdk/mkfiles/makefile.vars -o $MKF/makefile.vars && \
    curl -fsSL https://raw.githubusercontent.com/kubilus1/gendev/master/sgdk/mkfiles/Makefile.sgdk_lib -o $MKF/Makefile.sgdk_lib && \
    curl -fsSL https://raw.githubusercontent.com/Stephane-D/SGDK/v1.62/makefile.gen -o $MKF/makefile.gen && \
    echo "=== mkfiles after download ===" && ls -la $MKF/

# Download SGDK boot files and linker script (missing from pre-built image)
RUN SGDK=/opt/gendev/sgdkv1.62 && \
    mkdir -p $SGDK/src/boot && \
    curl -fsSL https://raw.githubusercontent.com/Stephane-D/SGDK/v1.62/src/boot/sega.s -o $SGDK/src/boot/sega.s && \
    curl -fsSL https://raw.githubusercontent.com/Stephane-D/SGDK/v1.62/src/boot/rom_head.c -o $SGDK/src/boot/rom_head.c && \
    curl -fsSL https://raw.githubusercontent.com/Stephane-D/SGDK/v1.62/md.ld -o $SGDK/md.ld && \
    echo "=== boot dir ===" && ls -la $SGDK/src/boot/ && \
    echo "=== md.ld ===" && ls -la $SGDK/md.ld

# Create symlink: /opt/gendev/sgdk -> sgdkv1.62 so all GDK paths resolve consistently
RUN ln -sf /opt/gendev/sgdkv1.62 /opt/gendev/sgdk

# SGDK's makefile.gen expects binaries at $(GDK)/bin/ (e.g. gcc, ld, objcopy)
# but gendev has them as m68k-elf-* at $(GENDEV)/bin/. Create symlinks.
RUN GDBIN=/opt/gendev/sgdk/bin && \
    mkdir -p $GDBIN && \
    for tool in gcc ld objcopy nm ar as ranlib; do \
      ln -sf /opt/gendev/bin/m68k-elf-$tool $GDBIN/$tool 2>/dev/null || true; \
    done && \
    for tool in sjasm sizebnd bintos; do \
      ln -sf /opt/gendev/bin/$tool $GDBIN/$tool 2>/dev/null || true; \
    done && \
    ls -la $GDBIN/

# Reset the gendev image's ENTRYPOINT (which defaults to running make)
ENTRYPOINT []

EXPOSE 3000

CMD ["node", "server.js"]