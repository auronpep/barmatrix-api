#!/usr/bin/env tsx
import "dotenv/config";

import { runRemapJsonFksFromEnv } from "../src/scripts/remap-json-fks.js";

runRemapJsonFksFromEnv()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
