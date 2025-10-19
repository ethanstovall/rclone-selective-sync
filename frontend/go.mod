// This file prevents Go from scanning the frontend directory for Go modules.
// The bindings directory contains TypeScript files with directory structures
// that mirror Go import paths, which can confuse Go's module resolution.
module frontend

go 1.22
