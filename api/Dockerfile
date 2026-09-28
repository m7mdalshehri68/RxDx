# The build context is the repository root, so the service can load the very
# same index.html the browser tool serves. That is the whole anti-drift design:
# there is no second copy of the engine to fall out of date.
FROM node:20-alpine

WORKDIR /srv

# The engine and the reference tables. The coding engine itself still never
# loads the drug formulary (the parity check depends on that); /v1/code-note
# reads it separately, reduced to each drug's indicated ICD-10-AM codes, to
# link planned medicines to the diagnoses that justify them.
COPY index.html        /srv/index.html
COPY data/             /srv/data/
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
