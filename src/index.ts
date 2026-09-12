#!/usr/bin/env node

import { main } from "./cli/index.ts";

process.exitCode = await main();
