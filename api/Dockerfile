# The build context is the repository root, so the service can load the very
# same index.html the browser tool serves. That is the whole anti-drift design:
# there is no second copy of the engine to fall out of date.
FROM node:20-alpine

WORKDIR /srv

# The engine and the reference table it needs. The drug formulary is not copied:
# coding a note needs ICD and the vocabulary, not 1,548 medicines.
COPY index.html        /srv/index.html
COPY data/icd-1.js     /srv/data/icd-1.js
COPY gold/             /srv/gold/
COPY api/              /srv/api/

WORKDIR /srv/api

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Run unprivileged.
USER node

HEALTHCHECK --interval=30s --timeout=4s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
