#!/usr/bin/env node
/**
 * The `pomset` executable. It does nothing but hand its arguments to the
 * registry and turn the returned status into an exit code.
 */

import { runCli } from "../main.js";

process.exitCode = await runCli(process.argv.slice(2));
