FROM documenso/documenso:v2.21.1
COPY --chown=1001:1001 docker/documenso/entrypoint.mjs /app/documenso-entrypoint.mjs
ENTRYPOINT ["node", "/app/documenso-entrypoint.mjs"]
CMD ["sh", "start.sh"]
