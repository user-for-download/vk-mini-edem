#!/bin/bash
set -e

echo "Building contracts..."
npm run build --workspace=packages/contracts

echo "Prisma generate..."
npm run db:generate --workspace=backend

echo "Prisma validate..."
npm run prisma:validate --workspace=backend

echo "Typecheck contracts..."
npm run typecheck --workspace=packages/contracts

echo "Typecheck backend..."
npm run typecheck --workspace=backend

echo "Typecheck mini-app..."
npm run typecheck --workspace=mini-app

echo "Build mini-app..."
npm run build --workspace=mini-app

echo "Contract tests..."
npm run test --workspace=packages/contracts

echo "Backend smoke tests..."
npm run test --workspace=backend
