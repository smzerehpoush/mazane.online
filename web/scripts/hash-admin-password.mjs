#!/usr/bin/env node
import { randomBytes, scryptSync } from "node:crypto";

const SCRYPT_KEYLEN = 64;

const password = process.argv[2];

if (typeof password !== "string" || password.length === 0) {
  console.error("استفاده: node scripts/hash-admin-password.mjs '<رمز عبور>'");
  process.exitCode = 1;
} else {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN);
  process.stdout.write(`${salt.toString("hex")}:${hash.toString("hex")}\n`);
}
