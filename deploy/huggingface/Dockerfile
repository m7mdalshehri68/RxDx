# RxDx Coding API on a Hugging Face Space (Docker SDK, free CPU basic).
#
# The image clones the public RxDx repository and runs api/server.js: the same
# index.html and the same engine the browser tool runs, so the Space cannot
# code a note differently from the tool. After pushing a new version to
# GitHub, open the Space and choose Settings -> Factory rebuild.
FROM node:20-alpine

RUN apk add --no-cache git

WORKDIR /srv
RUN git clone --depth 1 https://github.com/m7mdalshehri68/RxDx.git . && rm -rf .git

# GitHub Pages, Cloudflare Pages and a copy opened from disk (its origin is
# "null") may call the service from a browser. Hospital systems call it
# server to server and need no entry here.
ENV NODE_ENV=production \
    PORT=7860 \
    RXDX_ALLOW_ORIGINS=https://m7mdalshehri68.github.io,https://rxdx-5pn.pages.dev,null \
    RXDX_PUBLIC_DEMO=1 \
    RXDX_RATE_LIMIT=120

EXPOSE 7860
USER node
WORKDIR /srv/api
CMD ["node", "server.js"]
