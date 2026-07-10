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

# Download the COMPLETE SGDK v1.62 source tree (pre-built image is missing inc/, src/, res/, etc.)
RUN mkdir -p /tmp/sgdk_src && \
    curl -fsSL https://github.com/Stephane-D/SGDK/archive/refs/tags/v1.62.tar.gz | \
      tar xz -C /tmp/sgdk_src --strip-components=1 && \
    SGDK=/opt/gendev/sgdkv1.62 && \
    cp -r /tmp/sgdk_src/inc $SGDK/inc && \
    cp -r /tmp/sgdk_src/src $SGDK/src && \
    cp -r /tmp/sgdk_src/res $SGDK/res && \
    cp -f /tmp/sgdk_src/md.ld $SGDK/md.ld && \
    cp -f /tmp/sgdk_src/makefile.gen $SGDK/makefile.gen && \
    rm -rf /tmp/sgdk_src && \
    echo "=== inc dir ===" && ls $SGDK/inc/ | head -5 && \
    echo "=== genesis.h ===" && head -3 $SGDK/inc/genesis.h && \
    echo "=== md.ld ===" && ls -la $SGDK/md.ld

# Download gendev makefiles from GitHub (the SGDK source tree doesn't include gendev's wrapper makefiles)
RUN MKF=/opt/gendev/sgdkv1.62/mkfiles && \
    mkdir -p $MKF && \
    curl -fsSL https://raw.githubusercontent.com/kubilus1/gendev/master/sgdk/mkfiles/Makefile.rom -o $MKF/Makefile.rom && \
    curl -fsSL https://raw.githubusercontent.com/kubilus1/gendev/master/sgdk/mkfiles/makefile.vars -o $MKF/makefile.vars && \
    curl -fsSL https://raw.githubusercontent.com/kubilus1/gendev/master/sgdk/mkfiles/Makefile.sgdk_lib -o $MKF/Makefile.sgdk_lib && \
    cp -f /opt/gendev/sgdkv1.62/makefile.gen $MKF/makefile.gen && \
    echo "=== mkfiles ===" && ls -la $MKF/

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
    echo "=== bin dir ===" && ls -la $GDBIN/

# Find and link rescomp.jar if it exists somewhere in the gendev image
RUN GDBIN=/opt/gendev/sgdk/bin && \
    RESCOMP=$(find /opt/gendev -name "rescomp.jar" 2>/dev/null | head -1) && \
    if [ -n "$RESCOMP" ]; then \
      ln -sf "$RESCOMP" $GDBIN/rescomp.jar && \
      echo "Linked rescomp.jar from $RESCOMP"; \
    else \
      echo "rescomp.jar not found — resource compilation will be skipped"; \
    fi

# Find and link pre-built libmd.a if it exists
RUN GDBLIB=/opt/gendev/sgdk/lib && \
    mkdir -p $GDBLIB && \
    LIBMD=$(find /opt/gendev -name "libmd.a" 2>/dev/null | head -1) && \
    if [ -n "$LIBMD" ]; then \
      ln -sf "$LIBMD" $GDBLIB/libmd.a && \
      echo "Linked libmd.a from $LIBMD"; \
    else \
      echo "libmd.a not found — will be built from source on first compile"; \
    fi && \
    LIBGCC=$(find /opt/gendev -name "libgcc.a" 2>/dev/null | head -1) && \
    if [ -n "$LIBGCC" ]; then \
      ln -sf "$LIBGCC" $GDBLIB/libgcc.a && \
      echo "Linked libgcc.a from $LIBGCC"; \
    fi

# Reset the gendev image's ENTRYPOINT (which defaults to running make)
ENTRYPOINT []

EXPOSE 3000

CMD ["node", "server.js"]