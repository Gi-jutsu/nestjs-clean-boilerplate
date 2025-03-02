FROM node:22-alpine as base

RUN addgroup -S app_group && adduser -S app_user -G app_group

WORKDIR /opt/backend
COPY package.json pnpm-lock.yaml ./

FROM base AS builder
COPY .nvmrc \ 
    .swcrc \
    tsconfig.json \
    ./
# Keep a copy of production dependencies for the release image
# (this will allow us to keep the release image smaller)
RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile --prod && \
    cp -R node_modules production_node_modules && \
    pnpm install --frozen-lockfile
COPY src ./src
RUN pnpm build

FROM base AS release
COPY --from=builder /opt/backend/production_node_modules ./node_modules
COPY --from=builder /opt/backend/build ./build

USER app_user

CMD ["node", "build/main.js"]
