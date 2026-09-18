import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/*.test.ts'],
  moduleNameMapper: {
    // '~/testing/*' is deliberately unmatchable by '^@/(.*)$' (different prefix)
    '^~/testing/(.*)$': '<rootDir>/testing/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};

export default config;
