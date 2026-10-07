FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
        g++ \
        ca-certificates \
        libssl-dev \
        libcurl4-openssl-dev \
        nlohmann-json3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src

COPY . .

RUN mkdir -p build \
    && g++ -std=c++17 -O2 -Wall -Wextra \
        gscan.cpp image.cpp api.cpp \
        -lcrypto -lcurl \
        -o build/gscan

ENTRYPOINT ["/src/build/gscan"]